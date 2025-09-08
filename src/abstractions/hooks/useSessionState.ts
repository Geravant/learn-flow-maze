// Session state management hook
// Provides centralized session state, statistics tracking, and provider interactions

import { useState, useEffect, useCallback, useRef } from 'react';
import { ContentProvider, SessionConfiguration, CardContent } from '../interfaces';
import { GenericCardCacheService } from '../services/GenericCardCacheService';

export interface SessionStatistics {
  cardsGenerated: number;
  sessionTime: string;
  totalTime: number;
  cacheHitRate: number;
  navigationEvents: number;
  interactionEvents: number;
  averageTimePerCard: number;
  sessionStartTime: Date;
  lastActivityTime: Date;
  errorCount: number;
  successfulGenerations: number;
}

export interface SessionState {
  isActive: boolean;
  isLoading: boolean;
  currentPrompt: string | null;
  currentCardId: string | null;
  lastError: Error | null;
  statistics: SessionStatistics;
  hasNextCard: boolean;
  hasPreviousCard: boolean;
  navigationHistory: string[];
}

export interface SessionActions {
  startSession: (prompt: string) => Promise<void>;
  endSession: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  generateNextCard: (prompt?: string) => Promise<void>;
  navigateToCard: (cardId: string) => void;
  goToNextCard: () => void;
  goToPreviousCard: () => void;
  clearError: () => void;
  updateStatistics: (updates: Partial<SessionStatistics>) => void;
  recordInteraction: (type: string, data?: any) => void;
}

const createInitialStatistics = (): SessionStatistics => ({
  cardsGenerated: 0,
  sessionTime: '0:00',
  totalTime: 0,
  cacheHitRate: 0,
  navigationEvents: 0,
  interactionEvents: 0,
  averageTimePerCard: 0,
  sessionStartTime: new Date(),
  lastActivityTime: new Date(),
  errorCount: 0,
  successfulGenerations: 0
});

const createInitialState = (): SessionState => ({
  isActive: false,
  isLoading: false,
  currentPrompt: null,
  currentCardId: null,
  lastError: null,
  statistics: createInitialStatistics(),
  hasNextCard: false,
  hasPreviousCard: false,
  navigationHistory: []
});

