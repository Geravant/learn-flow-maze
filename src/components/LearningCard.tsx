import { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { useSpring, animated } from 'react-spring';
import { LearningCard as ILearningCard } from '@/services/openRouterService';
import { ProgressiveCard, CardSection } from '@/services/progressiveCardService';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RadialNavigationPanel } from '@/components/RadialNavigationPanel';
import { 
  CheckCircle, 
  Clock, 
  ArrowUp, 
  ArrowDown, 
  RotateCcw,
  Zap,
  BookOpen,
  Target,
  Brain,
  Loader2
} from 'lucide-react';

interface SwipeActions {
  onUnderstand: () => void;    // Right swipe
  onQuickTest: () => void;     // Left swipe (was review, now quiz)
  onHelp: () => void;          // Up swipe
  onExplore: () => void;       // Down swipe
  onNavigate: () => void;      // Center tap (was quick test, now navigation)
  onSelectTopic: (topic: string) => void; // From radial navigation
}

interface LearningCardProps {
  card?: ILearningCard;
  progressiveCard?: ProgressiveCard;
  actions: SwipeActions;
  isActive?: boolean;
}

const SWIPE_THRESHOLD = 100;
const ROTATION_FACTOR = 0.1;

const SectionLoader = ({ loading, error }: { loading: boolean; error?: string }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="ml-2 text-xs text-muted-foreground">Loading...</span>
      </div>
    );
  }
  return null;
};

