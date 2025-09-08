// Learning Session Manager
// Orchestrates learning-specific sessions using the generic abstraction layer

import { GenericSession } from '../abstractions/components/GenericSession';
import { LearningContentProvider } from '../providers/LearningContentProvider';
import { LearningAnalyticsService } from './LearningAnalytics';
import { GenericAssetGenerationService } from '../abstractions/services/GenericAssetGenerationService';
import { GenericCardCacheService } from '../abstractions/services/GenericCardCacheService';
import { ServiceRegistry } from '../abstractions/services/ServiceRegistry';
import { registerLearningGenerators } from './LearningAssetGenerators';
import { 
  SessionConfiguration, 
  CardContent, 
  learningTheme,
  PlaceholderProvider 
} from '../abstractions/interfaces';

export interface LearningSessionConfig extends SessionConfiguration {
  learningObjectives?: string[];
  targetDifficulty?: 'beginner' | 'intermediate' | 'advanced';
  enableAdaptiveDifficulty?: boolean;
  enableComprehensionTracking?: boolean;
  enablePersonalization?: boolean;
  maxTopicsPerSession?: number;
  recommendationEngine?: boolean;
  studyMode?: 'exploration' | 'focused' | 'review' | 'assessment';
}

export interface LearningGoals {
  primary: string[];
  secondary: string[];
  timeframe: 'session' | 'daily' | 'weekly' | 'monthly';
  measurable: boolean;
  progress: Record<string, number>;
}

export interface LearningProfile {
  userId: string;
  learningStyle: 'visual' | 'textual' | 'kinesthetic' | 'mixed';
  preferredPace: 'slow' | 'moderate' | 'fast';
  strongSubjects: string[];
  challengingSubjects: string[];
  comprehensionLevel: number;
  attentionSpan: number; // in minutes
  preferredSessionLength: number; // in minutes
  lastActiveTopics: string[];
  masteredConcepts: string[];
  needsReview: string[];
}

export interface SessionRecommendations {
  suggestedTopics: Array<{
    topic: string;
    reason: string;
    difficulty: string;
    estimatedTime: number;
    prerequisites?: string[];
  }>;
  recommendedDuration: number;
  personalizedStrategies: string[];
  adaptiveTips: string[];
}

export class LearningSessionManager {
  private serviceRegistry: ServiceRegistry;
  private learningAnalytics: LearningAnalyticsService;
  private contentProvider: LearningContentProvider;
  private assetService: GenericAssetGenerationService;
  private cacheService: GenericCardCacheService;
  
  private activeSessions: Map<string, LearningSessionContext> = new Map();
  private userProfiles: Map<string, LearningProfile> = new Map();
  private sessionTemplates: Map<string, LearningSessionConfig> = new Map();

  constructor() {
    this.initializeServices();
    this.setupSessionTemplates();
  }

