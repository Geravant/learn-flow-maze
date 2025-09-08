// Generic Analytics Service
// Content-agnostic analytics and usage tracking for any card-based interface

import { EventEmitter } from 'events';

export interface AnalyticsEvent {
  id: string;
  timestamp: Date;
  sessionId: string;
  userId?: string;
  eventType: string;
  eventCategory: 'navigation' | 'interaction' | 'content' | 'performance' | 'error' | 'custom';
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface SessionMetrics {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  userId?: string;
  contentProvider: string;
  theme: string;
  deviceInfo: {
    userAgent: string;
    viewport: { width: number; height: number };
    platform: string;
  };
  metrics: {
    cardsViewed: number;
    totalInteractions: number;
    navigationEvents: number;
    errorCount: number;
    averageTimePerCard: number;
    gestureUsage: Record<string, number>;
    sectionEngagement: Record<string, number>;
    loadingPerformance: {
      averageLoadTime: number;
      cacheHitRate: number;
      failedLoads: number;
    };
  };
}

export interface AnalyticsConfiguration {
  enabledCategories: string[];
  samplingRate: number;
  batchSize: number;
  flushInterval: number;
  storageKey: string;
  retentionDays: number;
  enableLocalStorage: boolean;
  enableConsoleLogging: boolean;
  customDimensions?: Record<string, any>;
}

export interface AnalyticsExporter {
  name: string;
  export(events: AnalyticsEvent[]): Promise<void>;
}

const DEFAULT_CONFIG: AnalyticsConfiguration = {
  enabledCategories: ['navigation', 'interaction', 'performance', 'error'],
  samplingRate: 1.0, // 100% sampling
  batchSize: 50,
  flushInterval: 30000, // 30 seconds
  storageKey: 'generic-card-analytics',
  retentionDays: 30,
  enableLocalStorage: true,
  enableConsoleLogging: false
};

export class GenericAnalyticsService extends EventEmitter {
  private config: AnalyticsConfiguration;
  private currentSession: SessionMetrics | null = null;
  private eventQueue: AnalyticsEvent[] = [];
  private exporters: AnalyticsExporter[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private eventIdCounter = 0;

  // Tracking state
  private cardStartTimes: Map<string, Date> = new Map();
  private interactionCounts: Map<string, number> = new Map();
  private performanceMarks: Map<string, number> = new Map();

  constructor(config: Partial<AnalyticsConfiguration> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startFlushTimer();
    this.loadStoredEvents();
  }

  // Session management
  startSession(
    contentProvider: string,
    userId?: string,
    customDimensions?: Record<string, any>
  ): string {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.currentSession = {
      sessionId,
      startTime: new Date(),
      userId,
      contentProvider,
      theme: customDimensions?.theme || 'default',
      deviceInfo: {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        viewport: typeof window !== 'undefined' ? {
          width: window.innerWidth,
          height: window.innerHeight
        } : { width: 0, height: 0 },
        platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown'
      },
      metrics: {
        cardsViewed: 0,
        totalInteractions: 0,
        navigationEvents: 0,
        errorCount: 0,
        averageTimePerCard: 0,
        gestureUsage: {},
        sectionEngagement: {},
        loadingPerformance: {
          averageLoadTime: 0,
          cacheHitRate: 0,
          failedLoads: 0
        }
      }
    };

    this.trackEvent('session_start', 'navigation', {
      sessionId,
      contentProvider,
      customDimensions
    });

    this.emit('sessionStarted', this.currentSession);
    return sessionId;
  }

  endSession(): SessionMetrics | null {
    if (!this.currentSession) return null;

    const now = new Date();
    this.currentSession.endTime = now;
    this.currentSession.duration = now.getTime() - this.currentSession.startTime.getTime();

    // Calculate final metrics
    this.calculateFinalMetrics();

    this.trackEvent('session_end', 'navigation', {
      sessionId: this.currentSession.sessionId,
      duration: this.currentSession.duration,
      metrics: this.currentSession.metrics
    });

    const completedSession = { ...this.currentSession };
    this.currentSession = null;

    // Clear tracking state
    this.cardStartTimes.clear();
    this.interactionCounts.clear();
    this.performanceMarks.clear();

    this.emit('sessionEnded', completedSession);
    return completedSession;
  }

  // Event tracking
  trackEvent(
    eventType: string,
    category: AnalyticsEvent['eventCategory'],
    data: Record<string, any>,
    metadata?: Record<string, any>
  ): void {
    if (!this.shouldTrackEvent(category)) return;

    const event: AnalyticsEvent = {
      id: `evt-${Date.now()}-${this.eventIdCounter++}`,
      timestamp: new Date(),
      sessionId: this.currentSession?.sessionId || 'no-session',
      userId: this.currentSession?.userId,
      eventType,
      eventCategory: category,
      data: { ...data, ...this.config.customDimensions },
      metadata
    };

    this.eventQueue.push(event);
    this.updateSessionMetrics(event);

    if (this.config.enableConsoleLogging) {
      console.log('Analytics:', event);
    }

    this.emit('eventTracked', event);

    // Auto-flush if batch size reached
    if (this.eventQueue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  // Specific tracking methods
  trackNavigation(fromCardId?: string, toCardId?: string, navigationType: string = 'unknown'): void {
    if (fromCardId && this.cardStartTimes.has(fromCardId)) {
      const timeOnCard = Date.now() - this.cardStartTimes.get(fromCardId)!.getTime();
      this.trackEvent('card_view_duration', 'navigation', {
        cardId: fromCardId,
        duration: timeOnCard
      });
    }

    if (toCardId) {
      this.cardStartTimes.set(toCardId, new Date());
    }

    this.trackEvent('card_navigation', 'navigation', {
      fromCardId,
      toCardId,
      navigationType
    });

    if (this.currentSession) {
      this.currentSession.metrics.navigationEvents++;
      this.currentSession.metrics.cardsViewed++;
    }
  }

  trackGesture(gestureType: string, cardId: string, data?: Record<string, any>): void {
    this.trackEvent('gesture_used', 'interaction', {
      gestureType,
      cardId,
      ...data
    });

    if (this.currentSession) {
      this.currentSession.metrics.gestureUsage[gestureType] = 
        (this.currentSession.metrics.gestureUsage[gestureType] || 0) + 1;
    }
  }

  trackSectionInteraction(sectionId: string, interactionType: string, cardId: string): void {
    this.trackEvent('section_interaction', 'interaction', {
      sectionId,
      interactionType,
      cardId
    });

    if (this.currentSession) {
      const key = `${sectionId}:${interactionType}`;
      this.currentSession.metrics.sectionEngagement[key] = 
        (this.currentSession.metrics.sectionEngagement[key] || 0) + 1;
    }
  }

  trackLoadingPerformance(
    operation: string,
    duration: number,
    success: boolean,
    cacheHit: boolean = false
  ): void {
    this.trackEvent('loading_performance', 'performance', {
      operation,
      duration,
      success,
      cacheHit
    });

    if (this.currentSession && success) {
      const perf = this.currentSession.metrics.loadingPerformance;
      const currentAvg = perf.averageLoadTime;
      const count = this.currentSession.metrics.cardsViewed || 1;
      
      perf.averageLoadTime = (currentAvg * (count - 1) + duration) / count;
      
      if (cacheHit) {
        // Update cache hit rate calculation would need total requests tracking
      }
      
      if (!success) {
        perf.failedLoads++;
      }
    }
  }

  trackError(error: Error, context?: Record<string, any>): void {
    this.trackEvent('error_occurred', 'error', {
      errorMessage: error.message,
      errorStack: error.stack,
      errorName: error.name,
      context
    });

    if (this.currentSession) {
      this.currentSession.metrics.errorCount++;
    }
  }

  trackCustomEvent(eventType: string, data: Record<string, any>): void {
    this.trackEvent(eventType, 'custom', data);
  }

  // Performance timing
  markPerformanceStart(markName: string): void {
    this.performanceMarks.set(markName, performance.now());
  }

  markPerformanceEnd(markName: string, additionalData?: Record<string, any>): number {
    const startTime = this.performanceMarks.get(markName);
    if (!startTime) return 0;

    const duration = performance.now() - startTime;
    this.performanceMarks.delete(markName);

    this.trackEvent('performance_timing', 'performance', {
      markName,
      duration,
      ...additionalData
    });

    return duration;
  }

  // Data export and management
  addExporter(exporter: AnalyticsExporter): void {
    this.exporters.push(exporter);
    this.emit('exporterAdded', exporter.name);
  }

  removeExporter(exporterName: string): void {
    this.exporters = this.exporters.filter(e => e.name !== exporterName);
    this.emit('exporterRemoved', exporterName);
  }

  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const eventsToFlush = [...this.eventQueue];
    this.eventQueue = [];

    // Store events locally if enabled
    if (this.config.enableLocalStorage) {
      this.storeEvents(eventsToFlush);
    }

    // Export to all configured exporters
    for (const exporter of this.exporters) {
      try {
        await exporter.export(eventsToFlush);
        this.emit('eventsExported', exporter.name, eventsToFlush.length);
      } catch (error) {
        this.emit('exportError', exporter.name, error);
        console.error(`Analytics export failed for ${exporter.name}:`, error);
      }
    }

    this.emit('eventsFlushed', eventsToFlush.length);
  }

  // Analytics queries and reporting
  getSessionMetrics(): SessionMetrics | null {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  getStoredEvents(
    startDate?: Date,
    endDate?: Date,
    category?: string
  ): AnalyticsEvent[] {
    if (!this.config.enableLocalStorage) return [];

    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (!stored) return [];

      const events: AnalyticsEvent[] = JSON.parse(stored).map((e: any) => ({
        ...e,
        timestamp: new Date(e.timestamp)
      }));

      return events.filter(event => {
        if (startDate && event.timestamp < startDate) return false;
        if (endDate && event.timestamp > endDate) return false;
        if (category && event.eventCategory !== category) return false;
        return true;
      });
    } catch (error) {
      console.error('Failed to retrieve stored events:', error);
      return [];
    }
  }

  generateReport(
    startDate?: Date,
    endDate?: Date
  ): {
    summary: Record<string, any>;
    events: AnalyticsEvent[];
    sessions: SessionMetrics[];
  } {
    const events = this.getStoredEvents(startDate, endDate);
    
    const summary = this.calculateEventSummary(events);
    const sessions = this.extractSessionsFromEvents(events);

    return {
      summary,
      events,
      sessions
    };
  }

  // Configuration
  updateConfig(newConfig: Partial<AnalyticsConfiguration>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart flush timer if interval changed
    if (newConfig.flushInterval) {
      this.stopFlushTimer();
      this.startFlushTimer();
    }

    this.emit('configUpdated', this.config);
  }

  // Cleanup
  clearStoredData(): void {
    if (this.config.enableLocalStorage) {
      localStorage.removeItem(this.config.storageKey);
    }
    this.eventQueue = [];
    this.emit('dataCleared');
  }

  destroy(): void {
    this.endSession();
    this.flush();
    this.stopFlushTimer();
    this.removeAllListeners();
  }

  // Private methods
  private shouldTrackEvent(category: string): boolean {
    if (Math.random() > this.config.samplingRate) return false;
    return this.config.enabledCategories.includes(category);
  }

  private updateSessionMetrics(event: AnalyticsEvent): void {
    if (!this.currentSession) return;

    this.currentSession.metrics.totalInteractions++;

    // Category-specific metrics updates would go here
    switch (event.eventCategory) {
      case 'navigation':
        // Already handled in trackNavigation
        break;
      case 'interaction':
        // Already handled in specific track methods
        break;
    }
  }

  private calculateFinalMetrics(): void {
    if (!this.currentSession) return;

    const metrics = this.currentSession.metrics;
    
    // Calculate average time per card
    if (this.cardStartTimes.size > 0) {
      const totalTime = Array.from(this.cardStartTimes.values())
        .reduce((sum, startTime) => sum + (Date.now() - startTime.getTime()), 0);
      
      metrics.averageTimePerCard = totalTime / this.cardStartTimes.size;
    }
  }

  private storeEvents(events: AnalyticsEvent[]): void {
    try {
      const existing = this.getStoredEvents();
      const combined = [...existing, ...events];
      
      // Apply retention policy
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
      
      const filtered = combined.filter(event => event.timestamp >= cutoffDate);
      
      localStorage.setItem(this.config.storageKey, JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to store analytics events:', error);
    }
  }

  private loadStoredEvents(): void {
    // This could load events on initialization if needed for immediate reporting
  }

  private calculateEventSummary(events: AnalyticsEvent[]): Record<string, any> {
    const summary: Record<string, any> = {
      totalEvents: events.length,
      categories: {},
      eventTypes: {},
      timeRange: null,
      uniqueSessions: new Set(),
      uniqueUsers: new Set()
    };

    if (events.length === 0) return summary;

    events.forEach(event => {
      // Category counts
      summary.categories[event.eventCategory] = 
        (summary.categories[event.eventCategory] || 0) + 1;
      
      // Event type counts
      summary.eventTypes[event.eventType] = 
        (summary.eventTypes[event.eventType] || 0) + 1;
      
      // Unique tracking
      summary.uniqueSessions.add(event.sessionId);
      if (event.userId) summary.uniqueUsers.add(event.userId);
    });

    // Convert Sets to counts
    summary.uniqueSessions = summary.uniqueSessions.size;
    summary.uniqueUsers = summary.uniqueUsers.size;

    // Time range
    const timestamps = events.map(e => e.timestamp);
    summary.timeRange = {
      start: new Date(Math.min(...timestamps.map(t => t.getTime()))),
      end: new Date(Math.max(...timestamps.map(t => t.getTime())))
    };

    return summary;
  }

  private extractSessionsFromEvents(events: AnalyticsEvent[]): SessionMetrics[] {
    // This would reconstruct session metrics from stored events
    // Implementation would depend on the specific event structure
    return [];
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

// Built-in exporters
export class ConsoleAnalyticsExporter implements AnalyticsExporter {
  name = 'console';

  async export(events: AnalyticsEvent[]): Promise<void> {
    console.group('Analytics Export');
    events.forEach(event => {
      console.log(`[${event.eventCategory}] ${event.eventType}:`, event.data);
    });
    console.groupEnd();
  }
}

export class LocalStorageAnalyticsExporter implements AnalyticsExporter {
  name = 'localStorage';
  private storageKey: string;

  constructor(storageKey: string = 'exported-analytics') {
    this.storageKey = storageKey;
  }

  async export(events: AnalyticsEvent[]): Promise<void> {
    try {
      const existing = localStorage.getItem(this.storageKey);
      const existingEvents = existing ? JSON.parse(existing) : [];
      const combined = [...existingEvents, ...events];
      
      localStorage.setItem(this.storageKey, JSON.stringify(combined));
    } catch (error) {
      throw new Error(`LocalStorage export failed: ${error}`);
    }
  }
}

export default GenericAnalyticsService;