export function LearningCard({ card, progressiveCard, actions, isActive = true }: LearningCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [showRadialNav, setShowRadialNav] = useState(false);
  const [contextualConcepts, setContextualConcepts] = useState<string[]>([]);
  const [tappedArea, setTappedArea] = useState<string>('general');
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressThreshold = 500; // 500ms for long press
  
  // Use progressive card if available, otherwise use traditional card
  const activeCard = progressiveCard || card;
  const isProgressive = !!progressiveCard;
  
  if (!activeCard) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Preparing your learning card...</span>
      </div>
    );
  }
  
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  // Helper function to get section content for progressive cards
  const getSection = (type: string) => {
    if (!isProgressive || !progressiveCard) return null;
    return progressiveCard.sections.find(s => s.type === type);
  };
  
  // Helper function to get content safely
  const getSectionContent = (type: string, fallback?: any) => {
    if (isProgressive) {
      const section = getSection(type);
      return section?.content || fallback;
    }
    return (card as any)?.content?.[type] || fallback;
  };
  
  const getSectionLoading = (type: string) => {
    if (!isProgressive) return false;
    const section = getSection(type);
    return section?.loading || false;
  };
  
  // Transform values for rotation and opacity
  const rotate = useTransform(x, [-300, 0, 300], [-15, 0, 15]);
  const opacity = useTransform(x, [-300, -150, 0, 150, 300], [0.5, 0.8, 1, 0.8, 0.5]);
  
  // Color hints based on drag direction
  const borderColor = useTransform(
    [x, y],
    ([xValue, yValue]: [number, number]) => {
      if (Math.abs(xValue) > Math.abs(yValue)) {
        if (xValue > 50) return 'hsl(var(--primary))'; // Right - understand
        if (xValue < -50) return 'hsl(var(--destructive))'; // Left - review
      } else {
        if (yValue < -50) return 'hsl(var(--chart-2))'; // Up - help
        if (yValue > 50) return 'hsl(var(--chart-3))'; // Down - explore
      }
      return 'hsl(var(--border))';
    }
  );

  const handleDragStart = () => {
    setIsDragging(true);
    setShowHints(true);
  };

  const handleDragEnd = (event: any, info: PanInfo) => {
    setIsDragging(false);
    setShowHints(false);
    
    const { offset } = info;
    
    // Determine swipe direction and execute action
    if (Math.abs(offset.x) > Math.abs(offset.y)) {
      // Horizontal swipe
      if (offset.x > SWIPE_THRESHOLD) {
        actions.onUnderstand();
      } else if (offset.x < -SWIPE_THRESHOLD) {
        actions.onQuickTest(); // Left swipe now opens quiz
      }
    } else {
      // Vertical swipe
      if (offset.y < -SWIPE_THRESHOLD) {
        actions.onHelp();
      } else if (offset.y > SWIPE_THRESHOLD) {
        actions.onExplore();
      }
    }
    
    // Reset position
    x.set(0);
    y.set(0);
  };

  const handleTap = () => {
    if (!isDragging) {
      actions.onNavigate(); // Center tap now opens navigation
    }
  };

  const handleLongPressStart = (event?: React.PointerEvent, area: string = 'general') => {
    if (!isActive) return;
    longPressTimer.current = setTimeout(() => {
      setTappedArea(area);
      setContextualConcepts(generateContextualConcepts(area));
      setShowRadialNav(true);
    }, longPressThreshold);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleRadialNavClose = () => {
    setShowRadialNav(false);
  };

  const handleTopicSelect = (topic: string) => {
    actions.onSelectTopic(topic);
    setShowRadialNav(false);
  };

  const getDifficultyColor = (level: number) => {
    switch (level) {
      case 1: return 'bg-green-500';
      case 2: return 'bg-green-400';
      case 3: return 'bg-yellow-500';
      case 4: return 'bg-orange-500';
      case 5: return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const formatTime = (minutes: number) => {
    return `${minutes} min${minutes !== 1 ? 's' : ''}`;
  };

  const generateContextualConcepts = (area: string): string[] => {
    const allConnections = getSectionContent('connections', []) as string[];
    const keyPoints = getSectionContent('keyPoints', []) as string[];
    const examples = getSectionContent('examples', []) as string[];
    
    switch (area) {
      case 'definition':
        return [
          `Basic ${activeCard.topic}`,
          `${activeCard.topic} Fundamentals`,
          `Introduction to ${activeCard.topic}`,
          `${activeCard.topic} Overview`,
          `Understanding ${activeCard.topic}`
        ].slice(0, 6);
        
      case 'keyPoints':
        return keyPoints.length > 0 
          ? keyPoints.map(point => `${point.split(' ').slice(0, 3).join(' ')} Deep Dive`).slice(0, 6)
          : [`Advanced ${activeCard.topic}`, `${activeCard.topic} Principles`, `${activeCard.topic} Core Concepts`];
          
      case 'examples':
        return examples.length > 0
          ? [
              `Real-world ${activeCard.topic}`,
              `${activeCard.topic} Applications`,
              `${activeCard.topic} Case Studies`,
              `Practical ${activeCard.topic}`,
              `${activeCard.topic} in Practice`
            ].slice(0, 6)
          : [`Applied ${activeCard.topic}`, `${activeCard.topic} Uses`];
          
      case 'visualAid':
        return [
          `Visual ${activeCard.topic}`,
          `${activeCard.topic} Diagrams`,
          `${activeCard.topic} Models`,
          `${activeCard.topic} Patterns`,
          `${activeCard.topic} Structure`
        ].slice(0, 6);
        
      default:
        return allConnections.slice(0, 6);
    }
  };

  return (
    <div className="relative w-full max-w-sm mx-auto">
      {/* Swipe Hints */}
      {showHints && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 z-10 pointer-events-none"
        >
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-chart-2 text-sm font-medium flex items-center gap-1">
            <ArrowUp size={16} />
            <span>Help</span>
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-chart-3 text-sm font-medium flex items-center gap-1">
            <ArrowDown size={16} />
            <span>Explore</span>
          </div>
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-destructive text-sm font-medium flex items-center gap-1">
            <RotateCcw size={16} />
            <span>Review</span>
          </div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-primary text-sm font-medium flex items-center gap-1">
            <CheckCircle size={16} />
            <span>Got it!</span>
          </div>
        </motion.div>
      )}

      {/* Main Card */}
      <motion.div
        drag={isActive}
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onTap={handleTap}
        onPointerDown={handleLongPressStart}
        onPointerUp={handleLongPressEnd}
        onPointerLeave={handleLongPressEnd}
        style={{
          x,
          y,
          rotate,
          opacity,
          borderColor,
        }}
        className="cursor-grab active:cursor-grabbing"
        whileDrag={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <Card className="p-6 space-y-4 border-2 transition-colors duration-200 min-h-[500px] bg-card/95 backdrop-blur">
          {/* Header */}
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-bold text-foreground leading-tight">
                {activeCard.topic}
              </h2>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  <Clock size={12} className="mr-1" />
                  {formatTime(activeCard.estimatedTime)}
                </Badge>
                <div className={`w-3 h-3 rounded-full ${getDifficultyColor(activeCard.difficulty)}`} />
              </div>
            </div>
            
            {/* Mastery Progress */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Understanding</span>
                <span>{activeCard.masteryLevel}%</span>
              </div>
              <Progress value={activeCard.masteryLevel} className="h-1.5" />
            </div>
          </div>

          {/* Definition */}
          <div 
            className="space-y-2 p-2 rounded-md hover:bg-muted/20 transition-colors cursor-pointer"
            onPointerDown={(e) => handleLongPressStart(e, 'definition')}
            onPointerUp={handleLongPressEnd}
            onPointerLeave={handleLongPressEnd}
          >
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <BookOpen size={16} />
              <span>Description</span>
            </div>
            {getSectionLoading('definition') ? (
              <SectionLoader loading={true} />
            ) : (
              <p className="text-sm leading-relaxed text-foreground">
                {getSectionContent('definition', 'Loading description...')}
              </p>
            )}
          </div>

          {/* Visual Aid */}
          {(getSectionContent('visualAid') || getSectionLoading('visualAid')) && (
            <div 
              className="space-y-2 p-2 rounded-md hover:bg-muted/20 transition-colors cursor-pointer"
              onPointerDown={(e) => handleLongPressStart(e, 'visualAid')}
              onPointerUp={handleLongPressEnd}
              onPointerLeave={handleLongPressEnd}
            >
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Target size={16} />
                <span>Visual</span>
              </div>
              {getSectionLoading('visualAid') ? (
                <SectionLoader loading={true} />
              ) : (
                <div className="bg-muted/50 p-3 rounded-md">
                  <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                    {getSectionContent('visualAid')}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Key Points */}
          <div 
            className="space-y-2 p-2 rounded-md hover:bg-muted/20 transition-colors cursor-pointer"
            onPointerDown={(e) => handleLongPressStart(e, 'keyPoints')}
            onPointerUp={handleLongPressEnd}
            onPointerLeave={handleLongPressEnd}
          >
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Brain size={16} />
              <span>Learning Objectives</span>
            </div>
            {getSectionLoading('keyPoints') ? (
              <SectionLoader loading={true} />
            ) : (
              <ul className="space-y-1">
                {(getSectionContent('keyPoints', []) as string[]).map((point: string, index: number) => (
                  <li key={index} className="text-sm text-foreground flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Examples */}
          {(getSectionContent('examples', []).length > 0 || getSectionLoading('examples')) && (
            <div 
              className="space-y-2 p-2 rounded-md hover:bg-muted/20 transition-colors cursor-pointer"
              onPointerDown={(e) => handleLongPressStart(e, 'examples')}
              onPointerUp={handleLongPressEnd}
              onPointerLeave={handleLongPressEnd}
            >
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Zap size={16} />
                <span>Examples</span>
              </div>
              {getSectionLoading('examples') ? (
                <SectionLoader loading={true} />
              ) : (
                <div className="grid gap-2">
                  {(getSectionContent('examples', []) as string[]).map((example: string, index: number) => (
                    <div key={index} className="bg-accent/50 p-2 rounded text-xs text-accent-foreground">
                      {example}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tap hint */}
          {isActive && !isDragging && (
            <div className="text-center pt-2">
              <p className="text-xs text-muted-foreground">
                Tap for quick test • Long press for concepts
              </p>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Radial Navigation Panel */}
      <RadialNavigationPanel
        isOpen={showRadialNav}
        onClose={handleRadialNavClose}
        onSelectTopic={handleTopicSelect}
        currentTopic={activeCard.topic}
        surroundingConcepts={contextualConcepts}
        contextArea={tappedArea}
      />
    </div>
  );
}