  // Session lifecycle management
  async startLearningSession(
    userId: string,
    topic: string,
    config?: Partial<LearningSessionConfig>
  ): Promise<string> {
    const sessionId = `learning-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Get or create user profile
      const userProfile = await this.getUserProfile(userId);
      
      // Generate session configuration
      const sessionConfig = await this.generateSessionConfig(userProfile, topic, config);
      
      // Create session context
      const sessionContext = new LearningSessionContext(
        sessionId,
        userId,
        topic,
        sessionConfig,
        userProfile
      );

      // Initialize services for this session
      await this.initializeSessionServices(sessionContext);
      
      // Start analytics tracking
      this.learningAnalytics.startSession('learning', userId, {
        theme: sessionConfig.theme.name,
        studyMode: sessionConfig.studyMode,
        targetDifficulty: sessionConfig.targetDifficulty
      });

      // Track session start
      this.learningAnalytics.trackTopicStart(topic, {
        id: 'session-start',
        title: topic,
        sections: [],
        metadata: { sessionConfig },
        createdAt: new Date(),
        lastModified: new Date()
      });

      // Store active session
      this.activeSessions.set(sessionId, sessionContext);

      // Generate initial recommendations
      await this.updateSessionRecommendations(sessionId);

      return sessionId;

    } catch (error) {
      console.error('Failed to start learning session:', error);
      throw new Error(`Learning session creation failed: ${error}`);
    }
  }

  async pauseLearningSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Learning session ${sessionId} not found`);
    }

    session.status = 'paused';
    session.pausedAt = new Date();
    
    this.learningAnalytics.trackEvent('session_paused', 'learning', {
      sessionId,
      duration: session.pausedAt.getTime() - session.startedAt.getTime(),
      topicsExplored: session.topicsExplored.length
    });
  }

  async resumeLearningSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Learning session ${sessionId} not found`);
    }

    if (session.status !== 'paused') {
      throw new Error(`Session ${sessionId} is not paused`);
    }

    session.status = 'active';
    const pauseDuration = session.pausedAt ? 
      Date.now() - session.pausedAt.getTime() : 0;
    
    session.totalPauseTime += pauseDuration;
    session.pausedAt = null;

    this.learningAnalytics.trackEvent('session_resumed', 'learning', {
      sessionId,
      pauseDuration
    });
  }

  async endLearningSession(sessionId: string): Promise<LearningSessionSummary> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Learning session ${sessionId} not found`);
    }

    try {
      session.status = 'completed';
      session.endedAt = new Date();

      // Calculate session metrics
      const summary = this.generateSessionSummary(session);

      // Update user profile based on session
      await this.updateUserProfile(session.userId, session, summary);

      // End analytics tracking
      const analyticsSession = this.learningAnalytics.endSession();

      // Generate learning insights
      const insights = this.learningAnalytics.generateLearningInsights();

      // Clean up session resources
      this.activeSessions.delete(sessionId);

      // Track session completion
      this.learningAnalytics.trackEvent('session_completed', 'learning', {
        sessionId,
        summary: {
          duration: summary.totalDuration,
          topicsCompleted: summary.topicsCompleted,
          comprehensionAverage: summary.averageComprehension
        }
      });

      return {
        ...summary,
        insights,
        analyticsSession
      };

    } catch (error) {
      console.error('Failed to end learning session:', error);
      throw error;
    }
  }

  // Content and progression management
  async generateNextTopic(sessionId: string, currentTopic?: string): Promise<CardContent> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Learning session ${sessionId} not found`);
    }

    try {
      // Get personalized recommendations
      const recommendations = await this.getSessionRecommendations(sessionId);
      
      // Select next topic based on learning profile and current progress
      const nextTopicData = currentTopic ? 
        await this.getRelatedTopic(session, currentTopic) :
        recommendations.suggestedTopics[0];

      if (!nextTopicData) {
        throw new Error('No suitable next topic found');
      }

      // Generate content
      const content = await this.contentProvider.generateContent(
        nextTopicData.topic, 
        {
          difficulty: nextTopicData.difficulty,
          userProfile: session.userProfile,
          sessionContext: session
        }
      );

      // Enhance with assets if enabled
      if (session.config.enableAssetGeneration) {
        const enhancedContent = await this.contentProvider.enhanceWithAssets(content);
        session.topicsExplored.push(enhancedContent);
        return enhancedContent;
      }

      session.topicsExplored.push(content);
      return content;

    } catch (error) {
      console.error('Failed to generate next topic:', error);
      throw error;
    }
  }

  async handleTopicCompletion(
    sessionId: string, 
    topic: string, 
    comprehensionData: {
      understood: boolean;
      confidence: number;
      timeSpent: number;
      questionsAsked?: number;
      strugglesEncountered?: string[];
    }
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Learning session ${sessionId} not found`);
    }

    // Calculate comprehension level
    const comprehensionLevel = this.calculateComprehensionLevel(comprehensionData);

    // Track completion in analytics
    const topicContent = session.topicsExplored.find(t => t.title === topic);
    if (topicContent) {
      this.learningAnalytics.trackTopicCompletion(topic, topicContent, comprehensionLevel);
    }

    // Update session progress
    session.completedTopics.push({
      topic,
      comprehensionLevel,
      timeSpent: comprehensionData.timeSpent,
      completedAt: new Date()
    });

    // Track struggles if any
    if (comprehensionData.strugglesEncountered?.length) {
      comprehensionData.strugglesEncountered.forEach(struggle => {
        this.learningAnalytics.trackLearningStruggle(topic, 'content', { details: struggle });
      });
    }

    // Update recommendations based on performance
    await this.updateSessionRecommendations(sessionId);

    // Check for learning breakthroughs
    if (comprehensionLevel > 0.8 && comprehensionData.confidence > 0.8) {
      this.learningAnalytics.trackLearningBreakthrough(topic, 'understanding');
    }
  }

  // Adaptive learning features
  async adaptSessionDifficulty(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.config.enableAdaptiveDifficulty) return;

    // Analyze recent performance
    const recentPerformance = this.analyzeRecentPerformance(session);
    
    // Adjust difficulty based on performance
    if (recentPerformance.averageComprehension > 0.85) {
      session.config.targetDifficulty = this.increaseDifficulty(session.config.targetDifficulty);
    } else if (recentPerformance.averageComprehension < 0.6) {
      session.config.targetDifficulty = this.decreaseDifficulty(session.config.targetDifficulty);
    }

    this.learningAnalytics.trackEvent('difficulty_adapted', 'learning', {
      sessionId,
      newDifficulty: session.config.targetDifficulty,
      reason: recentPerformance.averageComprehension > 0.85 ? 'increase' : 'decrease',
      performanceScore: recentPerformance.averageComprehension
    });
  }

  async generatePersonalizedRecommendations(sessionId: string): Promise<SessionRecommendations> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Learning session ${sessionId} not found`);
    }

    const userProfile = session.userProfile;
    const sessionProgress = this.calculateSessionProgress(session);
    
    // Generate AI-powered recommendations
    const personalizedContent = this.learningAnalytics.generatePersonalizedContent(
      session.currentTopic || session.initialTopic
    );

    return {
      suggestedTopics: personalizedContent.suggestedTopics.map(topic => ({
        topic,
        reason: this.generateRecommendationReason(topic, userProfile, sessionProgress),
        difficulty: personalizedContent.recommendedDifficulty,
        estimatedTime: personalizedContent.estimatedTime,
        prerequisites: this.identifyPrerequisites(topic, userProfile)
      })),
      recommendedDuration: personalizedContent.estimatedTime,
      personalizedStrategies: this.generateLearningStrategies(userProfile, sessionProgress),
      adaptiveTips: this.generateAdaptiveTips(session, sessionProgress)
    };
  }

  // User profile management
  async getUserProfile(userId: string): Promise<LearningProfile> {
    let profile = this.userProfiles.get(userId);
    
    if (!profile) {
      profile = await this.createDefaultProfile(userId);
      this.userProfiles.set(userId, profile);
    }

    return profile;
  }

  async updateUserProfile(
    userId: string, 
    session: LearningSessionContext, 
    summary: LearningSessionSummary
  ): Promise<void> {
    const profile = this.userProfiles.get(userId);
    if (!profile) return;

    // Update learning metrics based on session
    profile.comprehensionLevel = this.updateRunningAverage(
      profile.comprehensionLevel,
      summary.averageComprehension,
      0.7 // Learning rate
    );

    // Update subject strengths and challenges
    session.completedTopics.forEach(topicData => {
      const subject = this.inferSubjectFromTopic(topicData.topic);
      
      if (topicData.comprehensionLevel > 0.8) {
        if (!profile.strongSubjects.includes(subject)) {
          profile.strongSubjects.push(subject);
        }
        // Remove from challenging if it was there
        profile.challengingSubjects = profile.challengingSubjects.filter(s => s !== subject);
      } else if (topicData.comprehensionLevel < 0.6) {
        if (!profile.challengingSubjects.includes(subject)) {
          profile.challengingSubjects.push(subject);
        }
      }
    });

    // Update attention span based on session duration
    if (session.endedAt && session.startedAt) {
      const sessionDuration = (session.endedAt.getTime() - session.startedAt.getTime()) / (1000 * 60);
      profile.attentionSpan = this.updateRunningAverage(
        profile.attentionSpan,
        sessionDuration,
        0.3
      );
    }

    // Update last active topics
    profile.lastActiveTopics = session.topicsExplored
      .slice(-5)
      .map(content => content.title);

    // Update mastered concepts and review needs
    session.completedTopics.forEach(topicData => {
      if (topicData.comprehensionLevel > 0.9) {
        if (!profile.masteredConcepts.includes(topicData.topic)) {
          profile.masteredConcepts.push(topicData.topic);
        }
        // Remove from needs review
        profile.needsReview = profile.needsReview.filter(t => t !== topicData.topic);
      } else if (topicData.comprehensionLevel < 0.7) {
        if (!profile.needsReview.includes(topicData.topic)) {
          profile.needsReview.push(topicData.topic);
        }
      }
    });

    this.userProfiles.set(userId, profile);
  }

  // Session queries and management
  getActiveSession(sessionId: string): LearningSessionContext | null {
    return this.activeSessions.get(sessionId) || null;
  }

  getActiveSessions(userId?: string): LearningSessionContext[] {
    const sessions = Array.from(this.activeSessions.values());
    return userId ? sessions.filter(s => s.userId === userId) : sessions;
  }

  async getSessionRecommendations(sessionId: string): Promise<SessionRecommendations> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Learning session ${sessionId} not found`);
    }

    return session.recommendations || await this.generatePersonalizedRecommendations(sessionId);
  }

  // Private helper methods
  private async initializeServices(): Promise<void> {
    this.serviceRegistry = new ServiceRegistry();
    
    // Register learning services
    this.serviceRegistry.register({
      name: 'learningAnalytics',
      version: '1.0.0',
      dependencies: [],
      singleton: true,
      autoStart: true,
      factory: () => new LearningAnalyticsService({
        enableConsoleLogging: true,
        customDimensions: { learningMode: true }
      })
    });

    this.serviceRegistry.register({
      name: 'learningContentProvider',
      version: '1.0.0',
      dependencies: [],
      singleton: true,
      autoStart: true,
      factory: () => new LearningContentProvider()
    });

    this.serviceRegistry.register({
      name: 'assetGenerationService',
      version: '1.0.0',
      dependencies: [],
      singleton: true,
      autoStart: true,
      factory: () => {
        const service = new GenericAssetGenerationService();
        registerLearningGenerators(service);
        return service;
      }
    });

    this.serviceRegistry.register({
      name: 'cardCacheService',
      version: '1.0.0',
      dependencies: [],
      singleton: true,
      autoStart: true,
      factory: () => new GenericCardCacheService()
    });

    // Start all services
    await this.serviceRegistry.startAll();

    // Get service instances
    this.learningAnalytics = this.serviceRegistry.get('learningAnalytics')!;
    this.contentProvider = this.serviceRegistry.get('learningContentProvider')!;
    this.assetService = this.serviceRegistry.get('assetGenerationService')!;
    this.cacheService = this.serviceRegistry.get('cardCacheService')!;
  }

  private setupSessionTemplates(): void {
    // Exploration template
    this.sessionTemplates.set('exploration', {
      name: 'Exploration Learning',
      maxCacheSize: 20,
      enableProgressiveLoading: true,
      enableAssetGeneration: true,
      supportedGestures: ['swipe', 'doubleTap', 'longPress'],
      theme: learningTheme,
      studyMode: 'exploration',
      enableAdaptiveDifficulty: true,
      maxTopicsPerSession: 5,
      recommendationEngine: true
    });

    // Focused study template  
    this.sessionTemplates.set('focused', {
      name: 'Focused Study',
      maxCacheSize: 15,
      enableProgressiveLoading: true,
      enableAssetGeneration: false,
      supportedGestures: ['swipe', 'doubleTap'],
      theme: learningTheme,
      studyMode: 'focused',
      enableComprehensionTracking: true,
      maxTopicsPerSession: 3
    });

    // Review template
    this.sessionTemplates.set('review', {
      name: 'Review Session',
      maxCacheSize: 25,
      enableProgressiveLoading: false,
      enableAssetGeneration: false,
      supportedGestures: ['swipe'],
      theme: learningTheme,
      studyMode: 'review',
      maxTopicsPerSession: 10
    });
  }

  private async generateSessionConfig(
    userProfile: LearningProfile,
    topic: string,
    customConfig?: Partial<LearningSessionConfig>
  ): Promise<LearningSessionConfig> {
    // Select base template based on user profile and preferences
    const templateName = this.selectBestTemplate(userProfile, customConfig?.studyMode);
    const baseConfig = this.sessionTemplates.get(templateName) || this.sessionTemplates.get('exploration')!;

    // Customize based on user profile
    const personalizedConfig: LearningSessionConfig = {
      ...baseConfig,
      targetDifficulty: this.inferDifficultyFromProfile(userProfile),
      enablePersonalization: true,
      preferredSessionLength: userProfile.preferredSessionLength,
      ...customConfig
    };

    return personalizedConfig;
  }

  private async initializeSessionServices(session: LearningSessionContext): Promise<void> {
    // Initialize session-specific cache
    session.cacheService = this.cacheService;
    
    // Set up analytics for this session
    session.analyticsService = this.learningAnalytics;
    
    // Configure content provider for session
    session.contentProvider = this.contentProvider;
  }

  private generateSessionSummary(session: LearningSessionContext): LearningSessionSummary {
    const totalDuration = session.endedAt ? 
      (session.endedAt.getTime() - session.startedAt.getTime() - session.totalPauseTime) :
      0;

    const comprehensionScores = session.completedTopics.map(t => t.comprehensionLevel);
    const averageComprehension = comprehensionScores.length > 0 ?
      comprehensionScores.reduce((sum, score) => sum + score, 0) / comprehensionScores.length :
      0;

    return {
      sessionId: session.sessionId,
      userId: session.userId,
      totalDuration,
      topicsExplored: session.topicsExplored.length,
      topicsCompleted: session.completedTopics.length,
      averageComprehension,
      learningObjectivesAchieved: session.config.learningObjectives?.filter(obj => 
        session.completedTopics.some(t => t.topic.toLowerCase().includes(obj.toLowerCase()))
      ) || [],
      difficultiesEncountered: session.completedTopics
        .filter(t => t.comprehensionLevel < 0.6)
        .map(t => t.topic),
      breakthroughs: session.completedTopics
        .filter(t => t.comprehensionLevel > 0.9)
        .map(t => t.topic)
    };
  }

  private calculateComprehensionLevel(data: any): number {
    let comprehension = 0.5; // Base level
    
    if (data.understood) comprehension += 0.3;
    comprehension += (data.confidence * 0.2);
    
    // Adjust based on time spent (optimal learning curve)
    const optimalTime = 600000; // 10 minutes in ms
    const timeRatio = Math.min(data.timeSpent / optimalTime, 2);
    if (timeRatio < 0.5) comprehension -= 0.1; // Too quick, might not have absorbed
    if (timeRatio > 1.5) comprehension -= 0.1; // Too long, might indicate difficulty
    
    // Penalize for struggles
    if (data.strugglesEncountered?.length) {
      comprehension -= (data.strugglesEncountered.length * 0.05);
    }

    return Math.max(0, Math.min(1, comprehension));
  }

  private async createDefaultProfile(userId: string): Promise<LearningProfile> {
    return {
      userId,
      learningStyle: 'mixed',
      preferredPace: 'moderate',
      strongSubjects: [],
      challengingSubjects: [],
      comprehensionLevel: 0.7,
      attentionSpan: 25, // minutes
      preferredSessionLength: 30, // minutes
      lastActiveTopics: [],
      masteredConcepts: [],
      needsReview: []
    };
  }

  private selectBestTemplate(profile: LearningProfile, studyMode?: string): string {
    if (studyMode) return studyMode;
    
    // Select based on user profile characteristics
    if (profile.attentionSpan < 20) return 'focused';
    if (profile.needsReview.length > 5) return 'review';
    return 'exploration';
  }

  private inferDifficultyFromProfile(profile: LearningProfile): 'beginner' | 'intermediate' | 'advanced' {
    if (profile.comprehensionLevel > 0.8 && profile.masteredConcepts.length > 10) {
      return 'advanced';
    } else if (profile.comprehensionLevel > 0.6) {
      return 'intermediate';
    }
    return 'beginner';
  }

  private updateRunningAverage(current: number, newValue: number, learningRate: number): number {
    return (current * (1 - learningRate)) + (newValue * learningRate);
  }

  private async updateSessionRecommendations(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.recommendations = await this.generatePersonalizedRecommendations(sessionId);
  }

  // Additional helper methods would go here...
  private analyzeRecentPerformance(session: LearningSessionContext): any {
    const recentTopics = session.completedTopics.slice(-3);
    const avgComprehension = recentTopics.length > 0 ?
      recentTopics.reduce((sum, t) => sum + t.comprehensionLevel, 0) / recentTopics.length :
      0.7;

    return { averageComprehension: avgComprehension };
  }

  private increaseDifficulty(current?: string): 'beginner' | 'intermediate' | 'advanced' {
    switch (current) {
      case 'beginner': return 'intermediate';
      case 'intermediate': return 'advanced';
      default: return 'advanced';
    }
  }

  private decreaseDifficulty(current?: string): 'beginner' | 'intermediate' | 'advanced' {
    switch (current) {
      case 'advanced': return 'intermediate';
      case 'intermediate': return 'beginner';
      default: return 'beginner';
    }
  }

  private calculateSessionProgress(session: LearningSessionContext): any {
    return {
      completionRate: session.completedTopics.length / Math.max(session.topicsExplored.length, 1),
      averageComprehension: session.completedTopics.reduce((sum, t) => sum + t.comprehensionLevel, 0) / 
                           Math.max(session.completedTopics.length, 1),
      timeInSession: Date.now() - session.startedAt.getTime()
    };
  }

  private generateRecommendationReason(topic: string, profile: LearningProfile, progress: any): string {
    if (profile.strongSubjects.some(subject => topic.toLowerCase().includes(subject.toLowerCase()))) {
      return 'Builds on your strengths';
    }
    if (profile.needsReview.includes(topic)) {
      return 'Recommended for review';
    }
    if (progress.averageComprehension > 0.8) {
      return 'Ready for more challenging content';
    }
    return 'Suggested based on your learning pattern';
  }

  private identifyPrerequisites(topic: string, profile: LearningProfile): string[] {
    // This would use AI to identify prerequisites
    // For now, return basic prerequisites
    return [];
  }

  private generateLearningStrategies(profile: LearningProfile, progress: any): string[] {
    const strategies: string[] = [];
    
    if (profile.learningStyle === 'visual') {
      strategies.push('Focus on diagrams and visual aids');
    }
    if (profile.attentionSpan < 20) {
      strategies.push('Take short breaks between topics');
    }
    if (progress.averageComprehension < 0.6) {
      strategies.push('Slow down and review fundamentals');
    }

    return strategies;
  }

  private generateAdaptiveTips(session: LearningSessionContext, progress: any): string[] {
    const tips: string[] = [];
    
    if (progress.completionRate < 0.7) {
      tips.push('Try completing current topics before moving to new ones');
    }
    if (session.completedTopics.some(t => t.comprehensionLevel < 0.5)) {
      tips.push('Consider revisiting challenging topics with different approaches');
    }

    return tips;
  }

  private inferSubjectFromTopic(topic: string): string {
    // Simple subject inference - could be enhanced with AI
    const topicLower = topic.toLowerCase();
    
    if (topicLower.includes('math') || topicLower.includes('algebra')) return 'mathematics';
    if (topicLower.includes('science') || topicLower.includes('biology')) return 'science';
    if (topicLower.includes('history')) return 'history';
    if (topicLower.includes('language') || topicLower.includes('grammar')) return 'language';
    
    return 'general';
  }

  private async getRelatedTopic(session: LearningSessionContext, currentTopic: string): Promise<any> {
    // This would use AI to find related topics
    // For now, return a simple related topic
    return {
      topic: `Advanced ${currentTopic}`,
      difficulty: session.config.targetDifficulty,
      estimatedTime: 600000 // 10 minutes
    };
  }
}

