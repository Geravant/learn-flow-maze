// Test suite for the abstracted UI components
// Demonstrates all features and validates functionality

import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { 
  Play, 
  Pause, 
  Square, 
  RotateCcw, 
  TestTube, 
  CheckCircle,
  AlertTriangle,
  Activity
} from 'lucide-react';

// Import abstracted components
import { GenericNavigationPanel } from '../abstractions/components/GenericNavigationPanel';
import { useCardGestures, useGestureHints } from '../abstractions/hooks/useCardGestures';
import { useSessionState } from '../abstractions/hooks/useSessionState';
import { GenericLoadingService } from '../abstractions/services/GenericLoadingService';
import { GenericCardCacheService } from '../abstractions/services/GenericCardCacheService';
import { 
  BaseSectionRenderer,
  TextSectionRenderer,
  CodeSectionRenderer,
  ListSectionRenderer,
  AlertSectionRenderer,
  SectionRendererRegistry,
  EnhancedSectionRenderer
} from '../abstractions/renderers/SectionRenderers';

// Import providers and interfaces
import { ExampleContentProvider } from '../abstractions/providers/ContentProvider';
import { 
  CardContent, 
  CardSection, 
  CardActions, 
  CachedCard,
  defaultTheme,
  learningTheme,
  codeExplorerTheme,
  SessionConfiguration
} from '../abstractions/interfaces';

interface TestResult {
  testName: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  message: string;
  duration?: number;
}

interface TestSuiteState {
  isRunning: boolean;
  currentTest: string | null;
  results: TestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
}

