// Learning-Specific Analytics Service
// Educational metrics and learning progress tracking using the Generic Analytics Service

import { GenericAnalyticsService, AnalyticsEvent, AnalyticsExporter } from '../abstractions/services/GenericAnalyticsService';
import { CardContent } from '../abstractions/interfaces';

export interface LearningEvent extends AnalyticsEvent {
  data: AnalyticsEvent['data'] & {
    learningContext?: {
      topic: string;
      subject?: string;
      difficulty?: string;
      timeOnCard?: number;
      comprehensionLevel?: number;
      completionRate?: number;
    };
  };
}

export interface LearningMetrics {
  learningProgress: {
    topicsExplored: number;
    averageTimePerTopic: number;
    completionRate: number;
    difficultyProgression: string[];
    strongSubjects: string[];
    challengingSubjects: string[];
  };
  engagementMetrics: {
    averageSessionLength: number;
    interactionFrequency: number;
    preferredLearningStyle: 'visual' | 'textual' | 'interactive' | 'mixed';
    attentionSpan: number;
    peakLearningTimes: string[];
  };
  knowledgeRetention: {
    revisitRate: number;
    topicMastery: Record<string, number>;
    forgettingCurve: Array<{ topic: string; retentionRate: number; daysSince: number }>;
    strengthenedConcepts: string[];
    needsReview: string[];
  };
  adaptiveLearning: {
    recommendedDifficulty: string;
    suggestedTopics: string[];
    learningPath: string[];
    personalizedStrategies: string[];
  };
}

export interface LearningSession {
  sessionId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  totalTopics: number;
  completedTopics: number;
  averageComprehension: number;
  subjectsStudied: string[];
  timeDistribution: Record<string, number>;
  learningGoals?: string[];
  achievements: string[];
}

export class LearningAnalyticsService extends GenericAnalyticsService {
  private learningMetrics: LearningMetrics;
  private learningHistory: Map<string, Array<{ topic: string; timestamp: Date; comprehension: number }>> = new Map();
  private topicDurations: Map<string, number[]> = new Map();
  private comprehensionScores: Map<string, number[]> = new Map();

  constructor(config: any = {}) {
    super({
      ...config,
      enabledCategories: [...(config.enabledCategories || []), 'learning', 'comprehension', 'progress'],
      customDimensions: {
        ...config.customDimensions,
        learningMode: true,
        educationalContext: true
      }
    });

    this.learningMetrics = this.initializeLearningMetrics();
    this.setupLearningEventHandlers();
  }

  // Learning-specific tracking methods
  trackTopicStart(topic: string, cardContent: CardContent): void {
    const learningContext = this.extractLearningContext(cardContent);
    
    this.trackEvent('topic_started', 'learning', {
      topic,
      subject: learningContext.subject,
      difficulty: learningContext.difficulty,
      sectionsCount: cardContent.sections.length,
      estimatedReadTime: learningContext.estimatedReadTime
    });

    // Start timing for this topic
    this.markPerformanceStart(`topic-${topic}`);
  }

  trackTopicCompletion(topic: string, cardContent: CardContent, comprehensionLevel: number = 0.8): void {
    const timeSpent = this.markPerformanceEnd(`topic-${topic}`);
    const learningContext = this.extractLearningContext(cardContent);
    
    this.trackEvent('topic_completed', 'learning', {
      topic,
      subject: learningContext.subject,
      difficulty: learningContext.difficulty,
      timeSpent,
      comprehensionLevel,
      sectionsCompleted: cardContent.sections.length
    });

    // Update learning history
    this.updateLearningHistory(topic, comprehensionLevel, timeSpent);
    this.updateLearningMetrics(topic, learningContext, timeSpent, comprehensionLevel);
  }

  trackComprehensionCheck(topic: string, questionType: 'quiz' | 'reflection', result: {
    correct?: boolean;
    score?: number;
    confidence?: number;
    timeToAnswer?: number;
  }): void {
    this.trackEvent('comprehension_check', 'learning', {
      topic,
      questionType,
      correct: result.correct,
      score: result.score,
      confidence: result.confidence,
      timeToAnswer: result.timeToAnswer
    });

    // Update comprehension tracking
    if (result.score !== undefined) {
      this.updateComprehensionScore(topic, result.score);
    }
  }

