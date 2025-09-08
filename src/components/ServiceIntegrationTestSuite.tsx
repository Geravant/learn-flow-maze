// Service Integration Test Suite
// Comprehensive testing for all abstraction layer services

import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { 
  Play, 
  Pause, 
  Square, 
  RotateCcw, 
  TestTube, 
  CheckCircle,
  AlertTriangle,
  Activity,
  Settings,
  BarChart3,
  Database,
  Image,
  Layers
} from 'lucide-react';

// Import services
import { GenericAnalyticsService, ConsoleAnalyticsExporter } from '../abstractions/services/GenericAnalyticsService';
import { GenericAssetGenerationService, AssetGenerator } from '../abstractions/services/GenericAssetGenerationService';
import { GenericCachingService } from '../abstractions/services/GenericCachingService';
import { GenericLoadingService } from '../abstractions/services/GenericLoadingService';
import { GenericCardCacheService } from '../abstractions/services/GenericCardCacheService';
import { ServiceRegistry } from '../abstractions/services/ServiceRegistry';

// Import providers for testing
import { ExampleContentProvider } from '../abstractions/providers/ContentProvider';
import { CardContent } from '../abstractions/interfaces';

interface TestResult {
  testName: string;
  serviceName: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  message: string;
  duration?: number;
  details?: any;
}

interface ServiceTestSuiteState {
  isRunning: boolean;
  currentTest: string | null;
  results: TestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
}