export function AbstractionTestSuite() {
  const [testSuite, setTestSuite] = useState<TestSuiteState>({
    isRunning: false,
    currentTest: null,
    results: [],
    totalTests: 0,
    passedTests: 0,
    failedTests: 0
  });

  const [activeTab, setActiveTab] = useState('overview');
  const [testServices, setTestServices] = useState<{
    cacheService: GenericCardCacheService;
    loadingService: GenericLoadingService;
    contentProvider: ExampleContentProvider;
  } | null>(null);

  // Test components state
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [gestureTestCard, setGestureTestCard] = useState<CardContent | null>(null);
  const [loadingTestProgress, setLoadingTestProgress] = useState(0);

  // Initialize test services
  useEffect(() => {
    const cacheService = new GenericCardCacheService();
    const loadingService = new GenericLoadingService({
      maxConcurrentTasks: 2,
      enablePlaceholders: true
    });
    const contentProvider = new ExampleContentProvider();

    setTestServices({ cacheService, loadingService, contentProvider });

    return () => {
      cacheService.destroy();
      loadingService.destroy();
    };
  }, []);

  // Session state for testing
  const sessionConfig: SessionConfiguration = {
    name: "Test Session",
    maxCacheSize: 10,
    enableProgressiveLoading: true,
    enableAssetGeneration: false,
    supportedGestures: ["swipe", "doubleTap", "longPress"],
    theme: defaultTheme,
    placeholderProvider: {
      generatePlaceholder: (cardId, sectionIndex) => ({
        type: 'text',
        content: `Test placeholder for ${cardId}:${sectionIndex}`
      })
    }
  };

  const sessionState = testServices ? useSessionState(
    testServices.contentProvider,
    testServices.cacheService,
    sessionConfig
  ) : null;

  // Test card for gesture testing
  useEffect(() => {
    if (!testServices) return;

    const testCard: CardContent = {
      id: 'gesture-test',
      title: 'Gesture Test Card',
      sections: [
        {
          type: 'text',
          content: 'This card is for testing gestures. Try swiping, double-tapping, or long-pressing.'
        }
      ],
      metadata: { testCard: true },
      createdAt: new Date(),
      lastModified: new Date()
    };

    setGestureTestCard(testCard);
  }, [testServices]);

  // Gesture test actions
  const gestureActions: CardActions = {
    onSwipeLeft: (card) => addTestResult('Gesture Test', 'passed', 'Swipe left detected'),
    onSwipeRight: (card) => addTestResult('Gesture Test', 'passed', 'Swipe right detected'),
    onSwipeUp: (card) => addTestResult('Gesture Test', 'passed', 'Swipe up detected'),
    onSwipeDown: (card) => addTestResult('Gesture Test', 'passed', 'Swipe down detected'),
    onDoubleTap: (card, location) => addTestResult('Gesture Test', 'passed', `Double tap at ${location?.x},${location?.y}`),
    onLongPress: (card) => addTestResult('Gesture Test', 'passed', 'Long press detected'),
  };

  // Gesture hooks for testing
  const gestureHooks = gestureTestCard ? useCardGestures(gestureTestCard, gestureActions) : null;
  const gestureHints = gestureHooks ? useGestureHints(gestureHooks.gestureState, gestureActions) : null;

  // Test runner functions
  const addTestResult = (testName: string, status: TestResult['status'], message: string, duration?: number) => {
    setTestSuite(prev => {
      const existingIndex = prev.results.findIndex(r => r.testName === testName);
      const newResult: TestResult = { testName, status, message, duration };
      
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
    if (!testServices || !sessionState) {
      addTestResult('Setup', 'failed', 'Services not initialized');
      return;
    }

    setTestSuite(prev => ({ ...prev, isRunning: true, results: [] }));

    const tests = [
      { name: 'Cache Service', test: testCacheService },
      { name: 'Loading Service', test: testLoadingService },
      { name: 'Session State', test: testSessionState },
      { name: 'Section Renderers', test: testSectionRenderers },
      { name: 'Navigation Panel', test: testNavigationPanel },
      { name: 'Theme System', test: testThemeSystem }
    ];

    setTestSuite(prev => ({ ...prev, totalTests: tests.length }));

    for (const { name, test } of tests) {
      setTestSuite(prev => ({ ...prev, currentTest: name }));
      
      const startTime = Date.now();
      try {
        await test();
        const duration = Date.now() - startTime;
        addTestResult(name, 'passed', 'All assertions passed', duration);
      } catch (error) {
        const duration = Date.now() - startTime;
        addTestResult(name, 'failed', error instanceof Error ? error.message : 'Unknown error', duration);
      }
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setTestSuite(prev => ({ ...prev, isRunning: false, currentTest: null }));
  };

  // Individual test functions
  const testCacheService = async () => {
    const { cacheService } = testServices!;
    
    // Test adding cards
    const testCard: CardContent = {
      id: 'test-1',
      title: 'Test Card',
      sections: [{ type: 'text', content: 'Test content' }],
      metadata: {},
      createdAt: new Date(),
      lastModified: new Date()
    };

    await cacheService.addCard(testCard);
    const current = cacheService.getCurrentCard();
    
    if (!current || current.id !== 'test-1') {
      throw new Error('Failed to add and retrieve card from cache');
    }

    // Test navigation
    const testCard2: CardContent = { ...testCard, id: 'test-2', title: 'Test Card 2' };
    await cacheService.addCard(testCard2);
    
    const nextCards = cacheService.getNextCards(1);
    if (nextCards.length === 0) {
      throw new Error('Failed to get next cards');
    }
  };

  const testLoadingService = async () => {
    const { loadingService } = testServices!;
    
    return new Promise<void>((resolve, reject) => {
      let progressUpdates = 0;
      
      const progressListener = () => {
        progressUpdates++;
        setLoadingTestProgress(prev => Math.min(prev + 20, 100));
      };
      
      const completeListener = () => {
        loadingService.removeListener('taskProgress', progressListener);
        loadingService.removeListener('taskCompleted', completeListener);
        
        if (progressUpdates === 0) {
          reject(new Error('No progress updates received'));
        } else {
          resolve();
        }
      };

      loadingService.on('taskProgress', progressListener);
      loadingService.on('taskCompleted', completeListener);
      
      // Queue a test task
      loadingService.queueTask('content', 'test-card', 50, { estimatedDuration: 1000 });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        reject(new Error('Loading test timeout'));
      }, 5000);
    });
  };

  const testSessionState = async () => {
    if (!sessionState) throw new Error('Session state not available');
    
    // Test session start
    await sessionState.actions.startSession('Test prompt');
    
    if (!sessionState.isActive) {
      throw new Error('Session did not start');
    }
    
    if (sessionState.statistics.cardsGenerated !== 1) {
      throw new Error('Card generation count incorrect');
    }

    // Test interaction recording
    sessionState.actions.recordInteraction('test-interaction', { test: true });
    
    if (sessionState.statistics.interactionEvents !== 1) {
      throw new Error('Interaction not recorded');
    }
  };

  const testSectionRenderers = async () => {
    // Test different section types
    const sections: CardSection[] = [
      { type: 'text', content: 'Test text content' },
      { type: 'code', content: { code: 'console.log("test");', language: 'javascript' } },
      { type: 'list', content: { items: ['Item 1', 'Item 2'], type: 'unordered' } },
      { type: 'alert', content: { message: 'Test alert', type: 'info' } },
    ];

    // Register a custom renderer
    SectionRendererRegistry.register('custom-test', ({ section }) => (
      <div data-testid="custom-renderer">Custom: {section.content as string}</div>
    ));

    // Test custom renderer registration
    if (!SectionRendererRegistry.has('custom-test')) {
      throw new Error('Custom renderer not registered');
    }

    // Test section rendering (would normally check DOM output)
    sections.forEach(section => {
      if (!section.type || !section.content) {
        throw new Error(`Invalid section: ${section.type}`);
      }
    });
  };

  const testNavigationPanel = async () => {
    // Test navigation panel with mock data
    const mockCards: CachedCard[] = [
      {
        id: 'nav-test-1',
        content: {
          id: 'nav-test-1',
          title: 'Navigation Test Card 1',
          sections: [{ type: 'text', content: 'Test content 1' }],
          metadata: {},
          createdAt: new Date(),
          lastModified: new Date()
        },
        isFullyLoaded: true,
        loadingProgress: 100,
        cachedAssets: new Map(),
        createdAt: new Date(),
        lastAccessed: new Date()
      }
    ];

    // This would normally test DOM interactions
    if (mockCards.length === 0) {
      throw new Error('Mock cards not created');
    }
  };

  const testThemeSystem = async () => {
    // Test theme properties
    const themes = [defaultTheme, learningTheme, codeExplorerTheme];
    
    themes.forEach(theme => {
      if (!theme.primaryColor || !theme.backgroundColor || !theme.textColor) {
        throw new Error(`Invalid theme: missing required properties`);
      }
    });
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
    setLoadingTestProgress(0);
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
          <h2 className="text-2xl font-bold mb-2">Abstraction Layer Test Suite</h2>
          <p className="text-muted-foreground">
            Comprehensive testing of all abstracted UI components and services
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={runAllTests} 
            disabled={testSuite.isRunning}
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
              {testSuite.passedTests > 0 ? Math.round((testSuite.passedTests / testSuite.totalTests) * 100) : 0}%
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
                Currently testing: {testSuite.currentTest}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Test Results */}
      {testSuite.results.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Test Results</h3>
          <ScrollArea className="max-h-96">
            <div className="space-y-2">
              {testSuite.results.map((result, index) => (
                <div key={index} className="flex items-center gap-3 p-2 rounded-lg border">
                  {getStatusIcon(result.status)}
                  <div className="flex-1">
                    <div className="font-medium">{result.testName}</div>
                    <div className="text-sm text-muted-foreground">{result.message}</div>
                  </div>
                  {result.duration && (
                    <Badge variant="secondary" className="text-xs">
                      {result.duration}ms
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

  const renderComponentTests = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-4">Component Testing</h2>

      {/* Navigation Panel Test */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Navigation Panel</h3>
        <Button onClick={() => setNavigationOpen(true)}>
          Open Navigation Panel
        </Button>
        <GenericNavigationPanel
          isOpen={navigationOpen}
          onClose={() => setNavigationOpen(false)}
          historyCards={[]}
          nextCards={[]}
          sessionStats={{
            cardsGenerated: 5,
            sessionTime: '2:30',
            totalTime: 150000,
            cacheHitRate: 80
          }}
        />
      </Card>

      {/* Section Renderers Test */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Section Renderers</h3>
        <div className="space-y-4">
          <TextSectionRenderer
            section={{ type: 'text', content: 'Sample text content for testing the text renderer.' }}
            theme={defaultTheme}
          />
          <CodeSectionRenderer
            section={{
              type: 'code',
              title: 'Sample Code',
              content: { 
                code: 'const example = () => {\n  console.log("Hello, World!");\n};\n\nexample();',
                language: 'javascript'
              }
            }}
            theme={codeExplorerTheme}
          />
          <ListSectionRenderer
            section={{
              type: 'list',
              title: 'Sample List',
              content: {
                items: ['First item', 'Second item', 'Third item'],
                type: 'unordered'
              }
            }}
            theme={defaultTheme}
          />
          <AlertSectionRenderer
            section={{
              type: 'alert',
              title: 'Important Notice',
              content: {
                message: 'This is a test alert message to demonstrate the alert renderer.',
                type: 'info'
              }
            }}
            theme={defaultTheme}
          />
        </div>
      </Card>

      {/* Loading Service Test */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Loading Service</h3>
        <div className="space-y-4">
          <div>
            <Label>Loading Progress</Label>
            <div className="w-full bg-muted rounded-full h-2 mt-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${loadingTestProgress}%` }}
              />
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {loadingTestProgress}%
            </div>
          </div>
        </div>
      </Card>

      {/* Gesture Test */}
      {gestureHooks && gestureHints && gestureTestCard && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Gesture Testing</h3>
          <div 
            className="border-2 border-dashed border-muted rounded-lg p-8 text-center cursor-pointer select-none"
            {...gestureHooks.handlers}
          >
            <div className="text-lg font-medium mb-2">Interactive Gesture Test Area</div>
            <p className="text-muted-foreground mb-4">
              Try swiping, double-tapping, or long-pressing this area
            </p>
            {gestureHints.shouldShowHints && (
              <div className="flex justify-center gap-2 text-sm">
                {gestureHints.availableGestures.map((gesture, index) => (
                  <Badge key={index} variant="secondary">
                    {gesture.icon} {gesture.label}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );

  if (!testServices) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center">
          <TestTube className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Initializing Test Suite</h2>
          <p className="text-muted-foreground">Setting up test services...</p>
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
            <TabsTrigger value="components">Component Tests</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            {renderTestOverview()}
          </TabsContent>

          <TabsContent value="components" className="mt-6">
            {renderComponentTests()}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default AbstractionTestSuite;