  trackLearningStruggle(topic: string, struggleType: 'content' | 'navigation' | 'comprehension', details?: any): void {
    this.trackEvent('learning_struggle', 'learning', {
      topic,
      struggleType,
      details,
      timestamp: new Date().toISOString()
    });
  }

  trackLearningBreakthrough(topic: string, breakthroughType: 'understanding' | 'connection' | 'application'): void {
    this.trackEvent('learning_breakthrough', 'learning', {
      topic,
      breakthroughType,
      timestamp: new Date().toISOString()
    });
  }

  trackTopicRevisit(topic: string, reason: 'review' | 'confusion' | 'interest' | 'connection'): void {
    this.trackEvent('topic_revisit', 'learning', {
      topic,
      reason,
      timeSinceLastVisit: this.getTimeSinceLastVisit(topic)
    });
  }

  trackLearningGoal(goal: string, action: 'set' | 'modified' | 'achieved' | 'abandoned'): void {
    this.trackEvent('learning_goal', 'learning', {
      goal,
      action,
      timestamp: new Date().toISOString()
    });
  }

  // Advanced learning analytics
  generateLearningInsights(): {
    strengths: string[];
    improvementAreas: string[];
    recommendedActions: string[];
    learningPathSuggestions: string[];
  } {
    const insights = {
      strengths: this.identifyStrengths(),
      improvementAreas: this.identifyImprovementAreas(),
      recommendedActions: this.generateRecommendedActions(),
      learningPathSuggestions: this.suggestLearningPath()
    };

    this.trackEvent('insights_generated', 'learning', {
      strengthsCount: insights.strengths.length,
      improvementAreasCount: insights.improvementAreas.length,
      recommendationsCount: insights.recommendedActions.length
    });

    return insights;
  }

  generatePersonalizedContent(currentTopic: string): {
    suggestedTopics: string[];
    recommendedDifficulty: string;
    preferredFormat: string;
    estimatedTime: number;
  } {
    const userProfile = this.buildUserProfile();
    
    return {
      suggestedTopics: this.getSuggestedTopics(currentTopic, userProfile),
      recommendedDifficulty: this.getRecommendedDifficulty(userProfile),
      preferredFormat: this.getPreferredFormat(userProfile),
      estimatedTime: this.estimateOptimalSessionTime(userProfile)
    };
  }

  getLearningMetrics(): LearningMetrics {
    this.recalculateLearningMetrics();
    return { ...this.learningMetrics };
  }

  generateProgressReport(timeframe: 'day' | 'week' | 'month' = 'week'): {
    summary: Record<string, any>;
    detailedMetrics: LearningMetrics;
    visualizations: Array<{ type: string; data: any }>;
    recommendations: string[];
  } {
    const events = this.getStoredEvents(this.getTimeframeStart(timeframe));
    const learningEvents = events.filter(e => e.eventCategory === 'learning');

    const summary = this.calculateProgressSummary(learningEvents);
    const visualizations = this.generateVisualizationData(learningEvents);
    const recommendations = this.generateProgressRecommendations(summary);

    this.trackEvent('progress_report_generated', 'learning', {
      timeframe,
      eventsAnalyzed: learningEvents.length,
      topicsInReport: summary.topicsStudied
    });

    return {
      summary,
      detailedMetrics: this.getLearningMetrics(),
      visualizations,
      recommendations
    };
  }

  // Private helper methods
  private initializeLearningMetrics(): LearningMetrics {
    return {
      learningProgress: {
        topicsExplored: 0,
        averageTimePerTopic: 0,
        completionRate: 0,
        difficultyProgression: [],
        strongSubjects: [],
        challengingSubjects: []
      },
      engagementMetrics: {
        averageSessionLength: 0,
        interactionFrequency: 0,
        preferredLearningStyle: 'mixed',
        attentionSpan: 0,
        peakLearningTimes: []
      },
      knowledgeRetention: {
        revisitRate: 0,
        topicMastery: {},
        forgettingCurve: [],
        strengthenedConcepts: [],
        needsReview: []
      },
      adaptiveLearning: {
        recommendedDifficulty: 'intermediate',
        suggestedTopics: [],
        learningPath: [],
        personalizedStrategies: []
      }
    };
  }