// Supporting classes and interfaces
class LearningSessionContext {
  sessionId: string;
  userId: string;
  initialTopic: string;
  currentTopic?: string;
  config: LearningSessionConfig;
  userProfile: LearningProfile;
  status: 'active' | 'paused' | 'completed' = 'active';
  startedAt: Date = new Date();
  endedAt?: Date;
  pausedAt?: Date | null;
  totalPauseTime: number = 0;
  
  topicsExplored: CardContent[] = [];
  completedTopics: Array<{
    topic: string;
    comprehensionLevel: number;
    timeSpent: number;
    completedAt: Date;
  }> = [];

  recommendations?: SessionRecommendations;
  
  // Service references
  analyticsService?: LearningAnalyticsService;
  contentProvider?: LearningContentProvider;
  cacheService?: GenericCardCacheService;

  constructor(
    sessionId: string,
    userId: string,
    initialTopic: string,
    config: LearningSessionConfig,
    userProfile: LearningProfile
  ) {
    this.sessionId = sessionId;
    this.userId = userId;
    this.initialTopic = initialTopic;
    this.currentTopic = initialTopic;
    this.config = config;
    this.userProfile = userProfile;
  }
}

interface LearningSessionSummary {
  sessionId: string;
  userId: string;
  totalDuration: number;
  topicsExplored: number;
  topicsCompleted: number;
  averageComprehension: number;
  learningObjectivesAchieved: string[];
  difficultiesEncountered: string[];
  breakthroughs: string[];
  insights?: any;
  analyticsSession?: any;
}

export default LearningSessionManager;