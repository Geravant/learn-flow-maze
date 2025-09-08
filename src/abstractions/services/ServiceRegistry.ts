// Service Registry - Centralized service management and dependency injection
// Provides service discovery, lifecycle management, and configuration

import { EventEmitter } from 'events';

export interface ServiceDefinition {
  name: string;
  version: string;
  description?: string;
  dependencies: string[];
  singleton: boolean;
  autoStart: boolean;
  factory: ServiceFactory<any>;
  config?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface ServiceFactory<T> {
  (dependencies: ServiceDependencies, config?: Record<string, any>): T | Promise<T>;
}

export interface ServiceDependencies {
  [serviceName: string]: any;
}

export interface ServiceInstance {
  name: string;
  service: any;
  status: ServiceStatus;
  createdAt: Date;
  startedAt?: Date;
  stoppedAt?: Date;
  dependencies: string[];
  dependents: Set<string>;
  error?: Error;
  metadata?: Record<string, any>;
}

export type ServiceStatus = 'registered' | 'starting' | 'started' | 'stopping' | 'stopped' | 'error';

export interface ServiceConfiguration {
  enableHealthChecks: boolean;
  healthCheckInterval: number;
  enableMetrics: boolean;
  enableAutoRecovery: boolean;
  maxRetries: number;
  retryDelay: number;
  shutdownTimeout: number;
  enableCircularDependencyDetection: boolean;
}

const DEFAULT_CONFIG: ServiceConfiguration = {
  enableHealthChecks: true,
  healthCheckInterval: 30000, // 30 seconds
  enableMetrics: true,
  enableAutoRecovery: true,
  maxRetries: 3,
  retryDelay: 1000,
  shutdownTimeout: 10000,
  enableCircularDependencyDetection: true
};

export class ServiceRegistry extends EventEmitter {
  private config: ServiceConfiguration;
  private services: Map<string, ServiceDefinition> = new Map();
  private instances: Map<string, ServiceInstance> = new Map();
  private dependencyGraph: Map<string, Set<string>> = new Map();
  private startupOrder: string[] = [];
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private metrics = {
    servicesRegistered: 0,
    servicesStarted: 0,
    servicesStopped: 0,
    servicesErrored: 0,
    totalStartTime: 0,
    healthChecks: 0,
    recoveryAttempts: 0
  };

  constructor(config: Partial<ServiceConfiguration> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    if (this.config.enableHealthChecks) {
      this.startHealthChecks();
    }
  }

  // Service registration
  register<T>(definition: ServiceDefinition): void {
    if (this.services.has(definition.name)) {
      throw new Error(`Service ${definition.name} is already registered`);
    }

    // Validate dependencies
    this.validateServiceDefinition(definition);

    this.services.set(definition.name, definition);
    this.updateDependencyGraph(definition);
    
    if (this.config.enableCircularDependencyDetection) {
      this.detectCircularDependencies();
    }

    this.calculateStartupOrder();
    this.metrics.servicesRegistered++;
    
    this.emit('serviceRegistered', definition.name);

    // Auto-start if enabled
    if (definition.autoStart) {
      this.start(definition.name).catch(error => {
        this.emit('autoStartFailed', definition.name, error);
      });
    }
  }

  unregister(serviceName: string): void {
    const instance = this.instances.get(serviceName);
    if (instance && instance.status === 'started') {
      throw new Error(`Cannot unregister running service ${serviceName}. Stop it first.`);
    }

    this.services.delete(serviceName);
    this.instances.delete(serviceName);
    this.removeDependencyReferences(serviceName);
    this.calculateStartupOrder();
    
    this.emit('serviceUnregistered', serviceName);
  }

