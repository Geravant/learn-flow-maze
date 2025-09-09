// MCP Client Base - Abstract base class for MCP client implementations
// Provides common functionality for different transport types

import { EventEmitter } from '@/utils/EventEmitter';
import {
  MCPServerConfiguration,
  MCPTool,
  MCPCallToolResult,
  MCPRequest,
  MCPResponse,
  MCPNotification,
  MCPSessionState,
  MCPConnectionHealth,
  MCPUsageMetrics,
  MCPHealthCheck,
  MCPServerInfo,
  MCPTransport,
  MCPError,
  MCPConnectionError,
  MCPTimeoutError,
  MCPToolNotFoundError,
  MCPClientCapabilities,
  MCPServerCapabilities,
  MCPResource,
  MCPPrompt,
  MCPListResourcesResult,
  MCPReadResourceResult
} from './interfaces';

export abstract class MCPClientBase extends EventEmitter {
  protected server: MCPServerConfiguration;
  protected transport?: MCPTransport;
  protected sessionState: MCPSessionState;
  protected tools: Map<string, MCPTool> = new Map();
  protected resources: Map<string, MCPResource> = new Map();
  protected prompts: Map<string, MCPPrompt> = new Map();
  protected connectionHealth: MCPConnectionHealth;
  protected usageMetrics: MCPUsageMetrics;
  