export function useSessionState(
  contentProvider: ContentProvider,
  cacheService: GenericCardCacheService,
  config: SessionConfiguration
) {
  const [sessionState, setSessionState] = useState<SessionState>(createInitialState());
  const [isSessionPaused, setIsSessionPaused] = useState(false);
  
  // Refs for tracking
  const sessionStartRef = useRef<Date | null>(null);
  const statisticsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cardStartTimeRef = useRef<Date | null>(null);

  // Format time helper
  const formatTime = useCallback((ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  // Update session time periodically
  useEffect(() => {
    if (sessionState.isActive && !isSessionPaused) {
      statisticsTimerRef.current = setInterval(() => {
        const now = new Date();
        const totalTime = sessionStartRef.current 
          ? now.getTime() - sessionStartRef.current.getTime() 
          : 0;

        setSessionState(prev => ({
          ...prev,
          statistics: {
            ...prev.statistics,
            totalTime,
            sessionTime: formatTime(totalTime),
            lastActivityTime: now
          }
        }));
      }, 1000);

      return () => {
        if (statisticsTimerRef.current) {
          clearInterval(statisticsTimerRef.current);
          statisticsTimerRef.current = null;
        }
      };
    }
  }, [sessionState.isActive, isSessionPaused, formatTime]);

  // Listen to cache service events
  useEffect(() => {
    const handleCacheUpdate = () => {
      const currentCard = cacheService.getCurrentCard();
      const nextCard = cacheService.getNextCards(1)[0];
      const prevCards = cacheService.getPreviousCards(1);
      
      setSessionState(prev => ({
        ...prev,
        currentCardId: currentCard?.id || null,
        hasNextCard: !!nextCard,
        hasPreviousCard: prevCards.length > 0
      }));
    };

    const handleNavigation = (data: { fromCardId?: string; toCardId: string }) => {
      setSessionState(prev => ({
        ...prev,
        statistics: {
          ...prev.statistics,
          navigationEvents: prev.statistics.navigationEvents + 1
        },
        navigationHistory: [...prev.navigationHistory, data.toCardId].slice(-10) // Keep last 10
      }));

      // Update average time per card if we have a start time
      if (cardStartTimeRef.current) {
        const timeOnCard = Date.now() - cardStartTimeRef.current.getTime();
        setSessionState(prev => {
          const totalCardTime = prev.statistics.averageTimePerCard * prev.statistics.navigationEvents;
          const newAverage = (totalCardTime + timeOnCard) / (prev.statistics.navigationEvents + 1);
          
          return {
            ...prev,
            statistics: {
              ...prev.statistics,
              averageTimePerCard: newAverage
            }
          };
        });
      }
      
      cardStartTimeRef.current = new Date();
    };

    const handleError = (error: Error) => {
      setSessionState(prev => ({
        ...prev,
        lastError: error,
        statistics: {
          ...prev.statistics,
          errorCount: prev.statistics.errorCount + 1
        }
      }));
    };

    cacheService.on('cacheUpdated', handleCacheUpdate);
    cacheService.on('cardNavigation', handleNavigation);
    cacheService.on('error', handleError);

    return () => {
      cacheService.removeListener('cacheUpdated', handleCacheUpdate);
      cacheService.removeListener('cardNavigation', handleNavigation);
      cacheService.removeListener('error', handleError);
    };
  }, [cacheService]);

  // Session actions
  const startSession = useCallback(async (prompt: string) => {
    try {
      setSessionState(prev => ({
        ...prev,
        isActive: true,
        isLoading: true,
        currentPrompt: prompt,
        lastError: null
      }));

      sessionStartRef.current = new Date();
      cardStartTimeRef.current = new Date();

      // Clear existing cache
      cacheService.clearCache();

      // Generate initial card
      const content = await contentProvider.generateContent(prompt);
      await cacheService.addCard(content, true);

      setSessionState(prev => ({
        ...prev,
        isLoading: false,
        statistics: {
          ...prev.statistics,
          cardsGenerated: 1,
          successfulGenerations: 1,
          sessionStartTime: sessionStartRef.current!
        }
      }));

    } catch (error) {
      setSessionState(prev => ({
        ...prev,
        isLoading: false,
        lastError: error as Error,
        statistics: {
          ...prev.statistics,
          errorCount: prev.statistics.errorCount + 1
        }
      }));
      throw error;
    }
  }, [contentProvider, cacheService]);

  const endSession = useCallback(() => {
    setSessionState(createInitialState());
    setIsSessionPaused(false);
    sessionStartRef.current = null;
    cardStartTimeRef.current = null;
    
    if (statisticsTimerRef.current) {
      clearInterval(statisticsTimerRef.current);
      statisticsTimerRef.current = null;
    }
  }, []);

  const pauseSession = useCallback(() => {
    setIsSessionPaused(true);
  }, []);

  const resumeSession = useCallback(() => {
    setIsSessionPaused(false);
  }, []);

  const generateNextCard = useCallback(async (prompt?: string) => {
    if (!sessionState.isActive) return;

    try {
      setSessionState(prev => ({ ...prev, isLoading: true, lastError: null }));

      const effectivePrompt = prompt || sessionState.currentPrompt || '';
      const content = await contentProvider.generateContent(effectivePrompt);
      await cacheService.addCard(content, true);

      setSessionState(prev => ({
        ...prev,
        isLoading: false,
        statistics: {
          ...prev.statistics,
          cardsGenerated: prev.statistics.cardsGenerated + 1,
          successfulGenerations: prev.statistics.successfulGenerations + 1
        }
      }));

    } catch (error) {
      setSessionState(prev => ({
        ...prev,
        isLoading: false,
        lastError: error as Error,
        statistics: {
          ...prev.statistics,
          errorCount: prev.statistics.errorCount + 1
        }
      }));
      throw error;
    }
  }, [contentProvider, cacheService, sessionState.isActive, sessionState.currentPrompt]);

  const navigateToCard = useCallback((cardId: string) => {
    cacheService.navigateToCard(cardId);
  }, [cacheService]);

  const goToNextCard = useCallback(() => {
    const nextCards = cacheService.getNextCards(1);
    if (nextCards.length > 0) {
      cacheService.navigateToCard(nextCards[0].id);
    }
  }, [cacheService]);

  const goToPreviousCard = useCallback(() => {
    const prevCards = cacheService.getPreviousCards(1);
    if (prevCards.length > 0) {
      cacheService.navigateToCard(prevCards[0].id);
    }
  }, [cacheService]);

  const clearError = useCallback(() => {
    setSessionState(prev => ({ ...prev, lastError: null }));
  }, []);

  const updateStatistics = useCallback((updates: Partial<SessionStatistics>) => {
    setSessionState(prev => ({
      ...prev,
      statistics: { ...prev.statistics, ...updates }
    }));
  }, []);

  const recordInteraction = useCallback((type: string, data?: any) => {
    setSessionState(prev => ({
      ...prev,
      statistics: {
        ...prev.statistics,
        interactionEvents: prev.statistics.interactionEvents + 1,
        lastActivityTime: new Date()
      }
    }));

    // Could emit events or log interactions here
    console.log(`Session interaction: ${type}`, data);
  }, []);

  // Calculate cache hit rate
  useEffect(() => {
    const totalRequests = sessionState.statistics.successfulGenerations + sessionState.statistics.errorCount;
    const cacheHits = cacheService.getCacheHitCount();
    
    if (totalRequests > 0) {
      const hitRate = (cacheHits / totalRequests) * 100;
      setSessionState(prev => ({
        ...prev,
        statistics: {
          ...prev.statistics,
          cacheHitRate: hitRate
        }
      }));
    }
  }, [sessionState.statistics.successfulGenerations, sessionState.statistics.errorCount, cacheService]);

  const actions: SessionActions = {
    startSession,
    endSession,
    pauseSession,
    resumeSession,
    generateNextCard,
    navigateToCard,
    goToNextCard,
    goToPreviousCard,
    clearError,
    updateStatistics,
    recordInteraction
  };

  return {
    sessionState,
    isSessionPaused,
    actions,
    // Convenience getters
    isActive: sessionState.isActive,
    isLoading: sessionState.isLoading,
    currentCardId: sessionState.currentCardId,
    statistics: sessionState.statistics,
    lastError: sessionState.lastError,
    hasNavigation: sessionState.hasNextCard || sessionState.hasPreviousCard
  };
}

export default useSessionState;