  private setupLearningEventHandlers(): void {
    this.on('eventTracked', (event: AnalyticsEvent) => {
      if (event.eventCategory === 'learning') {
        this.processLearningEvent(event as LearningEvent);
      }
    });
  }

  private extractLearningContext(content: CardContent): any {
    return {
      subject: content.metadata?.subject || 'general',
      difficulty: content.metadata?.difficulty || 'intermediate',
      estimatedReadTime: content.metadata?.estimatedReadTime || 0,
      topic: content.title,
      sectionTypes: content.sections.map(s => s.type)
    };
  }

  private updateLearningHistory(topic: string, comprehension: number, timeSpent: number): void {
    const userId = this.getSessionMetrics()?.userId || 'anonymous';
    
    if (!this.learningHistory.has(userId)) {
      this.learningHistory.set(userId, []);
    }
    
    this.learningHistory.get(userId)!.push({
      topic,
      timestamp: new Date(),
      comprehension
    });

    // Update topic durations
    if (!this.topicDurations.has(topic)) {
      this.topicDurations.set(topic, []);
    }
    this.topicDurations.get(topic)!.push(timeSpent);
  }

  private updateLearningMetrics(topic: string, context: any, timeSpent: number, comprehension: number): void {
    // Update topics explored
    this.learningMetrics.learningProgress.topicsExplored++;
    
    // Update average time per topic
    const currentAvg = this.learningMetrics.learningProgress.averageTimePerTopic;
    const count = this.learningMetrics.learningProgress.topicsExplored;
    this.learningMetrics.learningProgress.averageTimePerTopic = 
      (currentAvg * (count - 1) + timeSpent) / count;

    // Update subject performance
    if (comprehension > 0.8) {
      if (!this.learningMetrics.learningProgress.strongSubjects.includes(context.subject)) {
        this.learningMetrics.learningProgress.strongSubjects.push(context.subject);
      }
    } else if (comprehension < 0.6) {
      if (!this.learningMetrics.learningProgress.challengingSubjects.includes(context.subject)) {
        this.learningMetrics.learningProgress.challengingSubjects.push(context.subject);
      }
    }

    // Update topic mastery
    this.learningMetrics.knowledgeRetention.topicMastery[topic] = comprehension;
  }

  private updateComprehensionScore(topic: string, score: number): void {
    if (!this.comprehensionScores.has(topic)) {
      this.comprehensionScores.set(topic, []);
    }
    this.comprehensionScores.get(topic)!.push(score);
  }

  private getTimeSinceLastVisit(topic: string): number {
    const userId = this.getSessionMetrics()?.userId || 'anonymous';
    const history = this.learningHistory.get(userId) || [];
    
    const lastVisit = history
      .filter(entry => entry.topic === topic)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
    
    return lastVisit ? Date.now() - lastVisit.timestamp.getTime() : 0;
  }

  private processLearningEvent(event: LearningEvent): void {
    // Process learning-specific events for real-time metric updates
    switch (event.eventType) {
      case 'topic_completed':
        this.handleTopicCompletion(event);
        break;
      case 'comprehension_check':
        this.handleComprehensionCheck(event);
        break;
      case 'learning_struggle':
        this.handleLearningStruggle(event);
        break;
    }
  }

  private handleTopicCompletion(event: LearningEvent): void {
    // Update completion rate
    const sessions = this.getSessionMetrics();
    if (sessions) {
      // Calculate completion rate based on session data
    }
  }

  private handleComprehensionCheck(event: LearningEvent): void {
    // Update comprehension tracking
    const topic = event.data.topic;
    const score = event.data.score;
    
    if (topic && score !== undefined) {
      this.updateComprehensionScore(topic, score);
    }
  }

  private handleLearningStruggle(event: LearningEvent): void {
    // Track learning difficulties for adaptive recommendations
    const topic = event.data.topic;
    const strugggleType = event.data.struggleType;
    
    // Could trigger immediate support or content adaptation
  }