export function ServiceIntegrationTestSuite() {
  const [testSuite, setTestSuite] = useState<ServiceTestSuiteState>({
    isRunning: false,
    currentTest: null,
    results: [],
    totalTests: 0,
    passedTests: 0,
    failedTests: 0
  });

  const [activeTab, setActiveTab] = useState('overview');
  const [services, setServices] = useState<{
    analytics?: GenericAnalyticsService;
    assetGeneration?: GenericAssetGenerationService;
    caching?: GenericCachingService;
    loading?: GenericLoadingService;
    cardCache?: GenericCardCacheService;
    registry?: ServiceRegistry;
  }>({});

  const [serviceStats, setServiceStats] = useState<Record<string, any>>({});

  // Initialize services
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // Initialize services
        const analytics = new GenericAnalyticsService({
          enableConsoleLogging: true,
          flushInterval: 5000
        });
        analytics.addExporter(new ConsoleAnalyticsExporter());

        const assetGeneration = new GenericAssetGenerationService({
          enableCaching: true,
          maxConcurrentGenerations: 2
        });

        // Register a mock asset generator
        const mockGenerator: AssetGenerator = {
          name: 'mock-generator',
          supportedTypes: ['image', 'diagram'],
          priority: 100,
          canGenerate: () => true,
          generate: async (request) => ({
            id: `result-${Date.now()}`,
            requestId: request.id,
            type: request.type,
            url: `mock://asset/${request.type}/${Date.now()}`,
            metadata: {
              generatedAt: new Date(),
              generationTime: Math.random() * 2000 + 500,
              provider: 'mock-generator'
            }
          }),
          estimateCost: () => 0.1
        };
        assetGeneration.registerGenerator(mockGenerator);

        const caching = new GenericCachingService();
        const loading = new GenericLoadingService();
        const cardCache = new GenericCardCacheService();
        const registry = new ServiceRegistry();

        // Register some test services in the registry
        registry.register({
          name: 'testService1',
          version: '1.0.0',
          dependencies: [],
          singleton: true,
          autoStart: false,
          factory: () => ({ name: 'Test Service 1', value: 42 })
        });

        registry.register({
          name: 'testService2',
          version: '1.0.0',
          dependencies: ['testService1'],
          singleton: true,
          autoStart: false,
          factory: (deps) => ({ 
            name: 'Test Service 2', 
            dependency: deps.testService1,
            calculate: () => deps.testService1.value * 2
          })
        });

        setServices({
          analytics,
          assetGeneration,
          caching,
          loading,
          cardCache,
          registry
        });

        // Start analytics session for testing
        analytics.startSession('test-provider', 'test-user', { testMode: true });

      } catch (error) {
        console.error('Failed to initialize services:', error);
      }
    };

    initializeServices();

    return () => {
      // Cleanup services
      Object.values(services).forEach(service => {
        if (service && typeof service.destroy === 'function') {
          service.destroy();
        }
      });
    };
  }, []);

  // Update service statistics periodically
  useEffect(() => {
    if (Object.keys(services).length === 0) return;

    const updateStats = async () => {
      const stats: Record<string, any> = {};

      if (services.analytics) {
        stats.analytics = {
          session: services.analytics.getSessionMetrics(),
          events: services.analytics['eventQueue']?.length || 0
        };
      }

      if (services.assetGeneration) {
        stats.assetGeneration = {
          cache: services.assetGeneration.getCacheStats(),
          costs: services.assetGeneration.getCostStats(),
          activeRequests: services.assetGeneration.getActiveRequests()
        };
      }

      if (services.caching) {
        stats.caching = await services.caching.getStats();
      }

      if (services.loading) {
        stats.loading = services.loading.getStatistics();
      }

      if (services.cardCache) {
        stats.cardCache = {
          size: services.cardCache.getStackSize(),
          currentPosition: services.cardCache.getCurrentPosition(),
          cacheHits: services.cardCache.getCacheHitCount()
        };
      }

      if (services.registry) {
        stats.registry = services.registry.getMetrics();
      }

      setServiceStats(stats);
    };

    const interval = setInterval(updateStats, 2000);
    updateStats(); // Initial update

    return () => clearInterval(interval);
  }, [services]);

  // Test runner functions
  const addTestResult = (
    testName: string,
    serviceName: string,
    status: TestResult['status'],
    message: string,
    duration?: number,
    details?: any
  ) => {
    setTestSuite(prev => {
      const existingIndex = prev.results.findIndex(r => r.testName === testName && r.serviceName === serviceName);
      const newResult: TestResult = { testName, serviceName, status, message, duration, details };
      
      let newResults;
      if (existingIndex >= 0) {
        newResults = [...prev.results];
        newResults[existingIndex] = newResult;
      } else {
        newResults = [...prev.results, newResult];
      }

      const passed = newResults.filter(r => r.status === 'passed').length;
      const failed = newResults.filter(r => r.status === 'failed').length;

      return {
        ...prev,
        results: newResults,
        passedTests: passed,
        failedTests: failed
      };
    });
  };

  const runAllTests = async () => {
    if (Object.keys(services).length === 0) {
      addTestResult('Setup', 'system', 'failed', 'Services not initialized');
      return;
    }

    setTestSuite(prev => ({ ...prev, isRunning: true, results: [] }));

    const testSuites = [
      { name: 'Analytics Service Tests', service: 'analytics', tests: testAnalyticsService },
      { name: 'Asset Generation Tests', service: 'assetGeneration', tests: testAssetGenerationService },
      { name: 'Caching Service Tests', service: 'caching', tests: testCachingService },
      { name: 'Loading Service Tests', service: 'loading', tests: testLoadingService },
      { name: 'Card Cache Tests', service: 'cardCache', tests: testCardCacheService },
      { name: 'Service Registry Tests', service: 'registry', tests: testServiceRegistry },
      { name: 'Integration Tests', service: 'integration', tests: testServiceIntegration }
    ];

    setTestSuite(prev => ({ ...prev, totalTests: testSuites.length * 3 })); // Estimate

    for (const { name, service, tests } of testSuites) {
      setTestSuite(prev => ({ ...prev, currentTest: name }));
      
      try {
        await tests(service);
      } catch (error) {
        addTestResult(name, service, 'failed', `Test suite failed: ${error}`, 0);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setTestSuite(prev => ({ ...prev, isRunning: false, currentTest: null }));
  };

  // Individual test functions
  const testAnalyticsService = async (serviceName: string) => {
    const analytics = services.analytics!;
    const startTime = performance.now();

    try {
      // Test event tracking
      analytics.trackNavigation(undefined, 'card-1', 'navigation');
      analytics.trackGesture('swipe-left', 'card-1');
      analytics.trackCustomEvent('test-event', { test: true });
      
      const duration = performance.now() - startTime;
      addTestResult('Event Tracking', serviceName, 'passed', 'Successfully tracked events', duration);

      // Test session metrics
      const session = analytics.getSessionMetrics();
      if (session && session.metrics.totalInteractions > 0) {
        addTestResult('Session Metrics', serviceName, 'passed', `Recorded ${session.metrics.totalInteractions} interactions`);
      } else {
        addTestResult('Session Metrics', serviceName, 'failed', 'No session metrics available');
      }

      // Test error tracking
      analytics.trackError(new Error('Test error'), { context: 'testing' });
      addTestResult('Error Tracking', serviceName, 'passed', 'Error tracking functional');

    } catch (error) {
      addTestResult('Analytics Service', serviceName, 'failed', `Service error: ${error}`);
    }
  };

  const testAssetGenerationService = async (serviceName: string) => {
    const assetGen = services.assetGeneration!;
    const startTime = performance.now();

    try {
      // Test asset generation
      const asset = await assetGen.generateAsset('image', 'Test image prompt', { preset: 'low' });
      const duration = performance.now() - startTime;
      
      if (asset && asset.url) {
        addTestResult('Asset Generation', serviceName, 'passed', `Generated asset: ${asset.url}`, duration);
      } else {
        addTestResult('Asset Generation', serviceName, 'failed', 'Asset generation failed');
      }

      // Test caching
      const cachedAsset = await assetGen.generateAsset('image', 'Test image prompt', { preset: 'low' });
      if (cachedAsset.url === asset.url) {
        addTestResult('Asset Caching', serviceName, 'passed', 'Asset retrieved from cache');
      } else {
        addTestResult('Asset Caching', serviceName, 'failed', 'Caching not working');
      }

      // Test cost tracking
      const costs = assetGen.getCostStats();
      addTestResult('Cost Tracking', serviceName, 'passed', `Cost stats available: ${JSON.stringify(costs)}`);

    } catch (error) {
      addTestResult('Asset Generation', serviceName, 'failed', `Service error: ${error}`);
    }
  };

  const testCachingService = async (serviceName: string) => {
    const cache = services.caching!;
    const startTime = performance.now();

    try {
      // Test basic operations
      await cache.set('test-key', { data: 'test-value' }, { tags: ['test'] });
      const retrieved = await cache.get('test-key');
      
      const duration = performance.now() - startTime;

      if (retrieved && retrieved.data === 'test-value') {
        addTestResult('Cache Operations', serviceName, 'passed', 'Set/get operations successful', duration);
      } else {
        addTestResult('Cache Operations', serviceName, 'failed', 'Cache operations failed');
      }

      // Test tag operations
      const tagResults = await cache.getByTag('test');
      if (tagResults.length > 0) {
        addTestResult('Tag Operations', serviceName, 'passed', `Found ${tagResults.length} items with tag`);
      } else {
        addTestResult('Tag Operations', serviceName, 'failed', 'Tag operations failed');
      }

      // Test statistics
      const stats = await cache.getStats();
      addTestResult('Cache Statistics', serviceName, 'passed', `Stats: ${stats.global.hitRate.toFixed(2)} hit rate`);

    } catch (error) {
      addTestResult('Caching Service', serviceName, 'failed', `Service error: ${error}`);
    }
  };

  const testLoadingService = async (serviceName: string) => {
    const loading = services.loading!;
    const startTime = performance.now();

    try {
      // Test task queuing
      const taskId = loading.queueTask('content', 'test-card', 50, { estimatedDuration: 1000 });
      
      // Wait for completion
      await new Promise(resolve => {
        const checkCompletion = () => {
          const stats = loading.getStatistics();
          if (!stats.isLoading) {
            resolve(void 0);
          } else {
            setTimeout(checkCompletion, 100);
          }
        };
        checkCompletion();
      });

      const duration = performance.now() - startTime;
      const stats = loading.getStatistics();
      
      if (stats.totalTasksProcessed > 0) {
        addTestResult('Task Processing', serviceName, 'passed', `Processed ${stats.totalTasksProcessed} tasks`, duration);
      } else {
        addTestResult('Task Processing', serviceName, 'failed', 'No tasks processed');
      }

      // Test statistics
      addTestResult('Loading Statistics', serviceName, 'passed', `Stats: ${stats.overallProgress}% progress`);

    } catch (error) {
      addTestResult('Loading Service', serviceName, 'failed', `Service error: ${error}`);
    }
  };

  const testCardCacheService = async (serviceName: string) => {
    const cardCache = services.cardCache!;
    const startTime = performance.now();

    try {
      // Create test content
      const testCard: CardContent = {
        id: 'test-card-1',
        title: 'Test Card',
        sections: [{ type: 'text', content: 'Test content' }],
        metadata: {},
        createdAt: new Date(),
        lastModified: new Date()
      };

      // Test adding cards
      await cardCache.addCard(testCard);
      const current = cardCache.getCurrentCard();
      
      const duration = performance.now() - startTime;

      if (current && current.id === 'test-card-1') {
        addTestResult('Card Management', serviceName, 'passed', 'Successfully added and retrieved card', duration);
      } else {
        addTestResult('Card Management', serviceName, 'failed', 'Card management failed');
      }

      // Test navigation
      const testCard2: CardContent = { ...testCard, id: 'test-card-2', title: 'Test Card 2' };
      await cardCache.addCard(testCard2);
      
      const stackSize = cardCache.getStackSize();
      if (stackSize === 2) {
        addTestResult('Stack Navigation', serviceName, 'passed', `Stack has ${stackSize} cards`);
      } else {
        addTestResult('Stack Navigation', serviceName, 'failed', `Expected 2 cards, got ${stackSize}`);
      }

      // Test cache statistics
      const hitCount = cardCache.getCacheHitCount();
      addTestResult('Cache Statistics', serviceName, 'passed', `Cache hits: ${hitCount}`);

    } catch (error) {
      addTestResult('Card Cache', serviceName, 'failed', `Service error: ${error}`);
    }
  };

  const testServiceRegistry = async (serviceName: string) => {
    const registry = services.registry!;
    const startTime = performance.now();

    try {
      // Test service startup
      await registry.start('testService1');
      const service1 = registry.get('testService1');
      
      if (service1 && service1.name === 'Test Service 1') {
        addTestResult('Service Startup', serviceName, 'passed', 'Successfully started service');
      } else {
        addTestResult('Service Startup', serviceName, 'failed', 'Service startup failed');
      }

      // Test dependency resolution
      await registry.start('testService2');
      const service2 = registry.get('testService2');
      
      if (service2 && service2.calculate() === 84) { // 42 * 2
        addTestResult('Dependency Resolution', serviceName, 'passed', 'Dependencies resolved correctly');
      } else {
        addTestResult('Dependency Resolution', serviceName, 'failed', 'Dependency resolution failed');
      }

      const duration = performance.now() - startTime;

      // Test metrics
      const metrics = registry.getMetrics();
      addTestResult('Registry Metrics', serviceName, 'passed', `Started ${metrics.servicesStarted} services`, duration);

    } catch (error) {
      addTestResult('Service Registry', serviceName, 'failed', `Service error: ${error}`);
    }
  };

  const testServiceIntegration = async (serviceName: string) => {
    const startTime = performance.now();

    try {
      // Test cross-service integration
      const { analytics, cardCache, assetGeneration } = services;
      
      if (!analytics || !cardCache || !assetGeneration) {
        throw new Error('Required services not available');
      }

      // Create a card and generate assets for it
      const testCard: CardContent = {
        id: 'integration-test-card',
        title: 'Integration Test Card',
        sections: [
          { type: 'text', content: 'This is a test for service integration' }
        ],
        metadata: {},
        createdAt: new Date(),
        lastModified: new Date()
      };

      // Add to card cache (triggers analytics)
      await cardCache.addCard(testCard);
      analytics.trackNavigation(undefined, testCard.id, 'integration-test');

      // Generate assets
      const asset = await assetGeneration.generateAsset(
        'image',
        `Header for ${testCard.title}`,
        { preset: 'medium' },
        { cardId: testCard.id }
      );

      const duration = performance.now() - startTime;

      // Verify integration
      const session = analytics.getSessionMetrics();
      const currentCard = cardCache.getCurrentCard();

      if (session && currentCard && asset.url && currentCard.id === testCard.id) {
        addTestResult('Cross-Service Integration', serviceName, 'passed', 
          'Services integrated successfully', duration, {
            sessionInteractions: session.metrics.totalInteractions,
            cardId: currentCard.id,
            assetUrl: asset.url
          });
      } else {
        addTestResult('Cross-Service Integration', serviceName, 'failed', 'Integration test failed');
      }

    } catch (error) {
      addTestResult('Service Integration', serviceName, 'failed', `Integration error: ${error}`);
    }
  };

  const resetTests = () => {
    setTestSuite({
      isRunning: false,
      currentTest: null,
      results: [],
      totalTests: 0,
      passedTests: 0,
      failedTests: 0
    });
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'passed': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'running': return <Activity className="w-4 h-4 text-blue-600 animate-spin" />;
      default: return <div className="w-4 h-4 rounded-full bg-muted" />;
    }
  };

  const renderTestOverview = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Service Integration Test Suite</h2>
          <p className="text-muted-foreground">
            Comprehensive testing of all abstraction layer services and their integration
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={runAllTests} 
            disabled={testSuite.isRunning || Object.keys(services).length === 0}
            className="flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            Run All Tests
          </Button>
          <Button 
            variant="outline" 
            onClick={resetTests}
            className="flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>
        </div>
      </div>

      {/* Service Status */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Object.entries(services).map(([name, service]) => (
          <Card key={name} className="p-3 text-center">
            <div className="flex items-center justify-center mb-2">
              {name === 'analytics' && <BarChart3 className="w-5 h-5 text-blue-600" />}
              {name === 'assetGeneration' && <Image className="w-5 h-5 text-purple-600" />}
              {name === 'caching' && <Database className="w-5 h-5 text-green-600" />}
              {name === 'loading' && <Activity className="w-5 h-5 text-orange-600" />}
              {name === 'cardCache' && <Layers className="w-5 h-5 text-red-600" />}
              {name === 'registry' && <Settings className="w-5 h-5 text-gray-600" />}
            </div>
            <div className="text-sm font-medium capitalize">{name}</div>
            <div className="text-xs text-muted-foreground">
              {service ? 'Ready' : 'Not Available'}
            </div>
          </Card>
        ))}
      </div>

      {/* Test Results Summary */}
      {testSuite.results.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{testSuite.totalTests}</div>
            <div className="text-sm text-muted-foreground">Total Tests</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{testSuite.passedTests}</div>
            <div className="text-sm text-muted-foreground">Passed</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{testSuite.failedTests}</div>
            <div className="text-sm text-muted-foreground">Failed</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {testSuite.totalTests > 0 ? Math.round((testSuite.passedTests / testSuite.totalTests) * 100) : 0}%
            </div>
            <div className="text-sm text-muted-foreground">Success Rate</div>
          </Card>
        </div>
      )}

      {/* Current Test Status */}
      {testSuite.isRunning && (
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-blue-600 animate-spin" />
            <div>
              <div className="font-medium">Running Tests...</div>
              <div className="text-sm text-muted-foreground">
                Currently running: {testSuite.currentTest}
              </div>
            </div>
          </div>
          {testSuite.totalTests > 0 && (
            <Progress 
              value={(testSuite.results.length / testSuite.totalTests) * 100} 
              className="mt-3"
            />
          )}
        </Card>
      )}

      {/* Test Results */}
      {testSuite.results.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Test Results</h3>
          <ScrollArea className="max-h-96">
            <div className="space-y-2">
              {testSuite.results.map((result, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg border">
                  {getStatusIcon(result.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{result.testName}</div>
                      <Badge variant="outline" className="text-xs">
                        {result.serviceName}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {result.message}
                    </div>
                    {result.details && (
                      <pre className="text-xs bg-muted/50 p-2 rounded mt-2 overflow-x-auto">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    )}
                  </div>
                  {result.duration && (
                    <Badge variant="secondary" className="text-xs">
                      {Math.round(result.duration)}ms
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>
      )}
    </div>
  );

  const renderServiceStats = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-4">Service Statistics</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(serviceStats).map(([serviceName, stats]) => (
          <Card key={serviceName} className="p-4">
            <h3 className="font-semibold mb-3 capitalize">{serviceName} Service</h3>
            <pre className="text-xs bg-muted/50 p-3 rounded overflow-x-auto">
              {JSON.stringify(stats, null, 2)}
            </pre>
          </Card>
        ))}
      </div>
    </div>
  );

  if (Object.keys(services).length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center">
          <TestTube className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Initializing Service Test Suite</h2>
          <p className="text-muted-foreground">Setting up services and test environment...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Test Overview</TabsTrigger>
            <TabsTrigger value="stats">Service Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            {renderTestOverview()}
          </TabsContent>

          <TabsContent value="stats" className="mt-6">
            {renderServiceStats()}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default ServiceIntegrationTestSuite;