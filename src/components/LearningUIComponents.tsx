// Learning-Specific UI Components
// Enhanced UI components for educational interactions using the generic abstraction layer

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { 
  Brain,
  BookOpen,
  Target,
  Clock,
  TrendingUp,
  Award,
  Lightbulb,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  Play,
  Pause,
  Star,
  Zap,
  GraduationCap
} from 'lucide-react';

// Import learning services
import { LearningSessionManager, LearningProfile, SessionRecommendations } from '../services/LearningSessionManager';
import { LearningAnalyticsService } from '../services/LearningAnalytics';
import { CardContent, CardSection, learningTheme } from '../abstractions/interfaces';

// Learning Progress Dashboard
export interface LearningDashboardPropsSomeBullshit {
  userId: string;
  sessionManager: LearningSessionManager;
  analyticsService: LearningAnalyticsService;
  onStartSession?: (topic: string) => void;
}

export function LearningDashboard({ 
  userId, 
  sessionManager, 
  analyticsService,
  onStartSession 
}: LearningDashboardProps) {
  const [userProfile, setUserProfile] = useState<LearningProfile | null>(null);
  const [recommendations, setRecommendations] = useState<SessionRecommendations | null>(null);
  const [learningMetrics, setLearningMetrics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const profile = await sessionManager.getUserProfile(userId);
        const metrics = analyticsService.getLearningMetrics();
        
        setUserProfile(profile);
        setLearningMetrics(metrics);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, [userId, sessionManager, analyticsService]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Brain className="w-12 h-12 mx-auto mb-4 animate-pulse text-primary" />
          <p className="text-muted-foreground">Loading your learning dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <LearningOverview 
        profile={userProfile!} 
        metrics={learningMetrics} 
      />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <LearningProgress profile={userProfile!} metrics={learningMetrics} />
        <LearningRecommendations 
          recommendations={recommendations} 
          onStartTopic={onStartSession}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SubjectMastery profile={userProfile!} />
        <LearningStreak metrics={learningMetrics} />
        <NextMilestone profile={userProfile!} />
      </div>
    </div>
  );
}

// Learning Overview Component
function LearningOverview({ profile, metrics }: { profile: LearningProfile; metrics: any }) {
  return (
    <Card className="p-6" style={{ borderColor: learningTheme.primaryColor }}>
      <div className="flex items-center gap-4 mb-4">
        <div 
          className="p-3 rounded-full"
          style={{ backgroundColor: `${learningTheme.primaryColor}20` }}
        >
          <GraduationCap 
            className="w-8 h-8" 
            style={{ color: learningTheme.primaryColor }}
          />
        </div>
        <div>
          <h2 className="text-2xl font-bold" style={{ color: learningTheme.textColor }}>
            Learning Progress
          </h2>
          <p className="text-muted-foreground">
            {profile.strongSubjects.length > 0 
              ? `Excelling in ${profile.strongSubjects.slice(0, 2).join(', ')}`
              : 'Building your learning foundation'
            }
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard 
          icon={Target}
          label="Comprehension"
          value={`${Math.round(profile.comprehensionLevel * 100)}%`}
          trend={profile.comprehensionLevel > 0.7 ? 'up' : 'neutral'}
          color={learningTheme.primaryColor}
        />
        <MetricCard 
          icon={Clock}
          label="Avg Session"
          value={`${profile.attentionSpan}min`}
          color={learningTheme.primaryColor}
        />
        <MetricCard 
          icon={BookOpen}
          label="Topics Explored"
          value={metrics?.learningProgress?.topicsExplored?.toString() || '0'}
          color={learningTheme.primaryColor}
        />
        <MetricCard 
          icon={Award}
          label="Mastered"
          value={profile.masteredConcepts.length.toString()}
          color={learningTheme.primaryColor}
        />
      </div>
    </Card>
  );
}

// Metric Card Component
interface MetricCardProps {
  icon: React.ComponentType<any>;
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'neutral';
  color: string;
}