  // Service lifecycle
  async start(serviceName: string): Promise<any> {
    const definition = this.services.get(serviceName);
    if (!definition) {
      throw new Error(`Service ${serviceName} is not registered`);
    }

    let instance = this.instances.get(serviceName);
    if (instance) {
      if (instance.status === 'started') {
        return instance.service;
      }
      if (instance.status === 'starting') {
        // Wait for the current start operation to complete
        return this.waitForServiceStart(serviceName);
      }
    }

    // Create new instance if needed
    if (!instance) {
      instance = {
        name: serviceName,
        service: null,
        status: 'registered',
        createdAt: new Date(),
        dependencies: [...definition.dependencies],
        dependents: new Set(),
        metadata: definition.metadata
      };
      this.instances.set(serviceName, instance);
    }

    instance.status = 'starting';
    this.emit('serviceStarting', serviceName);

    try {
      const startTime = performance.now();

      // Start dependencies first
      const dependencies = await this.resolveDependencies(definition.dependencies);
      
      // Create service instance
      const service = await definition.factory(dependencies, definition.config);
      
      // Initialize service if it has lifecycle methods
      if (service && typeof service.start === 'function') {
        await service.start();
      }

      instance.service = service;
      instance.status = 'started';
      instance.startedAt = new Date();
      
      const duration = performance.now() - startTime;
      this.metrics.totalStartTime += duration;
      this.metrics.servicesStarted++;
      
      this.emit('serviceStarted', serviceName, service, duration);
      return service;

    } catch (error) {
      instance.status = 'error';
      instance.error = error as Error;
      this.metrics.servicesErrored++;
      
      this.emit('serviceStartFailed', serviceName, error);
      
      // Auto-recovery if enabled
      if (this.config.enableAutoRecovery) {
        this.scheduleRecovery(serviceName);
      }
      
      throw error;
    }
  }

  async stop(serviceName: string): Promise<void> {
    const instance = this.instances.get(serviceName);
    if (!instance || instance.status !== 'started') {
      return;
    }

    instance.status = 'stopping';
    this.emit('serviceStopping', serviceName);

    try {
      // Stop dependents first
      await this.stopDependents(serviceName);
      
      // Stop the service
      const service = instance.service;
      if (service && typeof service.stop === 'function') {
        const stopPromise = service.stop();
        
        // Apply timeout
        await Promise.race([
          stopPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Stop timeout')), this.config.shutdownTimeout)
          )
        ]);
      }

      instance.status = 'stopped';
      instance.stoppedAt = new Date();
      instance.service = null;
      this.metrics.servicesStopped++;
      
      this.emit('serviceStopped', serviceName);

    } catch (error) {
      instance.status = 'error';
      instance.error = error as Error;
      this.emit('serviceStopFailed', serviceName, error);
      throw error;
    }
  }

  async restart(serviceName: string): Promise<any> {
    await this.stop(serviceName);
    return this.start(serviceName);
  }

  // Bulk operations
  async startAll(filter?: (definition: ServiceDefinition) => boolean): Promise<void> {
    const servicesToStart = filter 
      ? this.startupOrder.filter(name => {
          const def = this.services.get(name);
          return def && filter(def);
        })
      : this.startupOrder;

    for (const serviceName of servicesToStart) {
      try {
        await this.start(serviceName);
      } catch (error) {
        this.emit('bulkStartError', serviceName, error);
        // Continue starting other services
      }
    }
  }

  async stopAll(): Promise<void> {
    // Stop in reverse order to handle dependencies
    const stopOrder = [...this.startupOrder].reverse();
    
    for (const serviceName of stopOrder) {
      const instance = this.instances.get(serviceName);
      if (instance && instance.status === 'started') {
        try {
          await this.stop(serviceName);
        } catch (error) {
          this.emit('bulkStopError', serviceName, error);
          // Continue stopping other services
        }
      }
    }
  }

  // Service discovery
  get<T>(serviceName: string): T | null {
    const instance = this.instances.get(serviceName);
    return instance?.status === 'started' ? instance.service : null;
  }

  has(serviceName: string): boolean {
    return this.services.has(serviceName);
  }

  isStarted(serviceName: string): boolean {
    const instance = this.instances.get(serviceName);
    return instance?.status === 'started' || false;
  }

  getStatus(serviceName: string): ServiceStatus | null {
    const instance = this.instances.get(serviceName);
    return instance?.status || null;
  }

  getServices(): string[] {
    return Array.from(this.services.keys());
  }

  getStartedServices(): string[] {
    return Array.from(this.instances.entries())
      .filter(([, instance]) => instance.status === 'started')
      .map(([name]) => name);
  }

  getServiceInfo(serviceName: string): {
    definition?: ServiceDefinition;
    instance?: ServiceInstance;
  } {
    return {
      definition: this.services.get(serviceName),
      instance: this.instances.get(serviceName)
    };
  }

