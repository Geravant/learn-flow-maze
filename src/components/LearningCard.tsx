import { useState } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { useSpring, animated } from 'react-spring';
import { LearningCard as ILearningCard } from '@/services/openRouterService';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  Clock, 
  ArrowUp, 
  ArrowDown, 
  RotateCcw,
  Zap,
  BookOpen,
  Target,
  Brain
} from 'lucide-react';

interface SwipeActions {
  onUnderstand: () => void;    // Right swipe
  onReview: () => void;        // Left swipe  
  onHelp: () => void;          // Up swipe
  onExplore: () => void;       // Down swipe
  onQuickTest: () => void;     // Center tap
}

interface LearningCardProps {
  card: ILearningCard;
  actions: SwipeActions;
  isActive?: boolean;
}

const SWIPE_THRESHOLD = 100;
const ROTATION_FACTOR = 0.1;

export function LearningCard({ card, actions, isActive = true }: LearningCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showHints, setShowHints] = useState(false);
  
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
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
        actions.onReview();
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
      actions.onQuickTest();
    }
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
                {card.topic}
              </h2>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  <Clock size={12} className="mr-1" />
                  {formatTime(card.estimatedTime)}
                </Badge>
                <div className={`w-3 h-3 rounded-full ${getDifficultyColor(card.difficulty)}`} />
              </div>
            </div>
            
            {/* Mastery Progress */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Understanding</span>
                <span>{card.masteryLevel}%</span>
              </div>
              <Progress value={card.masteryLevel} className="h-1.5" />
            </div>
          </div>

          {/* Definition */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <BookOpen size={16} />
              <span>Definition</span>
            </div>
            <p className="text-sm leading-relaxed text-foreground">
              {card.content.definition}
            </p>
          </div>

          {/* Visual Aid */}
          {card.content.visualAid && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Target size={16} />
                <span>Visual</span>
              </div>
              <div className="bg-muted/50 p-3 rounded-md">
                <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                  {card.content.visualAid}
                </pre>
              </div>
            </div>
          )}

          {/* Key Points */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Brain size={16} />
              <span>Key Points</span>
            </div>
            <ul className="space-y-1">
              {card.content.keyPoints.map((point, index) => (
                <li key={index} className="text-sm text-foreground flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Examples */}
          {card.content.examples.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Zap size={16} />
                <span>Examples</span>
              </div>
              <div className="grid gap-2">
                {card.content.examples.map((example, index) => (
                  <div key={index} className="bg-accent/50 p-2 rounded text-xs text-accent-foreground">
                    {example}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tap hint */}
          {isActive && !isDragging && (
            <div className="text-center pt-2">
              <p className="text-xs text-muted-foreground">
                Tap for quick test • Swipe to navigate
              </p>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}