  private identifyStrengths(): string[] {
    const strengths: string[] = [];
    
    // Analyze high-performing subjects
    strengths.push(...this.learningMetrics.learningProgress.strongSubjects);
    
    // Analyze consistent engagement patterns
    if (this.learningMetrics.engagementMetrics.averageSessionLength > 1800) { // 30 minutes
      strengths.push('Sustained attention');
    }
    
    if (this.learningMetrics.learningProgress.completionRate > 0.8) {
      strengths.push('High completion rate');
    }

    return [...new Set(strengths)];
  }

  private identifyImprovementAreas(): string[] {
    const areas: string[] = [];
    
    // Analyze challenging subjects
    areas.push(...this.learningMetrics.learningProgress.challengingSubjects);
    
    // Analyze low engagement
    if (this.learningMetrics.engagementMetrics.averageSessionLength < 600) { // 10 minutes
      areas.push('Session length');
    }
    
    if (this.learningMetrics.knowledgeRetention.revisitRate < 0.3) {
      areas.push('Knowledge retention');
    }

    return [...new Set(areas)];
  }

  private generateRecommendedActions(): string[] {
    const actions: string[] = [];
    const metrics = this.learningMetrics;
    
    if (metrics.learningProgress.challengingSubjects.length > 0) {
      actions.push(`Focus on reinforcement in ${metrics.learningProgress.challengingSubjects.join(', ')}`);
    }
    
    if (metrics.knowledgeRetention.needsReview.length > 0) {
      actions.push('Schedule review sessions for topics needing reinforcement');
    }
    
    if (metrics.engagementMetrics.averageSessionLength < 900) {
      actions.push('Try extending learning sessions gradually');
    }

    return actions;
  }

  private suggestLearningPath(): string[] {
    // Generate personalized learning path based on performance and preferences
    const suggestions: string[] = [];
    const strongSubjects = this.learningMetrics.learningProgress.strongSubjects;
    const topicMastery = this.learningMetrics.knowledgeRetention.topicMastery;
    
    // Suggest progression from strong areas to related topics
    strongSubjects.forEach(subject => {
      suggestions.push(`Advanced ${subject} topics`);
      suggestions.push(`${subject} applications and case studies`);
    });

    return suggestions.slice(0, 5); // Limit to top 5 suggestions
  }

  private buildUserProfile(): any {
    return {
      averageComprehension: this.calculateAverageComprehension(),
      preferredDifficulty: this.inferPreferredDifficulty(),
      strongSubjects: this.learningMetrics.learningProgress.strongSubjects,
      sessionLength: this.learningMetrics.engagementMetrics.averageSessionLength,
      interactionStyle: this.learningMetrics.engagementMetrics.preferredLearningStyle
    };
  }

  private getSuggestedTopics(currentTopic: string, profile: any): string[] {
    // AI-based topic suggestions based on user profile and current context
    const suggestions = profile.strongSubjects.map((subject: string) => 
      `Advanced ${subject} concepts`
    );
    
    return suggestions.slice(0, 3);
  }

  private getRecommendedDifficulty(profile: any): string {
    if (profile.averageComprehension > 0.8) return 'advanced';
    if (profile.averageComprehension > 0.6) return 'intermediate';
    return 'beginner';
  }

  private getPreferredFormat(profile: any): string {
    return profile.interactionStyle || 'mixed';
  }

  private estimateOptimalSessionTime(profile: any): number {
    return Math.max(900, profile.sessionLength * 1.1); // Suggest slightly longer sessions
  }

  private recalculateLearningMetrics(): void {
    // Recalculate metrics based on current data
    this.calculateCompletionRate();
    this.calculateRetentionMetrics();
    this.updateAdaptiveRecommendations();
  }

  private calculateCompletionRate(): void {
    // Calculate based on completed vs started topics
    const completedEvents = this.getStoredEvents().filter(e => e.eventType === 'topic_completed');
    const startedEvents = this.getStoredEvents().filter(e => e.eventType === 'topic_started');
    
    if (startedEvents.length > 0) {
      this.learningMetrics.learningProgress.completionRate = 
        completedEvents.length / startedEvents.length;
    }
  }