  // Dependency management
  private async resolveDependencies(dependencies: string[]): Promise<ServiceDependencies> {
    const resolved: ServiceDependencies = {};

    for (const depName of dependencies) {
      const service = await this.start(depName);
      resolved[depName] = service;
    }

    return resolved;
  }

  private updateDependencyGraph(definition: ServiceDefinition): void {
    const dependencies = new Set(definition.dependencies);
    this.dependencyGraph.set(definition.name, dependencies);

    // Update dependents
    for (const depName of definition.dependencies) {
      const depInstance = this.instances.get(depName);
      if (depInstance) {
        depInstance.dependents.add(definition.name);
      }
    }
  }

  private removeDependencyReferences(serviceName: string): void {
    // Remove from dependency graph
    this.dependencyGraph.delete(serviceName);

    // Remove as dependent from other services
    for (const instance of this.instances.values()) {
      instance.dependents.delete(serviceName);
    }

    // Remove from other services' dependencies
    for (const [name, deps] of this.dependencyGraph) {
      if (deps.has(serviceName)) {
        deps.delete(serviceName);
      }
    }
  }

  private async stopDependents(serviceName: string): Promise<void> {
    const instance = this.instances.get(serviceName);
    if (!instance) return;

    const dependents = Array.from(instance.dependents);
    for (const dependent of dependents) {
      await this.stop(dependent);
    }
  }

  // Startup order calculation
  private calculateStartupOrder(): void {
    this.startupOrder = this.topologicalSort();
  }

  private topologicalSort(): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: string[] = [];

    const visit = (serviceName: string) => {
      if (visiting.has(serviceName)) {
        throw new Error(`Circular dependency detected involving ${serviceName}`);
      }
      if (visited.has(serviceName)) {
        return;
      }

      visiting.add(serviceName);
      
      const dependencies = this.dependencyGraph.get(serviceName) || new Set();
      for (const dep of dependencies) {
        visit(dep);
      }
      
      visiting.delete(serviceName);
      visited.add(serviceName);
      result.push(serviceName);
    };

    for (const serviceName of this.services.keys()) {
      visit(serviceName);
    }

