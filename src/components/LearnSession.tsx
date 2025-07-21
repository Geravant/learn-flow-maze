import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LearningCard } from './LearningCard';
import { QuizModal } from './QuizModal';
import { AITutorModal } from './AITutorModal';
import { openRouterService, LearningCard as ILearningCard, QuizQuestion } from '@/services/openRouterService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  BookOpen, 
  Brain, 
  TrendingUp, 
  Zap, 
  RefreshCcw,
  Settings,
  Play,
  Pause
} from 'lucide-react';

interface SessionStats {
  cardsCompleted: number;
  conceptsMastered: number;
  currentStreak: number;
  sessionTime: number;
  accuracyRate: number;
}

interface LearnSessionProps {
  initialTopic?: string;
  onComplete?: (stats: SessionStats) => void;
}

export function LearnSession({ initialTopic = "Quantum Physics", onComplete }: LearnSessionProps) {
  const [currentCard, setCurrentCard] = useState<ILearningCard | null>(null);
  const [nextCards, setNextCards] = useState<ILearningCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showAITutor, setShowAITutor] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    cardsCompleted: 0,
    conceptsMastered: 0,
    currentStreak: 0,
    sessionTime: 0,
    accuracyRate: 0
  });
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [apiKeySet, setApiKeySet] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    if (apiKeySet && sessionActive && !currentCard) {
      generateFirstCard();
    }
  }, [apiKeySet, sessionActive]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (sessionActive && sessionStartTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - sessionStartTime.getTime()) / 1000);
        setSessionStats(prev => ({ ...prev, sessionTime: elapsed }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [sessionActive, sessionStartTime]);

  const handleApiKeySubmit = () => {
    if (!apiKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Please enter your OpenRouter API key to continue.",
        variant: "destructive"
      });
      return;
    }
    
    openRouterService.setApiKey(apiKey);
    setApiKeySet(true);
    toast({
      title: "Ready to Learn!",
      description: "API key set successfully. Let's start learning!",
    });
  };

  const generateFirstCard = async () => {
    setLoading(true);
    try {
      const card = await openRouterService.generateLearningCard(initialTopic, 3);
      setCurrentCard(card);
      
      // Preload next cards
      const connections = await openRouterService.generateConnections(initialTopic);
      const nextCardPromises = connections.slice(0, 3).map(topic => 
        openRouterService.generateLearningCard(topic, 3)
      );
      const preloadedCards = await Promise.all(nextCardPromises);
      setNextCards(preloadedCards);
      
      toast({
        title: "Learning Session Started",
        description: `Exploring: ${card.topic}`,
      });
    } catch (error) {
      console.error('Failed to generate learning card:', error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate learning content. Please check your API key.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const startSession = () => {
    setSessionActive(true);
    setSessionStartTime(new Date());
  };

  const pauseSession = () => {
    setSessionActive(false);
  };

  const moveToNextCard = async (masteryIncrease: number = 0) => {
    if (!currentCard) return;

    // Update current card mastery
    const updatedCard = {
      ...currentCard,
      masteryLevel: Math.min(100, currentCard.masteryLevel + masteryIncrease)
    };

    // Update session stats
    setSessionStats(prev => ({
      ...prev,
      cardsCompleted: prev.cardsCompleted + 1,
      conceptsMastered: masteryIncrease >= 20 ? prev.conceptsMastered + 1 : prev.conceptsMastered,
      currentStreak: masteryIncrease >= 20 ? prev.currentStreak + 1 : 0
    }));

    // Move to next card
    if (nextCards.length > 0) {
      const [next, ...remaining] = nextCards;
      setCurrentCard(next);
      setNextCards(remaining);

      // Preload more cards if needed
      if (remaining.length < 2) {
        try {
          const connections = await openRouterService.generateConnections(next.topic);
          const newCards = await Promise.all(
            connections.slice(0, 2).map(topic => 
              openRouterService.generateLearningCard(topic, next.difficulty)
            )
          );
          setNextCards([...remaining, ...newCards]);
        } catch (error) {
          console.error('Failed to preload cards:', error);
        }
      }
    } else {
      // Session complete
      setSessionActive(false);
      onComplete?.(sessionStats);
      toast({
        title: "Session Complete!",
        description: `Great job! You completed ${sessionStats.cardsCompleted} cards.`,
      });
    }
  };

  const handleUnderstand = () => {
    moveToNextCard(25);
    toast({
      title: "Great progress!",
      description: "Moving to the next concept.",
    });
  };

  const handleReview = () => {
    // Add to review queue logic here
    moveToNextCard(10);
    toast({
      title: "Added to review",
      description: "We'll revisit this concept later.",
    });
  };

  const handleHelp = async () => {
    if (!currentCard) return;
    setShowAITutor(true);
  };

  const handleExplore = async () => {
    if (!currentCard) return;
    
    try {
      const connections = await openRouterService.generateConnections(currentCard.topic);
      const randomTopic = connections[Math.floor(Math.random() * connections.length)];
      const newCard = await openRouterService.generateLearningCard(randomTopic, currentCard.difficulty);
      
      setCurrentCard(newCard);
      toast({
        title: "Exploring deeper!",
        description: `Diving into: ${randomTopic}`,
      });
    } catch (error) {
      console.error('Failed to generate exploration card:', error);
      toast({
        title: "Exploration failed",
        description: "Couldn't generate new content. Try again.",
        variant: "destructive"
      });
    }
  };

  const handleQuickTest = async () => {
    if (!currentCard) return;
    
    try {
      setLoading(true);
      const questions = await openRouterService.generateQuiz(
        currentCard.topic, 
        JSON.stringify(currentCard.content)
      );
      setQuizQuestions(questions);
      setShowQuiz(true);
    } catch (error) {
      console.error('Failed to generate quiz:', error);
      toast({
        title: "Quiz generation failed",
        description: "Couldn't create quiz questions. Try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQuizComplete = (score: number) => {
    setShowQuiz(false);
    
    const accuracy = score / quizQuestions.length;
    const masteryIncrease = Math.floor(accuracy * 30);
    
    setSessionStats(prev => ({
      ...prev,
      accuracyRate: ((prev.accuracyRate * prev.cardsCompleted) + accuracy) / (prev.cardsCompleted + 1)
    }));

    moveToNextCard(masteryIncrease);
    
    toast({
      title: `Quiz Complete! ${score}/${quizQuestions.length}`,
      description: `Your understanding improved by ${masteryIncrease}%`,
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!apiKeySet) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 space-y-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Educational Maze</h1>
          <p className="text-muted-foreground max-w-md">
            Enter your OpenRouter API key to start your personalized learning journey
          </p>
        </div>
        
        <div className="w-full max-w-sm space-y-4">
          <input
            type="password"
            placeholder="OpenRouter API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full p-3 border border-border rounded-lg bg-background text-foreground"
            onKeyDown={(e) => e.key === 'Enter' && handleApiKeySubmit()}
          />
          <Button onClick={handleApiKeySubmit} className="w-full">
            Start Learning
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground text-center max-w-md">
          Get your API key from{' '}
          <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-primary underline">
            openrouter.ai
          </a>
          . Your key is stored locally and never shared.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header Stats */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              size="sm"
              variant={sessionActive ? "destructive" : "default"}
              onClick={sessionActive ? pauseSession : startSession}
            >
              {sessionActive ? <Pause size={16} /> : <Play size={16} />}
              {sessionActive ? 'Pause' : 'Start'}
            </Button>
            
            <div className="flex items-center gap-3 text-sm">
              <Badge variant="outline">
                <Brain size={12} className="mr-1" />
                {sessionStats.cardsCompleted}
              </Badge>
              <Badge variant="outline">
                <TrendingUp size={12} className="mr-1" />
                {sessionStats.currentStreak}
              </Badge>
              <Badge variant="outline">
                <Zap size={12} className="mr-1" />
                {formatTime(sessionStats.sessionTime)}
              </Badge>
            </div>
          </div>
          
          <Button size="sm" variant="ghost" onClick={() => window.location.reload()}>
            <Settings size={16} />
          </Button>
        </div>
      </div>

      {/* Main Learning Area */}
      <div className="p-4 pb-20">
        {loading && !currentCard ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <RefreshCcw className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Generating your first learning card...</p>
          </div>
        ) : currentCard ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentCard.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <LearningCard
                card={currentCard}
                actions={{
                  onUnderstand: handleUnderstand,
                  onReview: handleReview,
                  onHelp: handleHelp,
                  onExplore: handleExplore,
                  onQuickTest: handleQuickTest
                }}
                isActive={sessionActive}
              />
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <BookOpen className="w-12 h-12 text-muted-foreground" />
            <p className="text-muted-foreground">Press Start to begin your learning session</p>
          </div>
        )}

        {/* Next Cards Preview */}
        {nextCards.length > 0 && (
          <div className="mt-8 space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Coming up:</h3>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {nextCards.slice(0, 3).map((card, index) => (
                <div
                  key={card.id}
                  className="flex-shrink-0 bg-card border border-border rounded-lg p-3 w-48"
                >
                  <h4 className="text-sm font-medium text-foreground mb-1">{card.topic}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {card.content.definition}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quiz Modal */}
      {showQuiz && (
        <QuizModal
          questions={quizQuestions}
          topic={currentCard?.topic || ''}
          onComplete={handleQuizComplete}
          onClose={() => setShowQuiz(false)}
        />
      )}

      {/* AI Tutor Modal */}
      {showAITutor && currentCard && (
        <AITutorModal
          card={currentCard}
          onClose={() => setShowAITutor(false)}
        />
      )}
    </div>
  );
}