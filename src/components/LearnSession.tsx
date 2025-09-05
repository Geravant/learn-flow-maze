import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LearningCard } from './LearningCard';
import { QuizModal } from './QuizModal';
import { AITutorModal } from './AITutorModal';
import { NavigationPanel } from './NavigationPanel';
import { openRouterService, LearningCard as ILearningCard, QuizQuestion } from '@/services/openRouterService';
import { wikiCardService } from '@/services/wikiCardService';
import { apiKeyManager } from '@/services/apiKeyManager';
import { topicSuggestionService } from '@/services/topicSuggestionService';
import { progressiveCardService, ProgressiveCard, CardSection } from '@/services/progressiveCardService';
import { progressiveQuizService, ProgressiveQuiz, QuizQuestion as ProgressiveQuizQuestion } from '@/services/progressiveQuizService';
import { cardCacheService, CachedCard } from '@/services/cardCacheService';
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

export function LearnSession({ initialTopic, onComplete }: LearnSessionProps) {
  const [currentCard, setCurrentCard] = useState<ILearningCard | null>(null);
  const [progressiveCard, setProgressiveCard] = useState<ProgressiveCard | null>(null);
  // Detect mobile and disable progressive loading by default on mobile
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const [useProgressiveLoading, setUseProgressiveLoading] = useState(!isMobile);
  const [nextCards, setNextCards] = useState<ILearningCard[]>([]);
  const [cachedCards, setCachedCards] = useState<CachedCard[]>([]);
  const [currentCachedImage, setCurrentCachedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showAITutor, setShowAITutor] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [progressiveQuiz, setProgressiveQuiz] = useState<ProgressiveQuiz | null>(null);
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
  const [useWikiEngine, setUseWikiEngine] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState(initialTopic || '');
  const [topicSuggestions, setTopicSuggestions] = useState<string[]>([]);
  const [topicSet, setTopicSet] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showNavigationPanel, setShowNavigationPanel] = useState(false);
  
  const { toast } = useToast();

  // Helper function to format session time
  const formatSessionTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    // Check if we have an API key from environment or user input
    if (apiKeyManager.hasApiKey() && !apiKeySet) {
      setApiKeySet(true);
    }
    
    // Set topic if provided initially
    if (initialTopic && !topicSet) {
      setTopicSet(true);
    }
    
    if (apiKeySet && sessionActive && !currentCard && topicSet) {
      generateFirstCard();
    }
  }, [apiKeySet, sessionActive, currentCard, topicSet, initialTopic]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (sessionActive && sessionStartTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - sessionStartTime.getTime()) / 1000);
        setSessionStats(prev => ({ ...prev, sessionTime: elapsed }));
        
        // Update cached cards list
        setCachedCards(cardCacheService.getAllCachedCards());
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [sessionActive, sessionStartTime]);

  const loadTopicSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const suggestions = await topicSuggestionService.getRandomTopics(4);
      setTopicSuggestions(suggestions);
    } catch (error) {
      console.error('Failed to load topic suggestions:', error);
      // Fallback to popular topics
      setTopicSuggestions(topicSuggestionService.getPopularTopics().slice(0, 4));
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleTopicSelect = (topic: string) => {
    setSelectedTopic(topic);
  };

  const handleTopicSubmit = () => {
    if (!selectedTopic.trim()) {
      toast({
        title: "Topic Required",
        description: "Please enter a topic or select one from the suggestions.",
        variant: "destructive"
      });
      return;
    }

    if (!topicSuggestionService.validateTopic(selectedTopic)) {
      toast({
        title: "Invalid Topic",
        description: "Topic should be between 2-50 characters long.",
        variant: "destructive"
      });
      return;
    }

    setTopicSet(true);
    
    // If API key is already set, auto-start the session
    if (apiKeySet && !sessionActive) {
      setSessionActive(true);
      setSessionStartTime(new Date());
      toast({
        title: "Starting learning session!",
        description: `Generating cards for: ${selectedTopic}`,
      });
    } else {
      toast({
        title: "Topic Selected!",
        description: `Ready to explore: ${selectedTopic}`,
      });
    }
  };

  const handleApiKeySubmit = () => {
    // Check if we already have an API key from environment
    if (apiKeyManager.hasApiKey() && !apiKey.trim()) {
      setApiKeySet(true);
      toast({
        title: "API Key Ready!",
        description: "Using API key from environment configuration.",
      });
      return;
    }
    
    if (!apiKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Please enter your OpenRouter API key.",
        variant: "destructive"
      });
      return;
    }
    
    // Set the API key through the centralized manager
    apiKeyManager.setApiKey(apiKey);
    setApiKeySet(true);
    
    // Auto-start the session immediately
    setSessionActive(true);
    setSessionStartTime(new Date());
    
    toast({
      title: "Starting your learning session!",
      description: "Generating your first learning card...",
    });
  };

  const handleSectionUpdate = (section: CardSection) => {
    setProgressiveCard(prev => {
      if (!prev) return prev;
      
      const updatedSections = prev.sections.map(s => 
        s.id === section.id ? section : s
      );
      
      return {
        ...prev,
        sections: updatedSections
      };
    });
  };

  const generateFirstCard = async () => {
    setLoading(true);
    try {
      if (useProgressiveLoading) {
        // Use progressive loading
        try {
          const card = await progressiveCardService.generateProgressiveCard(
            selectedTopic, 
            3, 
            handleSectionUpdate
          );
          
          setProgressiveCard(card);
          setCurrentCard(null); // Clear traditional card
          
          // Start cache warming immediately for progressive cards
          console.log('🔥 Starting immediate cache warming for progressive card:', selectedTopic);
          cardCacheService.preloadCards(selectedTopic, 3);
          
          // Notify user that cache is being populated
          setTimeout(() => {
            toast({
              title: "Building Navigation Cache",
              description: "Preparing related concepts for instant access",
            });
          }, 2000); // Show after 2 seconds to avoid spam
          
          toast({
            title: "Progressive Loading Started",
            description: `Generating content for: ${selectedTopic}`,
          });
        } catch (progressiveError) {
          console.warn('Progressive loading failed, falling back to traditional:', progressiveError);
          // Fallback to traditional loading
          const fallbackCard = await openRouterService.generateLearningCard(selectedTopic, 3);
          setCurrentCard(fallbackCard);
          setProgressiveCard(null);
          
          // Start cache warming for fallback traditional card
          console.log('🔥 Starting cache warming for fallback traditional card:', selectedTopic);
          cardCacheService.preloadCards(selectedTopic, 3);
          
          // Notify user that cache is being populated
          setTimeout(() => {
            toast({
              title: "Building Navigation Cache",
              description: "Preparing related concepts for instant access",
            });
          }, 2000);
          
          toast({
            title: "Using Traditional Loading",
            description: `Generated content for: ${selectedTopic}`,
          });
        }
      } else {
        // Use traditional loading
        let card: ILearningCard;
        
        if (useWikiEngine) {
          try {
            // Try using the infinite-wiki engine first
            card = await wikiCardService.generateWikiCard(selectedTopic, {
              difficulty: 3
            });
            
            toast({
              title: "Wiki Engine Activated",
              description: `Generated enhanced content for: ${card.topic}`,
            });
          } catch (wikiError) {
            console.warn('Wiki engine failed, falling back to OpenRouter:', wikiError);
            // Fallback to original OpenRouter service
            card = await openRouterService.generateLearningCard(selectedTopic, 3);
            
            toast({
              title: "Using Standard Mode",
              description: `Generated content for: ${card.topic}`,
            });
          }
        } else {
          // Use original OpenRouter service
          card = await openRouterService.generateLearningCard(selectedTopic, 3);
        }
        
        setCurrentCard(card);
        setProgressiveCard(null); // Clear progressive card
        
        // Start cache warming immediately for traditional card
        console.log('🔥 Starting immediate cache warming for traditional card:', selectedTopic);
        cardCacheService.preloadCards(selectedTopic, 3);
        
        // Notify user that cache is being populated
        setTimeout(() => {
          toast({
            title: "Building Navigation Cache",
            description: "Preparing related concepts for instant access",
          });
        }, 2000);
      }
      
      // Preload next cards - mix both engines if available
      const connections = await openRouterService.generateConnections(selectedTopic);
      const nextCardPromises = connections.slice(0, 3).map(async (topic, index) => {
        // Alternate between wiki engine and standard for variety
        if (useWikiEngine && index % 2 === 0) {
          try {
            return await wikiCardService.generateWikiCard(topic, { difficulty: 3 });
          } catch {
            return await openRouterService.generateLearningCard(topic, 3);
          }
        } else {
          return await openRouterService.generateLearningCard(topic, 3);
        }
      });
      const preloadedCards = await Promise.all(nextCardPromises);
      setNextCards(preloadedCards);
      
      toast({
        title: "Learning Session Started",
        description: `Exploring: ${selectedTopic}`,
      });
    } catch (error) {
      console.error('Failed to generate learning card:', error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate learning content. Please check your configuration.",
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
    // Check if we have either a traditional or progressive card
    const activeCard = currentCard || progressiveCard;
    if (!activeCard) return;

    // Update current card mastery
    const updatedCard = {
      ...activeCard,
      masteryLevel: Math.min(100, activeCard.masteryLevel + masteryIncrease)
    };

    // Update session stats
    setSessionStats(prev => ({
      ...prev,
      cardsCompleted: prev.cardsCompleted + 1,
      conceptsMastered: masteryIncrease >= 20 ? prev.conceptsMastered + 1 : prev.conceptsMastered,
      currentStreak: masteryIncrease >= 20 ? prev.currentStreak + 1 : 0
    }));

    // Start cache warming for related topics
    cardCacheService.preloadCards(activeCard.topic, activeCard.difficulty);

    // Move to next card
    if (progressiveCard) {
      // For progressive cards, generate a new progressive card from connections
      try {
        const connections = await openRouterService.generateConnections(activeCard.topic);
        if (connections.length > 0) {
          const nextTopic = connections[Math.floor(Math.random() * connections.length)];
          
          const newProgressiveCard = await progressiveCardService.generateProgressiveCard(
            nextTopic,
            activeCard.difficulty,
            handleSectionUpdate
          );
          
          setProgressiveCard(newProgressiveCard);
          setCurrentCard(null); // Keep traditional card cleared
          setCurrentCachedImage(null); // Clear cached image
          
          toast({
            title: "Great progress!",
            description: `Moving to: ${nextTopic}`,
          });
        } else {
          // No connections available, end session
          setSessionActive(false);
          onComplete?.(sessionStats);
          toast({
            title: "Session Complete!",
            description: `Great job! You completed ${sessionStats.cardsCompleted} cards.`,
          });
        }
      } catch (error) {
        console.error('Failed to generate next progressive card:', error);
        toast({
          title: "Error",
          description: "Failed to load next card. Session ended.",
          variant: "destructive"
        });
        setSessionActive(false);
      }
    } else if (nextCards.length > 0) {
      // For traditional cards, use the preloaded queue
      const [next, ...remaining] = nextCards;
      setCurrentCard(next);
      setNextCards(remaining);
      setCurrentCachedImage(null); // Clear cached image

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
    // Toast is now handled within moveToNextCard for progressive cards
    // Only show toast for traditional cards
    if (!progressiveCard) {
      toast({
        title: "Great progress!",
        description: "Moving to the next concept.",
      });
    }
  };

  const handleNavigate = () => {
    // Center tap now opens navigation panel
    setShowNavigationPanel(true);
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
        title: "Exploration Failed",
        description: "Failed to generate new content. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleSelectTopic = async (topic: string) => {
    if (!currentCard) return;
    
    try {
      const newCard = await openRouterService.generateLearningCard(topic, currentCard.difficulty);
      
      setCurrentCard(newCard);
      setProgressiveCard(null); // Clear progressive card when switching topics
      setCurrentCachedImage(null); // Clear cached image
      
      toast({
        title: "New Topic Loaded",
        description: `Now exploring: ${topic}`,
      });
    } catch (error) {
      console.error('Failed to generate card for selected topic:', error);
      toast({
        title: "Topic Load Failed",
        description: "Failed to generate content for the selected topic.",
        variant: "destructive"
      });
    }
  };

  const handleSelectCachedCard = async (cachedCard: CachedCard) => {
    try {
      if (!cachedCard.isFullyLoaded) {
        toast({
          title: "Card Still Loading",
          description: `${cachedCard.topic} is still being prepared (${cachedCard.loadingProgress}%)`,
          variant: "default"
        });
        return;
      }

      // Switch to the cached card
      setCurrentCard(cachedCard.card);
      
      // Set progressive card if available
      if (cachedCard.progressiveCard) {
        setProgressiveCard(cachedCard.progressiveCard);
      } else {
        setProgressiveCard(null);
      }
      
      // Set the cached image if available
      setCurrentCachedImage(cachedCard.generatedImage || null);
      
      // Close the navigation panel
      setShowNavigationPanel(false);
      
      toast({
        title: "Instant Load Complete!",
        description: `Now exploring: ${cachedCard.topic}${cachedCard.generatedImage ? ' (with AI image)' : ''}`,
      });
    } catch (error) {
      console.error('Failed to load cached card:', error);
      toast({
        title: "Failed to Load Card",
        description: "Could not switch to the selected card.",
        variant: "destructive"
      });
    }
  };


  const handleProgressiveQuizUpdate = (question: ProgressiveQuizQuestion) => {
    setProgressiveQuiz(prev => {
      if (!prev) return prev;
      
      const updatedQuestions = prev.questions.map(q => 
        q.id === question.id ? question : q
      );
      
      return {
        ...prev,
        questions: updatedQuestions,
        loading: updatedQuestions.some(q => q.loading)
      };
    });
  };

  const handleQuickTest = async () => {
    const activeCard = progressiveCard || currentCard;
    if (!activeCard) return;
    
    try {
      setLoading(true);
      
      if (useProgressiveLoading) {
        // Generate progressive quiz
        const cardContent = progressiveCard ? 
          JSON.stringify({
            definition: progressiveCard.sections.find(s => s.type === 'definition')?.content,
            keyPoints: progressiveCard.sections.find(s => s.type === 'keyPoints')?.content,
            examples: progressiveCard.sections.find(s => s.type === 'examples')?.content
          }) : 
          JSON.stringify((currentCard as ILearningCard).content);
          
        const quiz = await progressiveQuizService.generateProgressiveQuiz(
          activeCard.topic,
          cardContent,
          handleProgressiveQuizUpdate
        );
        
        setProgressiveQuiz(quiz);
        setQuizQuestions([]); // Clear traditional questions
      } else {
        // Traditional quiz generation
        const questions = await openRouterService.generateQuiz(
          activeCard.topic, 
          JSON.stringify((activeCard as ILearningCard).content)
        );
        setQuizQuestions(questions);
        setProgressiveQuiz(null); // Clear progressive quiz
      }
      
      setShowQuiz(true);
    } catch (error) {
      console.error('Failed to generate quiz:', error);
      toast({
        title: "Quiz generation failed",
        description: "Couldn't create quiz questions. Try again.",
        variant: "destructive"
      });
      // Don't show quiz if generation failed
      setShowQuiz(false);
      setQuizQuestions([]);
      setProgressiveQuiz(null);
    } finally {
      setLoading(false);
    }
  };

  const handleQuizComplete = (score: number) => {
    setShowQuiz(false);
    
    // Get the total number of questions from either traditional or progressive quiz
    const totalQuestions = progressiveQuiz ? progressiveQuiz.questions.length : quizQuestions.length;
    
    if (totalQuestions === 0) {
      toast({
        title: "Quiz Error",
        description: "No questions were available for scoring.",
        variant: "destructive"
      });
      return;
    }
    
    const accuracy = score / totalQuestions;
    const masteryIncrease = Math.floor(accuracy * 30);
    
    setSessionStats(prev => ({
      ...prev,
      accuracyRate: ((prev.accuracyRate * prev.cardsCompleted) + accuracy) / (prev.cardsCompleted + 1)
    }));

    moveToNextCard(masteryIncrease);
    
    toast({
      title: `Quiz Complete! ${score}/${totalQuestions}`,
      description: `Your understanding improved by ${masteryIncrease}%`,
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Show topic selection if API key is set but topic is not set yet
  if (apiKeySet && !topicSet) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 space-y-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Choose Your Learning Topic</h1>
          <p className="text-muted-foreground max-w-md">
            What would you like to explore today? Enter your own topic or select from our suggestions.
          </p>
        </div>

        <div className="w-full max-w-lg space-y-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2 mb-3">
              <input
                type="checkbox"
                id="useProgressiveLoading"
                checked={useProgressiveLoading}
                onChange={(e) => setUseProgressiveLoading(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="useProgressiveLoading" className="text-sm text-muted-foreground">
                Progressive Loading (show content as it generates)
              </label>
            </div>
            
            <input
              type="text"
              placeholder="Enter a topic (e.g., Quantum Physics, Machine Learning...)"
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="w-full p-3 border border-border rounded-lg bg-background text-foreground"
              onKeyDown={(e) => e.key === 'Enter' && handleTopicSubmit()}
            />
            <Button onClick={handleTopicSubmit} className="w-full">
              Start Learning About This Topic
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or choose from suggestions</span>
            </div>
          </div>

          <div className="space-y-3">
            {topicSuggestions.length === 0 && (
              <div className="flex justify-center">
                <Button 
                  variant="outline" 
                  onClick={loadTopicSuggestions}
                  disabled={loadingSuggestions}
                  className="text-sm"
                >
                  {loadingSuggestions ? (
                    <>
                      <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Get Topic Suggestions'
                  )}
                </Button>
              </div>
            )}
            
            {topicSuggestions.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {topicSuggestions.map((topic, index) => (
                  <Button
                    key={index}
                    variant={selectedTopic === topic ? "default" : "outline"}
                    onClick={() => handleTopicSelect(topic)}
                    className="text-sm h-auto p-3 text-left justify-start"
                  >
                    {topic}
                  </Button>
                ))}
              </div>
            )}
            
            {topicSuggestions.length > 0 && (
              <div className="flex justify-center">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={loadTopicSuggestions}
                  disabled={loadingSuggestions}
                  className="text-xs"
                >
                  {loadingSuggestions ? (
                    <>
                      <RefreshCcw className="w-3 h-3 mr-1 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <RefreshCcw className="w-3 h-3 mr-1" />
                      Get More Suggestions
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!apiKeySet) {
    const hasEnvApiKey = apiKeyManager.hasApiKey();
    
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 space-y-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Educational Maze</h1>
          <p className="text-muted-foreground max-w-md">
            {hasEnvApiKey 
              ? "Ready to start your personalized learning journey!"
              : "Enter your OpenRouter API key to start your personalized learning journey"
            }
          </p>
        </div>
        
        <div className="w-full max-w-sm space-y-4">
          <div className="flex items-center space-x-2 mb-4">
            <input
              type="checkbox"
              id="useWikiEngine"
              checked={useWikiEngine}
              onChange={(e) => setUseWikiEngine(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="useWikiEngine" className="text-sm text-muted-foreground">
              Use Infinite-Wiki Engine (Enhanced Content)
            </label>
          </div>
          
          {!hasEnvApiKey && (
            <input
              type="password"
              placeholder="OpenRouter API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full p-3 border border-border rounded-lg bg-background text-foreground"
              onKeyDown={(e) => e.key === 'Enter' && handleApiKeySubmit()}
            />
          )}
          
          <Button onClick={handleApiKeySubmit} className="w-full">
            Start Learning
          </Button>
        </div>
        
        {!hasEnvApiKey && (
          <p className="text-xs text-muted-foreground text-center max-w-md">
            Get your API key from{' '}
            <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-primary underline">
              openrouter.ai
            </a>
            . Your key is stored locally and never shared.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header Stats */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Only show pause button when session is active, no manual start needed */}
            {sessionActive && (
              <Button
                size="sm"
                variant="destructive"
                onClick={pauseSession}
              >
                <Pause size={16} />
                Pause
              </Button>
            )}
            
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
        ) : (currentCard || progressiveCard) ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={(currentCard?.id || progressiveCard?.id) + (useProgressiveLoading ? '-progressive' : '-traditional')}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <LearningCard
                card={currentCard}
                progressiveCard={progressiveCard}
                cachedImage={currentCachedImage}
                actions={{
                  onUnderstand: handleUnderstand,
                  onQuickTest: handleQuickTest,    // Left swipe now opens quiz
                  onHelp: handleHelp,
                  onExplore: handleExplore,
                  onNavigate: handleNavigate,       // Center tap now opens navigation
                  onSelectTopic: handleSelectTopic  // From radial navigation
                }}
                isActive={sessionActive}
              />
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <BookOpen className="w-12 h-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              {sessionActive ? 'Generating your first learning card...' : 'Ready to begin your learning session'}
            </p>
            {sessionActive && (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            )}
          </div>
        )}

      </div>

      {/* Quiz Modal */}
      {showQuiz && ((quizQuestions.length > 0) || (progressiveQuiz && progressiveQuiz.questions.length > 0)) && (
        <QuizModal
          questions={progressiveQuiz ? progressiveQuiz.questions : quizQuestions}
          topic={currentCard?.topic || progressiveQuiz?.topic || ''}
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

      {/* Navigation Panel */}
      <NavigationPanel
        isOpen={showNavigationPanel}
        onClose={() => setShowNavigationPanel(false)}
        cachedCards={cachedCards}
        currentTopic={selectedTopic}
        onSelectCachedCard={handleSelectCachedCard}
        sessionStats={{
          cardsCompleted: sessionStats.cardsCompleted,
          sessionTime: formatSessionTime(sessionStats.sessionTime),
          masteryLevel: Math.round((sessionStats.accuracyRate || 0) * 100)
        }}
      />
    </div>
  );
}