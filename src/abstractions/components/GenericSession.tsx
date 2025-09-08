// Generic Session Manager Component
// Based on UI-logic-abstraction.md design document

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { GenericCard } from './GenericCard';
import { GenericCardCacheService } from '../services/GenericCardCacheService';
import { 
  GenericSessionProps, 
  CardContent, 
  CachedCard, 
  SessionStats,
  CardActions,
  SessionConfiguration,
  ContentProvider
} from '../interfaces';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { useToast } from '../../hooks/use-toast';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  TrendingUp, 
  Clock,
  Layers,
  Zap,
  Brain
} from 'lucide-react';

export function GenericSession({
  contentProvider,
  initialPrompt,
  sessionConfig,
  onComplete,
  onError
}: GenericSessionProps) {
  // Core session state
  const [currentCard, setCurrentCard] = useState<CardContent | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Session statistics
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    cardsGenerated: 0,
    totalTime: 0,
    averageLoadTime: 0,
    errorsEncountered: 0,
    cacheHitRate: 0
  });
  
  // Cache and navigation
  const cacheService = useRef<GenericCardCacheService>();
  const [historyCards, setHistoryCards] = useState<CachedCard[]>([]);
  const [nextTopicCards, setNextTopicCards] = useState<CachedCard[]>([]);
  
  // Session timing
  const sessionStartTime = useRef<Date | null>(null);
  const cardLoadStartTime = useRef<Date | null>(null);
  
  const { toast } = useToast();

  // Initialize cache service
  useEffect(() => {
    cacheService.current = new GenericCardCacheService(sessionConfig.maxCacheSize);
    
    // Set up event listeners
    const cache = cacheService.current;
    
    cache.on('cardAdded', () => updateNavigationState());
    cache.on('navigationChanged', ({ card }) => {
      setCurrentCard(card.content);
      updateSessionStats();
    });
    cache.on('cardLoaded', ({ card }) => {
      updateNavigationState();
      updateSessionStats();
    });
    cache.on('cardLoadError', ({ prompt, error }) => {
      handleError(new Error(`Failed to load card: ${error}`));
    });

    return () => {
      cache.removeAllListeners();
    };
  }, [sessionConfig.maxCacheSize]);

  // Start session if initial prompt is provided
  useEffect(() => {
    if (initialPrompt && !sessionStartTime.current) {
      startSession(initialPrompt);
    }
  }, [initialPrompt]);

  // Session management methods
  const startSession = useCallback(async (prompt: string) => {
    if (!cacheService.current) return;

    setIsActive(true);
    setIsLoading(true);
    sessionStartTime.current = new Date();
    cardLoadStartTime.current = new Date();

    try {
      await generateCard(prompt);
      toast({
        title: "Session Started",
        description: `Started ${sessionConfig.name} session`,
      });
    } catch (error) {
      handleError(error as Error);
    }
  }, [sessionConfig.name, toast]);

  const pauseSession = useCallback(() => {
    setIsActive(false);
    toast({
      title: "Session Paused",
      description: "Session has been paused",
    });
  }, [toast]);

  const resumeSession = useCallback(() => {
    setIsActive(true);
    toast({
      title: "Session Resumed",
      description: "Session has been resumed",
    });
  }, [toast]);

  const resetSession = useCallback(() => {
    if (!cacheService.current) return;

    cacheService.current.clear();
    setCurrentCard(null);
    setIsActive(false);
    setIsLoading(false);
    sessionStartTime.current = null;
    setSessionStats({
      cardsGenerated: 0,
      totalTime: 0,
      averageLoadTime: 0,
      errorsEncountered: 0,
      cacheHitRate: 0
    });
    updateNavigationState();
    
    toast({
      title: "Session Reset",
      description: "Session has been reset",
    });
  }, [toast]);

  const completeSession = useCallback(() => {
    if (!sessionStartTime.current) return;

    const finalStats = {
      ...sessionStats,
      totalTime: Date.now() - sessionStartTime.current.getTime()
    };
    
    setIsActive(false);
    onComplete?.(finalStats);
    
    toast({
      title: "Session Complete",
      description: `Generated ${finalStats.cardsGenerated} cards in ${Math.round(finalStats.totalTime / 1000)}s`,
    });
  }, [sessionStats, onComplete, toast]);

  // Content generation
  const generateCard = useCallback(async (prompt: string, options?: any) => {
    if (!cacheService.current) return;

    setIsLoading(true);
    cardLoadStartTime.current = new Date();

    try {
      let content: CardContent;
      
      if (sessionConfig.enableProgressiveLoading && 'generateProgressively' in contentProvider) {
        // Progressive generation
        content = await (contentProvider as any).generateProgressively(
          prompt,
          (section) => {
            // Handle progressive section updates
            console.log('Progressive section loaded:', section.title);
          },
          options
        );
      } else {
        // Standard generation
        content = await contentProvider.generateContent(prompt, options);
      }

      // Create cached card
      const cachedCard: CachedCard = {
        id: content.id,
        content,
        loadingProgress: 100,
        isFullyLoaded: true,
        lastAccessed: new Date(),
        createdAt: new Date(),
        metadata: { prompt, provider: contentProvider.name }
      };

      // Generate assets if enabled
      if (sessionConfig.enableAssetGeneration) {
        await cacheService.current.generateAssets(
          cachedCard.id,
          ['image'], // Could be configurable
          (type, asset) => {
            console.log(`Generated ${type} asset:`, asset);
          }
        );
      }

      // Add to cache and set as current
      cacheService.current.addCardToStack(cachedCard);
      setCurrentCard(content);

      // Update statistics
      updateSessionStats();

    } catch (error) {
      handleError(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [contentProvider, sessionConfig]);

  // Navigation methods
  const navigateToNext = useCallback(() => {
    if (!cacheService.current) return;
    
    const nextCard = cacheService.current.navigateToNext();
    if (nextCard) {
      setCurrentCard(nextCard.content);
    } else {
      toast({
        title: "End of Stack",
        description: "No more cards available in the forward direction",
      });
    }
  }, [toast]);

  const navigateToPrevious = useCallback(() => {
    if (!cacheService.current) return;
    
    const prevCard = cacheService.current.navigateToPrevious();
    if (prevCard) {
      setCurrentCard(prevCard.content);
    } else {
      toast({
        title: "Beginning of Stack",
        description: "No more cards available in the backward direction",
      });
    }
  }, [toast]);

  const navigateToCard = useCallback((cardId: string) => {
    if (!cacheService.current) return;
    
    const card = cacheService.current.jumpToCard(cardId);
    if (card) {
      setCurrentCard(card.content);
    }
  }, []);

  // Card actions
  const cardActions: CardActions = {
    onSwipeUp: (content) => {
      // Could be customized based on session config
      generateCard(`More about: ${content.title}`);
    },
    
    onSwipeDown: (content) => {
      // Generate related content
      generateCard(`Related to: ${content.title}`);
    },
    
    onSwipeLeft: () => {
      navigateToPrevious();
    },
    
    onSwipeRight: () => {
      navigateToNext();
    },
    
    onDoubleTap: (content, location) => {
      // Quick action based on location
      const sectionIndex = Math.floor(location.y / 100); // Rough section detection
      const section = content.sections[sectionIndex];
      if (section) {
        generateCard(`Explain more about: ${section.title || section.type}`);
      }
    },
    
    onLongPress: (content) => {
      // Show content options or regenerate
      generateCard(`Alternative explanation of: ${content.title}`);
    },
    
    onSectionTap: (section, content) => {
      generateCard(`Deep dive into: ${section.title || section.type} of ${content.title}`);
    }
  };

  // Helper methods
  const updateNavigationState = useCallback(() => {
    if (!cacheService.current) return;
    
    setHistoryCards(cacheService.current.getHistory());
    setNextTopicCards(cacheService.current.getNextTopics());
  }, []);

  const updateSessionStats = useCallback(() => {
    if (!cacheService.current || !sessionStartTime.current || !cardLoadStartTime.current) return;

    const cache = cacheService.current;
    const stats = cache.getStackStats();
    const currentTime = Date.now();
    const totalTime = currentTime - sessionStartTime.current.getTime();
    const lastCardLoadTime = currentTime - cardLoadStartTime.current.getTime();

    setSessionStats(prev => ({
      cardsGenerated: stats.totalCards,
      totalTime,
      averageLoadTime: prev.cardsGenerated > 0 
        ? (prev.averageLoadTime * (prev.cardsGenerated - 1) + lastCardLoadTime) / prev.cardsGenerated
        : lastCardLoadTime,
      errorsEncountered: prev.errorsEncountered,
      cacheHitRate: stats.totalCards > 0 ? (stats.fullyLoadedCount / stats.totalCards) * 100 : 0
    }));
  }, []);

  const handleError = useCallback((error: Error) => {
    setSessionStats(prev => ({
      ...prev,
      errorsEncountered: prev.errorsEncountered + 1
    }));
    
    onError?.(error);
    
    toast({
      title: "Session Error",
      description: error.message,
      variant: "destructive",
    });
  }, [onError, toast]);

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="generic-session w-full max-w-4xl mx-auto p-4 space-y-6">
      {/* Session Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">{sessionConfig.name}</h1>
          <Badge variant={isActive ? "default" : "secondary"}>
            {isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          {isActive ? (
            <Button variant="outline" size="sm" onClick={pauseSession}>
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={resumeSession}>
              <Play className="w-4 h-4 mr-2" />
              Resume
            </Button>
          )}
          
          <Button variant="outline" size="sm" onClick={resetSession}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          
          <Button variant="default" size="sm" onClick={completeSession}>
            <TrendingUp className="w-4 h-4 mr-2" />
            Complete
          </Button>
        </div>
      </div>

      {/* Session Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <Layers className="w-5 h-5 mx-auto mb-2 text-primary" />
          <div className="text-2xl font-bold">{sessionStats.cardsGenerated}</div>
          <div className="text-sm text-muted-foreground">Cards Generated</div>
        </div>
        
        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <Clock className="w-5 h-5 mx-auto mb-2 text-primary" />
          <div className="text-2xl font-bold">{formatTime(sessionStats.totalTime)}</div>
          <div className="text-sm text-muted-foreground">Total Time</div>
        </div>
        
        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <Zap className="w-5 h-5 mx-auto mb-2 text-primary" />
          <div className="text-2xl font-bold">{formatTime(sessionStats.averageLoadTime)}</div>
          <div className="text-sm text-muted-foreground">Avg Load Time</div>
        </div>
        
        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <TrendingUp className="w-5 h-5 mx-auto mb-2 text-primary" />
          <div className="text-2xl font-bold">{Math.round(sessionStats.cacheHitRate)}%</div>
          <div className="text-sm text-muted-foreground">Cache Hit Rate</div>
        </div>
      </div>

      {/* Main Card Display */}
      <div className="relative">
        <AnimatePresence mode="wait">
          {currentCard ? (
            <GenericCard
              key={currentCard.id}
              content={currentCard}
              actions={cardActions}
              isActive={isActive && !isLoading}
              theme={sessionConfig.theme}
            />
          ) : (
            <div className="flex items-center justify-center h-96 border-2 border-dashed border-muted-foreground/25 rounded-lg">
              <div className="text-center text-muted-foreground">
                <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">No content loaded</p>
                <p className="text-sm">
                  {initialPrompt 
                    ? "Loading content..." 
                    : "Provide a prompt to start generating content"
                  }
                </p>
              </div>
            </div>
          )}
        </AnimatePresence>
        
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-sm text-muted-foreground">Generating content...</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Indicators */}
      {(historyCards.length > 0 || nextTopicCards.length > 0) && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            {historyCards.length > 0 && (
              <Badge variant="outline">
                ← {historyCards.length} previous
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {nextTopicCards.length > 0 && (
              <Badge variant="outline">
                {nextTopicCards.length} next →
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default GenericSession;