    return result;
  }

  private detectCircularDependencies(): void {
    try {
      this.topologicalSort();
    } catch (error) {
      this.emit('circularDependencyDetected', error);
      throw error;
    }
  }

  // Health checks
  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  private async performHealthChecks(): Promise<void> {
    for (const [serviceName, instance] of this.instances) {
      if (instance.status !== 'started') continue;

      try {
        const service = instance.service;
        
        // Check if service has health check method
        if (service && typeof service.healthCheck === 'function') {
          const isHealthy = await Promise.race([
            service.healthCheck(),
            new Promise(resolve => setTimeout(() => resolve(false), 5000)) // 5s timeout
          ]);

          if (!isHealthy) {
            this.emit('serviceUnhealthy', serviceName);
            
            if (this.config.enableAutoRecovery) {
              this.scheduleRecovery(serviceName);
            }
          }
        }
        
        this.metrics.healthChecks++;

      } catch (error) {
        this.emit('healthCheckFailed', serviceName, error);
        
        if (this.config.enableAutoRecovery) {
          this.scheduleRecovery(serviceName);
        }
      }
    }
  }

  // Auto-recovery
  private scheduleRecovery(serviceName: string): void {
    const instance = this.instances.get(serviceName);
    if (!instance) return;

    const retryCount = (instance.metadata?.retryCount || 0) + 1;
    
    if (retryCount > this.config.maxRetries) {
      this.emit('serviceRecoveryGivenUp', serviceName, retryCount);
      return;
    }

    instance.metadata = {
      ...instance.metadata,
      retryCount,
      lastRecoveryAttempt: new Date()
    };

    setTimeout(async () => {
      try {
        this.emit('serviceRecoveryAttempt', serviceName, retryCount);
        await this.restart(serviceName);
        
        // Reset retry count on successful recovery
        if (instance.metadata) {
          instance.metadata.retryCount = 0;
        }
        
        this.metrics.recoveryAttempts++;
        this.emit('serviceRecovered', serviceName);

      } catch (error) {
        this.emit('serviceRecoveryFailed', serviceName, retryCount, error);
        
        // Schedule another recovery attempt
        this.scheduleRecovery(serviceName);
      }
    }, this.config.retryDelay * retryCount);
  }

  // Validation
  private validateServiceDefinition(definition: ServiceDefinition): void {
    if (!definition.name) {
      throw new Error('Service name is required');
    }

    if (typeof definition.factory !== 'function') {
      throw new Error('Service factory must be a function');
    }

    // Validate dependencies exist
    for (const dep of definition.dependencies) {
      if (!this.services.has(dep) && dep !== definition.name) {
        // Allow forward references but emit warning
        this.emit('unknownDependency', definition.name, dep);
      }
    }
  }

  private async waitForServiceStart(serviceName: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const checkService = () => {
        const instance = this.instances.get(serviceName);
        if (!instance) {
          reject(new Error(`Service ${serviceName} not found`));
          return;
        }

        switch (instance.status) {
          case 'started':
            resolve(instance.service);
            break;
          case 'error':
            reject(instance.error);
            break;
          default:
            // Still starting, check again
            setTimeout(checkService, 100);
        }
      };

      checkService();
    });
  }

  // Metrics and monitoring
  getMetrics(): typeof this.metrics & {
    uptime: number;
    averageStartTime: number;
    servicesRunning: number;
    healthCheckRate: number;
  } {
    const now = Date.now();
    const uptime = now;
    
    return {
      ...this.metrics,
      uptime,
      averageStartTime: this.metrics.servicesStarted > 0 
        ? this.metrics.totalStartTime / this.metrics.servicesStarted 
        : 0,
      servicesRunning: this.getStartedServices().length,
      healthCheckRate: this.metrics.healthChecks / (uptime / this.config.healthCheckInterval)
    };
  }

  getDependencyGraph(): Record<string, string[]> {
    const graph: Record<string, string[]> = {};
    
    for (const [service, deps] of this.dependencyGraph) {
      graph[service] = Array.from(deps);
    }
    
    return graph;
  }

  // Configuration
  updateConfig(newConfig: Partial<ServiceConfiguration>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    // Restart health checks if interval changed
    if (newConfig.healthCheckInterval && oldConfig.enableHealthChecks) {
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
      }
      this.startHealthChecks();
    }

    // Enable/disable health checks
    if (newConfig.enableHealthChecks !== undefined) {
      if (newConfig.enableHealthChecks && !this.healthCheckTimer) {
        this.startHealthChecks();
      } else if (!newConfig.enableHealthChecks && this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
        this.healthCheckTimer = null;
      }
    }

    this.emit('configUpdated', this.config);
  }

  // Cleanup
  async destroy(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    await this.stopAll();
    
    this.services.clear();
    this.instances.clear();
    this.dependencyGraph.clear();
    this.removeAllListeners();
  }

  // Built-in service factories
  static createSingletonFactory<T>(factoryFn: ServiceFactory<T>): ServiceFactory<T> {
    let instance: T | null = null;
    
    return async (dependencies, config) => {
      if (instance === null) {
        instance = await factoryFn(dependencies, config);
      }
      return instance;
    };
  }

  static createLazyFactory<T>(factoryFn: ServiceFactory<T>): ServiceFactory<() => Promise<T>> {
    let instance: T | null = null;
    
    return (dependencies, config) => {
      return async () => {
        if (instance === null) {
          instance = await factoryFn(dependencies, config);
        }
        return instance;
      };
    };
  }
}

// Decorator for easy service registration
export function Service(options: Partial<ServiceDefinition>) {
  return function<T extends { new(...args: any[]): any }>(constructor: T) {
    const definition: ServiceDefinition = {
      name: options.name || constructor.name,
      version: options.version || '1.0.0',
      description: options.description,
      dependencies: options.dependencies || [],
      singleton: options.singleton ?? true,
      autoStart: options.autoStart ?? false,
      factory: options.factory || ((deps, config) => new constructor(deps, config)),
      config: options.config,
      metadata: options.metadata
    };

    // Store definition on constructor for later registration
    (constructor as any).__serviceDefinition = definition;
    
    return constructor;
  };
}

export default ServiceRegistry;