  private calculateRetentionMetrics(): void {
    // Analyze revisit patterns and retention
    const revisitEvents = this.getStoredEvents().filter(e => e.eventType === 'topic_revisit');
    const uniqueTopics = new Set(revisitEvents.map(e => e.data.topic));
    
    this.learningMetrics.knowledgeRetention.revisitRate = 
      uniqueTopics.size / Math.max(1, this.learningMetrics.learningProgress.topicsExplored);
  }

  private updateAdaptiveRecommendations(): void {
    const profile = this.buildUserProfile();
    
    this.learningMetrics.adaptiveLearning.recommendedDifficulty = 
      this.getRecommendedDifficulty(profile);
    
    this.learningMetrics.adaptiveLearning.suggestedTopics = 
      this.getSuggestedTopics('', profile);
  }

  private calculateAverageComprehension(): number {
    const allScores = Array.from(this.comprehensionScores.values()).flat();
    return allScores.length > 0 ? 
      allScores.reduce((sum, score) => sum + score, 0) / allScores.length : 
      0.7; // Default
  }

  private inferPreferredDifficulty(): string {
    const avg = this.calculateAverageComprehension();
    if (avg > 0.8) return 'advanced';
    if (avg > 0.6) return 'intermediate';
    return 'beginner';
  }