function MetricCard({ icon: Icon, label, value, trend, color }: MetricCardProps) {
  return (
    <div className="text-center">
      <div 
        className="p-2 rounded-full inline-block mb-2"
        style={{ backgroundColor: `${color}20` }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
        {trend === 'up' && <TrendingUp className="inline w-4 h-4 ml-1" />}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

// Learning Progress Component
function LearningProgress({ profile, metrics }: { profile: LearningProfile; metrics: any }) {
  const progressData = metrics?.learningProgress || {};
  const comprehensionProgress = profile.comprehensionLevel * 100;

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5" style={{ color: learningTheme.primaryColor }} />
        Learning Progress
      </h3>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Overall Comprehension</span>
            <span style={{ color: learningTheme.primaryColor }}>
              {Math.round(comprehensionProgress)}%
            </span>
          </div>
          <Progress 
            value={comprehensionProgress} 
            className="h-2"
          />
        </div>

        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Session Completion Rate</span>
            <span style={{ color: learningTheme.primaryColor }}>
              {Math.round((progressData.completionRate || 0) * 100)}%
            </span>
          </div>
          <Progress 
            value={(progressData.completionRate || 0) * 100} 
            className="h-2"
          />
        </div>

        {/* Subject Progress */}
        <div className="pt-4 border-t">
          <h4 className="font-medium mb-3">Subject Mastery</h4>
          <div className="space-y-2">
            {profile.strongSubjects.slice(0, 3).map((subject) => (
              <div key={subject} className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <span className="text-sm font-medium">{subject}</span>
                <Badge variant="secondary" className="ml-auto">Strong</Badge>
              </div>
            ))}
            {profile.challengingSubjects.slice(0, 2).map((subject) => (
              <div key={subject} className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-medium">{subject}</span>
                <Badge variant="outline" className="ml-auto">Needs Focus</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

// Learning Recommendations Component
function LearningRecommendations({ 
  recommendations, 
  onStartTopic 
}: { 
  recommendations: SessionRecommendations | null;
  onStartTopic?: (topic: string) => void;
}) {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Lightbulb className="w-5 h-5" style={{ color: learningTheme.primaryColor }} />
        Recommended for You
      </h3>

      {recommendations ? (
        <div className="space-y-3">
          {recommendations.suggestedTopics.slice(0, 3).map((suggestion, index) => (
            <div 
              key={index} 
              className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => onStartTopic?.(suggestion.topic)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium">{suggestion.topic}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {suggestion.reason}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {suggestion.difficulty}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      ~{Math.round(suggestion.estimatedTime / 60000)}min
                    </span>
                  </div>
                </div>
                <Play className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          ))}

          {/* Adaptive Tips */}
          {recommendations.adaptiveTips.length > 0 && (
            <div className="pt-4 border-t">
              <h4 className="font-medium mb-2 text-sm">💡 Learning Tips</h4>
              {recommendations.adaptiveTips.slice(0, 2).map((tip, index) => (
                <p key={index} className="text-xs text-muted-foreground mb-2">
                  {tip}
                </p>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Start learning to get personalized recommendations</p>
        </div>
      )}
    </Card>
  );
}

// Subject Mastery Component
function SubjectMastery({ profile }: { profile: LearningProfile }) {
  const allSubjects = [...profile.strongSubjects, ...profile.challengingSubjects];
  
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Target className="w-5 h-5" style={{ color: learningTheme.primaryColor }} />
        Subject Mastery
      </h3>

      <div className="space-y-3">
        {allSubjects.length > 0 ? (
          <>
            {profile.strongSubjects.map((subject) => (
              <div key={subject} className="flex items-center justify-between">
                <span className="text-sm font-medium">{subject}</span>
                <div className="flex items-center gap-2">
                  <Progress value={85} className="w-16 h-2" />
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
              </div>
            ))}
            {profile.challengingSubjects.map((subject) => (
              <div key={subject} className="flex items-center justify-between">
                <span className="text-sm font-medium">{subject}</span>
                <div className="flex items-center gap-2">
                  <Progress value={35} className="w-16 h-2" />
                  <AlertCircle className="w-4 h-4 text-orange-500" />
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Complete topics to build subject mastery</p>
          </div>
        )}
      </div>
    </Card>
  );
}

// Learning Streak Component
function LearningStreak({ metrics }: { metrics: any }) {
  const currentStreak = 7; // This would come from actual metrics
  
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Zap className="w-5 h-5" style={{ color: learningTheme.primaryColor }} />
        Learning Streak
      </h3>

      <div className="text-center">
        <div 
          className="text-4xl font-bold mb-2"
          style={{ color: learningTheme.primaryColor }}
        >
          {currentStreak}
        </div>
        <p className="text-sm text-muted-foreground mb-4">Days in a row</p>
        
        <div className="flex justify-center gap-1 mb-4">
          {[...Array(7)].map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full ${
                i < currentStreak 
                  ? 'bg-primary' 
                  : 'bg-muted'
              }`}
              style={{ 
                backgroundColor: i < currentStreak 
                  ? learningTheme.primaryColor 
                  : undefined 
              }}
            />
          ))}
        </div>
        
        <p className="text-xs text-muted-foreground">
          Keep going! You're building great learning habits.
        </p>
      </div>
    </Card>
  );
}

// Next Milestone Component
function NextMilestone({ profile }: { profile: LearningProfile }) {
  const nextMilestone = profile.masteredConcepts.length < 10 
    ? { name: 'First 10 Concepts', target: 10, current: profile.masteredConcepts.length }
    : { name: 'Learning Expert', target: 50, current: profile.masteredConcepts.length };

  const progress = (nextMilestone.current / nextMilestone.target) * 100;

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Award className="w-5 h-5" style={{ color: learningTheme.primaryColor }} />
        Next Milestone
      </h3>

      <div className="text-center">
        <div className="mb-4">
          <div 
            className="text-2xl font-bold"
            style={{ color: learningTheme.primaryColor }}
          >
            {nextMilestone.name}
          </div>
          <p className="text-sm text-muted-foreground">
            {nextMilestone.current} / {nextMilestone.target}
          </p>
        </div>

        <Progress value={progress} className="mb-4" />
        
        <p className="text-xs text-muted-foreground">
          {nextMilestone.target - nextMilestone.current} more to go!
        </p>
      </div>
    </Card>
  );
}

// Enhanced Learning Card Component
export interface EnhancedLearningCardProps {
  content: CardContent;
  onSectionComplete?: (section: CardSection) => void;
  onComprehensionCheck?: (result: any) => void;
  onStruggleReported?: (struggle: string) => void;
  showLearningMetrics?: boolean;
}

export function EnhancedLearningCard({ 
  content, 
  onSectionComplete,
  onComprehensionCheck,
  onStruggleReported,
  showLearningMetrics = true 
}: EnhancedLearningCardProps) {
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [completedSections, setCompletedSections] = useState<Set<number>>(new Set());
  const [comprehensionLevel, setComprehensionLevel] = useState(0.7);

  const currentSection = content.sections[currentSectionIndex];
  const progress = (completedSections.size / content.sections.length) * 100;

  const handleSectionComplete = () => {
    const newCompleted = new Set(completedSections);
    newCompleted.add(currentSectionIndex);
    setCompletedSections(newCompleted);
    
    onSectionComplete?.(currentSection);
    
    // Move to next section
    if (currentSectionIndex < content.sections.length - 1) {
      setCurrentSectionIndex(currentSectionIndex + 1);
    }
  };

  const handleComprehensionUpdate = (level: number) => {
    setComprehensionLevel(level);
    onComprehensionCheck?.({ 
      sectionIndex: currentSectionIndex, 
      comprehensionLevel: level,
      sectionType: currentSection.type
    });
  };

  return (
    <Card className="max-w-2xl mx-auto" style={{ borderColor: learningTheme.primaryColor }}>
      {/* Learning Progress Header */}
      {showLearningMetrics && (
        <div className="p-4 border-b" style={{ backgroundColor: `${learningTheme.primaryColor}10` }}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold" style={{ color: learningTheme.textColor }}>
              {content.title}
            </h2>
            <Badge variant="outline">
              {completedSections.size} / {content.sections.length}
            </Badge>
          </div>
          
          <Progress value={progress} className="mb-2" />
          
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Progress: {Math.round(progress)}%</span>
            <span>Comprehension: {Math.round(comprehensionLevel * 100)}%</span>
          </div>
        </div>
      )}

      {/* Section Content */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSectionIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <LearningSection 
              section={currentSection}
              onComplete={handleSectionComplete}
              onComprehensionUpdate={handleComprehensionUpdate}
              onStruggleReport={onStruggleReported}
            />
          </motion.div>
        </AnimatePresence>

        {/* Navigation Controls */}
        <div className="flex justify-between mt-6 pt-6 border-t">
          <Button
            variant="outline"
            onClick={() => setCurrentSectionIndex(Math.max(0, currentSectionIndex - 1))}
            disabled={currentSectionIndex === 0}
          >
            Previous
          </Button>
          
          <div className="flex gap-2">
            {content.sections.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full cursor-pointer ${
                  completedSections.has(index)
                    ? 'bg-green-500'
                    : index === currentSectionIndex
                    ? 'bg-primary'
                    : 'bg-muted'
                }`}
                onClick={() => setCurrentSectionIndex(index)}
                style={{
                  backgroundColor: completedSections.has(index)
                    ? '#10b981'
                    : index === currentSectionIndex
                    ? learningTheme.primaryColor
                    : undefined
                }}
              />
            ))}
          </div>

          <Button
            onClick={() => setCurrentSectionIndex(Math.min(content.sections.length - 1, currentSectionIndex + 1))}
            disabled={currentSectionIndex === content.sections.length - 1}
          >
            Next
          </Button>
        </div>
      </div>
    </Card>
  );
}

// Learning Section Component
interface LearningSectionProps {
  section: CardSection;
  onComplete?: () => void;
  onComprehensionUpdate?: (level: number) => void;
  onStruggleReport?: (struggle: string) => void;
}

function LearningSection({ 
  section, 
  onComplete, 
  onComprehensionUpdate,
  onStruggleReport 
}: LearningSectionProps) {
  const [isCompleted, setIsCompleted] = useState(false);
  const [showComprehensionCheck, setShowComprehensionCheck] = useState(false);

  const handleMarkComplete = () => {
    setIsCompleted(true);
    setShowComprehensionCheck(true);
  };

  const handleComprehensionResponse = (understood: boolean, confidence: number) => {
    const comprehensionLevel = understood ? (0.5 + (confidence * 0.5)) : (confidence * 0.4);
    onComprehensionUpdate?.(comprehensionLevel);
    onComplete?.();
    setShowComprehensionCheck(false);
  };

  const handleStruggleReport = () => {
    onStruggleReport?.(`Difficulty with ${section.type} section: ${section.title}`);
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      {section.title && (
        <h3 className="text-xl font-semibold" style={{ color: learningTheme.textColor }}>
          {section.title}
        </h3>
      )}

      {/* Section Content */}
      <div className="prose prose-sm max-w-none">
        {typeof section.content === 'string' ? (
          <p>{section.content}</p>
        ) : Array.isArray(section.content) ? (
          <ul className="space-y-1">
            {section.content.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        ) : (
          <div>Complex content type</div>
        )}
      </div>

      {/* Learning Actions */}
      {!isCompleted && (
        <div className="flex gap-3 pt-4">
          <Button 
            onClick={handleMarkComplete}
            style={{ backgroundColor: learningTheme.primaryColor }}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            I Understand This
          </Button>
          <Button variant="outline" onClick={handleStruggleReport}>
            <AlertCircle className="w-4 h-4 mr-2" />
            I Need Help
          </Button>
        </div>
      )}

      {/* Comprehension Check */}
      {showComprehensionCheck && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="p-4 border rounded-lg bg-muted/50"
        >
          <h4 className="font-medium mb-3">How well did you understand this?</h4>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleComprehensionResponse(true, 1.0)}
              >
                Completely Clear
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleComprehensionResponse(true, 0.8)}
              >
                Mostly Clear
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleComprehensionResponse(true, 0.6)}
              >
                Somewhat Clear
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleComprehensionResponse(false, 0.3)}
              >
                Still Confused
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </Card>
  );
}

// Learning Session Controls Component
export interface LearningSessionControlsProps {
  sessionManager: LearningSessionManager;
  sessionId: string;
  onSessionEnd?: () => void;
}

export function LearningSessionControls({ 
  sessionManager, 
  sessionId, 
  onSessionEnd 
}: LearningSessionControlsProps) {
  const [session, setSession] = useState(sessionManager.getActiveSession(sessionId));
  const [isPaused, setIsPaused] = useState(false);

  const handlePauseResume = async () => {
    try {
      if (isPaused) {
        await sessionManager.resumeLearningSession(sessionId);
      } else {
        await sessionManager.pauseLearningSession(sessionId);
      }
      setIsPaused(!isPaused);
    } catch (error) {
      console.error('Failed to pause/resume session:', error);
    }
  };

  const handleEndSession = async () => {
    try {
      await sessionManager.endLearningSession(sessionId);
      onSessionEnd?.();
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  };

  if (!session) return null;

  return (
    <div className="flex items-center gap-3 p-4 border rounded-lg bg-background">
      <div className="flex-1">
        <div className="font-medium">Learning Session Active</div>
        <div className="text-sm text-muted-foreground">
          {session.topicsExplored.length} topics explored • {session.completedTopics.length} completed
        </div>
      </div>
      
      <Button variant="outline" onClick={handlePauseResume}>
        {isPaused ? (
          <>
            <Play className="w-4 h-4 mr-2" />
            Resume
          </>
        ) : (
          <>
            <Pause className="w-4 h-4 mr-2" />
            Pause
          </>
        )}
      </Button>
      
      <Button variant="destructive" onClick={handleEndSession}>
        End Session
      </Button>
    </div>
  );
}

export default {
  LearningDashboard,
  EnhancedLearningCard,
  LearningSessionControls
};