  // Request tracking
  private pendingRequests: Map<string | number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timestamp: Date;
    timeout?: NodeJS.Timeout;
  }> = new Map();
  
  private requestIdCounter = 0;
  private reconnectTimer?: NodeJS.Timeout;
  private healthCheckTimer?: NodeJS.Timeout;
  
  constructor(server: MCPServerConfiguration) {
    super();
    this.server = server;
    
    this.sessionState = {
      sessionId: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      serverName: server.name,
      connected: false,
      initialized: false,
      protocolVersion: '2024-11-05',
      capabilities: {
        client: this.getClientCapabilities(),
        server: {}
      },
      lastActivity: new Date(),
      statistics: {
        requestsSent: 0,
        responsesReceived: 0,
        errorsCount: 0,
        averageResponseTime: 0,
        totalDataTransferred: 0
      }
    };

    this.connectionHealth = {
      serverName: server.name,
      status: 'disconnected',
      errorCount: 0,
      uptime: 0,
      reconnectAttempts: 0,
      capabilities: {}
    };

    this.usageMetrics = {
      serverName: server.name,
      timeWindow: {
        start: new Date(),
        end: new Date()
      },
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        dataTransferred: 0,
        mostUsedTools: [],
        errorDistribution: {}
      }
    };
  }

  // Abstract methods to be implemented by specific transport clients
  protected abstract createTransport(): Promise<MCPTransport>;

  // Public API methods
  async connect(): Promise<void> {
    try {
      this.connectionHealth.status = 'connecting';
      this.emit('connecting', this.server.name);
      
      // Create transport layer
      this.transport = await this.createTransport();
      this.setupTransportHandlers();
      
      // Connect transport
      await this.transport.connect();
      
      // Initialize MCP session
      await this.initializeSession();
      
      // Load available tools, resources, and prompts
      await this.loadServerCapabilities();
      
      this.sessionState.connected = true;
      this.sessionState.initialized = true;
      this.connectionHealth.status = 'connected';
      this.connectionHealth.uptime = Date.now();
      
      this.startHealthChecks();
      this.emit('connected', this.server.name);
      
    } catch (error) {
      this.connectionHealth.status = 'error';
      this.connectionHealth.errorCount++;
      
      const mcpError = error instanceof MCPError 
        ? error 
        : new MCPConnectionError(`Connection failed: ${error}`, this.server.name, error as Error);
      
      this.emit('error', this.server.name, mcpError);
      throw mcpError;
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.stopHealthChecks();
      this.clearPendingRequests();
      
      if (this.transport?.isConnected()) {
        await this.transport.disconnect();
      }
      
      this.sessionState.connected = false;
      this.sessionState.initialized = false;
      this.connectionHealth.status = 'disconnected';
      
      this.emit('disconnected', this.server.name);
      
    } catch (error) {
      this.emit('error', this.server.name, error);
      throw error;
    }
  }

  async callTool(name: string, args: Record<string, any>, timeout?: number): Promise<MCPCallToolResult> {
    if (!this.sessionState.connected) {
      throw new MCPConnectionError('Client not connected', this.server.name);
    }

    const tool = this.tools.get(name);
    if (!tool) {
      throw new MCPToolNotFoundError(name, this.server.name);
    }

    const startTime = Date.now();
    
    try {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: this.generateRequestId(),
        method: 'tools/call',
        params: {
          name: name,
          arguments: args
        }
      };

      const response = await this.sendRequest(request, timeout || this.server.timeout || 30000);
      
      if (response.error) {
        throw new MCPError(
          response.error.message,
          response.error.code,
          response.error.data,
          this.server.name
        );
      }

      const executionTime = Date.now() - startTime;
      this.updateUsageMetrics(name, executionTime, true);
      
      return {
        ...response.result,
        executionTime,
        context: {
          toolName: name,
          serverName: this.server.name,
          arguments: args,
          requestId: request.id.toString(),
          timestamp: new Date(),
          timeout
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateUsageMetrics(name, executionTime, false);
      this.connectionHealth.errorCount++;
      
      if (error instanceof MCPError) {
        throw error;
      } else {
        throw new MCPError(`Tool execution failed: ${error}`, -32000, { toolName: name }, this.server.name);
      }
    }
  }

  async listTools(): Promise<MCPTool[]> {
    if (!this.sessionState.connected) {
      throw new MCPConnectionError('Client not connected', this.server.name);
    }

    try {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: this.generateRequestId(),
        method: 'tools/list'
      };

      const response = await this.sendRequest(request);
      
      if (response.error) {
        throw new MCPError(
          response.error.message,
          response.error.code,
          response.error.data,
          this.server.name
        );
      }

      const tools = response.result?.tools || [];
      
      // Update tools cache
      this.tools.clear();
      tools.forEach((tool: MCPTool) => {
        tool.serverName = this.server.name;
        this.tools.set(tool.name, tool);
      });

      this.emit('toolsChanged', this.server.name, tools);
      return tools;

    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      } else {
        throw new MCPError(`Failed to list tools: ${error}`, -32000, undefined, this.server.name);
      }
    }
  }

  async listResources(): Promise<MCPListResourcesResult> {
    if (!this.sessionState.connected) {
      throw new MCPConnectionError('Client not connected', this.server.name);
    }

    try {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: this.generateRequestId(),
        method: 'resources/list'
      };

      const response = await this.sendRequest(request);
      
      if (response.error) {
        throw new MCPError(
          response.error.message,
          response.error.code,
          response.error.data,
          this.server.name
        );
      }

      const result = response.result as MCPListResourcesResult;
      
      // Update resources cache
      result.resources.forEach((resource: MCPResource) => {
        this.resources.set(resource.uri, resource);
      });

      return result;

    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      } else {
        throw new MCPError(`Failed to list resources: ${error}`, -32000, undefined, this.server.name);
      }
    }
  }

  async readResource(uri: string): Promise<MCPReadResourceResult> {
    if (!this.sessionState.connected) {
      throw new MCPConnectionError('Client not connected', this.server.name);
    }

    try {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: this.generateRequestId(),
        method: 'resources/read',
        params: { uri }
      };

      const response = await this.sendRequest(request);
      
      if (response.error) {
        throw new MCPError(
          response.error.message,
          response.error.code,
          response.error.data,
          this.server.name
        );
      }

      return response.result as MCPReadResourceResult;

    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      } else {
        throw new MCPError(`Failed to read resource: ${error}`, -32000, { uri }, this.server.name);
      }
    }
  }

  async listPrompts(): Promise<MCPPrompt[]> {
    if (!this.sessionState.connected) {
      throw new MCPConnectionError('Client not connected', this.server.name);
    }

    try {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: this.generateRequestId(),
        method: 'prompts/list'
      };

      const response = await this.sendRequest(request);
      
      if (response.error) {
        throw new MCPError(
          response.error.message,
          response.error.code,
          response.error.data,
          this.server.name
        );
      }

      const prompts = response.result?.prompts || [];
      
      // Update prompts cache
      this.prompts.clear();
      prompts.forEach((prompt: MCPPrompt) => {
        this.prompts.set(prompt.name, prompt);
      });

      return prompts;

    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      } else {
        throw new MCPError(`Failed to list prompts: ${error}`, -32000, undefined, this.server.name);
      }
    }
  }

  // Health and status methods
  async performHealthCheck(): Promise<MCPHealthCheck> {
    const startTime = Date.now();
    
    try {
      // Simple ping to check connectivity
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: this.generateRequestId(),
        method: 'ping'
      };

      await this.sendRequest(request, 5000); // 5 second timeout for health check
      
      const responseTime = Date.now() - startTime;
      this.connectionHealth.responseTime = responseTime;
      this.connectionHealth.lastPing = new Date();

      return {
        serverName: this.server.name,
        timestamp: new Date(),
        healthy: true,
        responseTime,
        details: {
          connected: this.sessionState.connected,
          toolsAvailable: this.tools.size,
          resourcesAvailable: this.resources.size,
          lastSuccessfulRequest: this.sessionState.lastActivity
        }
      };

    } catch (error) {
      return {
        serverName: this.server.name,
        timestamp: new Date(),
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: {
          connected: false,
          toolsAvailable: this.tools.size,
          resourcesAvailable: this.resources.size
        }
      };
    }
  }

  getServerInfo(): MCPServerInfo {
    return {
      name: this.server.name,
      version: this.sessionState.protocolVersion,
      description: (this.server as any).description,
      capabilities: this.sessionState.capabilities.server,
      health: this.connectionHealth as any,
      tools: Array.from(this.tools.values()),
      resources: Array.from(this.resources.values()),
      prompts: Array.from(this.prompts.values())
    };
  }

  getConnectionHealth(): MCPConnectionHealth {
    return { ...this.connectionHealth };
  }

  getUsageMetrics(): MCPUsageMetrics {
    return { ...this.usageMetrics };
  }

  getSessionState(): MCPSessionState {
    return { ...this.sessionState };
  }

  // Protected helper methods
  protected async initializeSession(): Promise<void> {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: this.generateRequestId(),
      method: 'initialize',
      params: {
        protocolVersion: this.sessionState.protocolVersion,
        capabilities: this.sessionState.capabilities.client,
        clientInfo: {
          name: 'learn-flow-maze',
          version: '1.0.0'
        }
      }
    };

    const response = await this.sendRequest(request);
    
    if (response.error) {
      throw new MCPError(
        `Initialization failed: ${response.error.message}`,
        response.error.code,
        response.error.data,
        this.server.name
      );
    }

    // Store server capabilities
    this.sessionState.capabilities.server = response.result.capabilities || {};
    
    // Send initialized notification
    const notification: MCPNotification = {
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    };

    await this.sendNotification(notification);
  }

  protected async loadServerCapabilities(): Promise<void> {
    try {
      // Load tools if supported
      if (this.sessionState.capabilities.server.tools) {
        await this.listTools();
      }

      // Load resources if supported
      if (this.sessionState.capabilities.server.resources) {
        await this.listResources();
      }

      // Load prompts if supported
      if (this.sessionState.capabilities.server.prompts) {
        await this.listPrompts();
      }
    } catch (error) {
      // Non-fatal error - log and continue
      console.warn(`Failed to load some server capabilities: ${error}`);
    }
  }

  protected setupTransportHandlers(): void {
    if (!this.transport) return;

    this.transport.onMessage((message) => {
      this.handleMessage(message);
    });

    this.transport.onError((error) => {
      this.connectionHealth.status = 'error';
      this.connectionHealth.errorCount++;
      this.emit('error', this.server.name, error);
      this.attemptReconnection();
    });

    this.transport.onClose(() => {
      this.sessionState.connected = false;
      this.connectionHealth.status = 'disconnected';
      this.emit('disconnected', this.server.name);
      this.attemptReconnection();
    });
  }

  protected handleMessage(message: MCPResponse | MCPNotification): void {
    this.sessionState.lastActivity = new Date();

    if ('id' in message) {
      // This is a response to a request
      this.handleResponse(message as MCPResponse);
    } else {
      // This is a notification
      this.handleNotification(message as MCPNotification);
    }
  }

  protected handleResponse(response: MCPResponse): void {
    const pending = this.pendingRequests.get(response.id);
    
    if (pending) {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      
      this.pendingRequests.delete(response.id);
      this.sessionState.statistics.responsesReceived++;
      
      const responseTime = Date.now() - pending.timestamp.getTime();
      this.updateAverageResponseTime(responseTime);
      
      if (response.error) {
        this.sessionState.statistics.errorsCount++;
        pending.reject(new MCPError(
          response.error.message,
          response.error.code,
          response.error.data,
          this.server.name
        ));
      } else {
        pending.resolve(response);
      }
    }
  }

  protected handleNotification(notification: MCPNotification): void {
    this.emit('notification', this.server.name, notification);

    // Handle standard notifications
    switch (notification.method) {
      case 'notifications/tools/list_changed':
        this.listTools().catch(error => {
          console.warn(`Failed to refresh tools after change notification: ${error}`);
        });
        break;
        
      case 'notifications/resources/list_changed':
        this.listResources().catch(error => {
          console.warn(`Failed to refresh resources after change notification: ${error}`);
        });
        break;
        
      case 'notifications/prompts/list_changed':
        this.listPrompts().catch(error => {
          console.warn(`Failed to refresh prompts after change notification: ${error}`);
        });
        break;
    }
  }

  protected async sendRequest(request: MCPRequest, timeoutMs?: number): Promise<MCPResponse> {
    if (!this.transport?.isConnected()) {
      throw new MCPConnectionError('Transport not connected', this.server.name);
    }

    return new Promise<MCPResponse>((resolve, reject) => {
      const timeout = timeoutMs || this.server.timeout || 30000;
      
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new MCPTimeoutError(
          `Request timed out after ${timeout}ms`,
          this.server.name,
          timeout
        ));
      }, timeout);

      this.pendingRequests.set(request.id, {
        resolve,
        reject,
        timestamp: new Date(),
        timeout: timeoutHandle
      });

      this.transport!.send(request).catch(reject);
      this.sessionState.statistics.requestsSent++;
    });
  }

  protected async sendNotification(notification: MCPNotification): Promise<void> {
    if (!this.transport?.isConnected()) {
      throw new MCPConnectionError('Transport not connected', this.server.name);
    }

    await this.transport.send(notification);
  }

  protected generateRequestId(): number {
    return ++this.requestIdCounter;
  }

  protected getClientCapabilities(): MCPClientCapabilities {
    return {
      experimental: {},
      roots: {
        listChanged: true
      },
      sampling: {}
    };
  }

  protected updateUsageMetrics(toolName: string, executionTime: number, success: boolean): void {
    this.usageMetrics.metrics.totalRequests++;
    
    if (success) {
      this.usageMetrics.metrics.successfulRequests++;
    } else {
      this.usageMetrics.metrics.failedRequests++;
    }

    // Update tool-specific metrics
    const existingTool = this.usageMetrics.metrics.mostUsedTools.find(t => t.toolName === toolName);
    if (existingTool) {
      existingTool.usageCount++;
      existingTool.averageExecutionTime = 
        (existingTool.averageExecutionTime * (existingTool.usageCount - 1) + executionTime) / existingTool.usageCount;
    } else {
      this.usageMetrics.metrics.mostUsedTools.push({
        toolName,
        usageCount: 1,
        averageExecutionTime: executionTime
      });
    }

    // Sort most used tools
    this.usageMetrics.metrics.mostUsedTools.sort((a, b) => b.usageCount - a.usageCount);
    this.usageMetrics.metrics.mostUsedTools = this.usageMetrics.metrics.mostUsedTools.slice(0, 10);
  }

  protected updateAverageResponseTime(responseTime: number): void {
    const stats = this.sessionState.statistics;
    stats.averageResponseTime = 
      (stats.averageResponseTime * (stats.responsesReceived - 1) + responseTime) / stats.responsesReceived;
  }

  protected startHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        // Health check failure is handled in performHealthCheck
      }
    }, 30000); // Health check every 30 seconds
  }

  protected stopHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  protected attemptReconnection(): void {
    if (this.server.disabled || this.reconnectTimer) {
      return;
    }

    const maxAttempts = this.server.retryAttempts || 3;
    const delay = this.server.retryDelay || 5000;

    if (this.connectionHealth.reconnectAttempts >= maxAttempts) {
      this.emit('error', this.server.name, 
        new MCPConnectionError('Max reconnection attempts reached', this.server.name));
      return;
    }

    this.connectionHealth.reconnectAttempts++;
    this.emit('reconnecting', this.server.name, this.connectionHealth.reconnectAttempts);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = undefined;
      
      try {
        await this.connect();
        this.connectionHealth.reconnectAttempts = 0;
        this.emit('reconnected', this.server.name);
      } catch (error) {
        // Will trigger another reconnection attempt
      }
    }, delay * this.connectionHealth.reconnectAttempts);
  }

  protected clearPendingRequests(): void {
    const error = new MCPConnectionError('Connection closed', this.server.name);
    
    this.pendingRequests.forEach(pending => {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      pending.reject(error);
    });
    
    this.pendingRequests.clear();
  }

  // Public getter methods
  getAvailableTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  getAvailableResources(): MCPResource[] {
    return Array.from(this.resources.values());
  }

  getAvailablePrompts(): MCPPrompt[] {
    return Array.from(this.prompts.values());
  }

  // Cleanup
  destroy(): void {
    this.stopHealthChecks();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    this.clearPendingRequests();
    this.disconnect().catch(() => {});
    this.removeAllListeners();
  }
}

export default MCPClientBase;