  private getTimeframeStart(timeframe: string): Date {
    const now = new Date();
    switch (timeframe) {
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  }

  private calculateProgressSummary(events: AnalyticsEvent[]): Record<string, any> {
    const topics = new Set(events.map(e => e.data.topic).filter(Boolean));
    const completedTopics = events.filter(e => e.eventType === 'topic_completed');
    
    return {
      topicsStudied: topics.size,
      topicsCompleted: completedTopics.length,
      totalLearningTime: events
        .filter(e => e.data.timeSpent)
        .reduce((sum, e) => sum + (e.data.timeSpent || 0), 0),
      averageComprehension: this.calculateAverageComprehension(),
      strugglesEncountered: events.filter(e => e.eventType === 'learning_struggle').length
    };
  }

  private generateVisualizationData(events: AnalyticsEvent[]): Array<{ type: string; data: any }> {
    return [
      {
        type: 'learning-progress',
        data: {
          completionTrend: this.calculateCompletionTrend(events),
          topicDistribution: this.calculateTopicDistribution(events),
          timeDistribution: this.calculateTimeDistribution(events)
        }
      },
      {
        type: 'comprehension-analysis',
        data: {
          comprehensionTrend: this.calculateComprehensionTrend(events),
          subjectPerformance: this.calculateSubjectPerformance(events)
        }
      }
    ];
  }

  private calculateCompletionTrend(events: AnalyticsEvent[]): any[] {
    // Group events by day and calculate completion rate
    const dailyData = new Map();
    
    events.forEach(event => {
      const day = event.timestamp.toDateString();
      if (!dailyData.has(day)) {
        dailyData.set(day, { started: 0, completed: 0 });
      }
      
      const dayData = dailyData.get(day);
      if (event.eventType === 'topic_started') dayData.started++;
      if (event.eventType === 'topic_completed') dayData.completed++;
    });

    return Array.from(dailyData.entries()).map(([day, data]) => ({
      date: day,
      completionRate: data.started > 0 ? data.completed / data.started : 0
    }));
  }

  private calculateTopicDistribution(events: AnalyticsEvent[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    events.forEach(event => {
      const topic = event.data.topic;
      if (topic) {
        distribution[topic] = (distribution[topic] || 0) + 1;
      }
    });

    return distribution;
  }

  private calculateTimeDistribution(events: AnalyticsEvent[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    events.forEach(event => {
      const hour = event.timestamp.getHours();
      const timeSlot = `${hour}:00`;
      distribution[timeSlot] = (distribution[timeSlot] || 0) + 1;
    });

    return distribution;
  }

  private calculateComprehensionTrend(events: AnalyticsEvent[]): any[] {
    return events
      .filter(e => e.eventType === 'comprehension_check' && e.data.score)
      .map(e => ({
        timestamp: e.timestamp,
        score: e.data.score,
        topic: e.data.topic
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private calculateSubjectPerformance(events: AnalyticsEvent[]): Record<string, number> {
    const performance: Record<string, number[]> = {};
    
    events
      .filter(e => e.data.subject && e.data.comprehensionLevel)
      .forEach(e => {
        const subject = e.data.subject;
        if (!performance[subject]) performance[subject] = [];
        performance[subject].push(e.data.comprehensionLevel);
      });

    // Calculate average performance per subject
    const avgPerformance: Record<string, number> = {};
    Object.entries(performance).forEach(([subject, scores]) => {
      avgPerformance[subject] = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    });

    return avgPerformance;
  }

  private generateProgressRecommendations(summary: Record<string, any>): string[] {
    const recommendations: string[] = [];
    
    if (summary.averageComprehension < 0.6) {
      recommendations.push('Consider reviewing fundamental concepts before moving to advanced topics');
    }
    
    if (summary.strugglesEncountered > summary.topicsCompleted * 0.5) {
      recommendations.push('Try adjusting the learning pace or seeking additional resources for difficult topics');
    }
    
    if (summary.topicsCompleted < summary.topicsStudied * 0.8) {
      recommendations.push('Focus on completing started topics before exploring new ones');
    }

    return recommendations;
  }
}

// Learning-specific analytics exporter
export class LearningReportExporter implements AnalyticsExporter {
  name = 'learning-report';

  async export(events: AnalyticsEvent[]): Promise<void> {
    const learningEvents = events.filter(e => e.eventCategory === 'learning');
    
    const report = {
      generatedAt: new Date(),
      totalEvents: learningEvents.length,
      learningSession: this.analyzeLearningSession(learningEvents),
      topicSummary: this.summarizeTopics(learningEvents),
      recommendations: this.generateRecommendations(learningEvents)
    };

    // In a real implementation, this would save to file or send to learning management system
    console.log('Learning Report:', JSON.stringify(report, null, 2));
  }

  private analyzeLearningSession(events: AnalyticsEvent[]): any {
    const sessionStart = events.reduce((earliest, event) => 
      event.timestamp < earliest ? event.timestamp : earliest, new Date());
    
    const sessionEnd = events.reduce((latest, event) => 
      event.timestamp > latest ? event.timestamp : latest, new Date(0));

    return {
      duration: sessionEnd.getTime() - sessionStart.getTime(),
      topicsExplored: new Set(events.map(e => e.data.topic).filter(Boolean)).size,
      totalInteractions: events.length
    };
  }

  private summarizeTopics(events: AnalyticsEvent[]): Record<string, any> {
    const topics: Record<string, any> = {};
    
    events.forEach(event => {
      const topic = event.data.topic;
      if (!topic) return;
      
      if (!topics[topic]) {
        topics[topic] = {
          interactions: 0,
          timeSpent: 0,
          completed: false,
          comprehensionScore: null
        };
      }
      
      topics[topic].interactions++;
      
      if (event.data.timeSpent) {
        topics[topic].timeSpent += event.data.timeSpent;
      }
      
      if (event.eventType === 'topic_completed') {
        topics[topic].completed = true;
      }
      
      if (event.data.comprehensionLevel) {
        topics[topic].comprehensionScore = event.data.comprehensionLevel;
      }
    });

    return topics;
  }

  private generateRecommendations(events: AnalyticsEvent[]): string[] {
    const recommendations: string[] = [];
    
    const struggles = events.filter(e => e.eventType === 'learning_struggle');
    if (struggles.length > 0) {
      recommendations.push(`Address learning difficulties in: ${struggles.map(e => e.data.topic).join(', ')}`);
    }
    
    const incompleteTopics = events
      .filter(e => e.eventType === 'topic_started')
      .map(e => e.data.topic)
      .filter(topic => !events.some(e => e.eventType === 'topic_completed' && e.data.topic === topic));
    
    if (incompleteTopics.length > 0) {
      recommendations.push(`Complete started topics: ${incompleteTopics.slice(0, 3).join(', ')}`);
    }

    return recommendations;
  }
}

export default LearningAnalyticsService;