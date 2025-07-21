import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QuizQuestion } from '@/services/openRouterService';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  XCircle, 
  Brain, 
  Clock,
  Target 
} from 'lucide-react';

interface QuizModalProps {
  questions: QuizQuestion[];
  topic: string;
  onComplete: (score: number) => void;
  onClose: () => void;
}

export function QuizModal({ questions, topic, onComplete, onClose }: QuizModalProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);

  // Handle empty questions or invalid index
  if (!questions || questions.length === 0) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Quiz Unavailable</DialogTitle>
            <DialogDescription>
              Sorry, quiz questions are still loading. Please try again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center pt-4">
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  // Additional safety check for current question
  if (!currentQuestion) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Loading Question...</DialogTitle>
            <DialogDescription>
              Please wait while the question loads.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center pt-4">
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleAnswerSelect = (answerIndex: number) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestionIndex] = answerIndex;
    setUserAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      calculateResults();
    }
  };

  const calculateResults = () => {
    if (!questions || questions.length === 0) {
      onComplete(0);
      return;
    }
    
    const correctAnswers = userAnswers.filter((answer, index) => 
      questions[index] && answer === questions[index].correctAnswer
    ).length;
    
    setSelectedAnswers(userAnswers);
    setShowResults(true);
    
    // Complete after showing results
    setTimeout(() => {
      onComplete(correctAnswers);
    }, 3000);
  };

  const getAnswerColor = (questionIndex: number, answerIndex: number) => {
    if (!showResults || !questions || !questions[questionIndex]) return '';
    
    const question = questions[questionIndex];
    const userAnswer = selectedAnswers[questionIndex];
    
    if (answerIndex === question.correctAnswer) {
      return 'border-green-500 bg-green-50 text-green-700';
    } else if (answerIndex === userAnswer && answerIndex !== question.correctAnswer) {
      return 'border-red-500 bg-red-50 text-red-700';
    }
    
    return 'border-border bg-muted/30';
  };

  const isAnswerSelected = (answerIndex: number) => {
    return userAnswers[currentQuestionIndex] === answerIndex;
  };

  const canProceed = userAnswers[currentQuestionIndex] !== undefined;

  if (showResults) {
    if (!questions || questions.length === 0) {
      return (
        <Dialog open={true} onOpenChange={onClose}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center">Quiz Error</DialogTitle>
              <DialogDescription className="text-center">
                Unable to show results - no questions found.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center pt-4">
              <Button onClick={onClose}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      );
    }
    
    const score = selectedAnswers.filter((answer, index) => 
      questions[index] && answer === questions[index].correctAnswer
    ).length;
    
    const percentage = Math.round((score / questions.length) * 100);

    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Quiz Results</DialogTitle>
            <DialogDescription className="text-center">
              {topic} Assessment
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Score Display */}
            <div className="text-center space-y-4">
              <div className="relative w-24 h-24 mx-auto">
                <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="hsl(var(--muted))"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="hsl(var(--primary))"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={`${percentage * 2.51} 251`}
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-foreground">{percentage}%</span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-lg font-semibold text-foreground">
                  {score} out of {questions.length} correct
                </p>
                <p className="text-sm text-muted-foreground">
                  {percentage >= 80 ? 'Excellent!' : 
                   percentage >= 60 ? 'Good job!' : 
                   'Keep practicing!'}
                </p>
              </div>
            </div>

            {/* Question Results */}
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {questions.map((question, qIndex) => (
                <div key={question.id} className="space-y-2">
                  <div className="flex items-start gap-2">
                    {selectedAnswers[qIndex] === question.correctAnswer ? (
                      <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {question.question}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {question.explanation}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                Returning to learning session...
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target size={18} />
            Quick Assessment
          </DialogTitle>
          <DialogDescription>
            Test your understanding of {topic}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
              <Badge variant="outline">
                <Clock size={12} className="mr-1" />
                ~30s
              </Badge>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Question */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestionIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="space-y-3">
                <h3 className="text-base font-medium text-foreground leading-relaxed">
                  {currentQuestion.question}
                </h3>

                <div className="space-y-2">
                  {currentQuestion.options.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => handleAnswerSelect(index)}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all duration-200 ${
                        isAnswerSelected(index)
                          ? 'border-primary bg-primary/10 text-primary-foreground' 
                          : 'border-border bg-background hover:border-primary/50 text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isAnswerSelected(index) 
                            ? 'border-primary bg-primary' 
                            : 'border-border'
                        }`}>
                          {isAnswerSelected(index) && (
                            <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                          )}
                        </div>
                        <span className="text-sm">{option}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                >
                  Skip Quiz
                </Button>
                
                <Button
                  onClick={handleNext}
                  disabled={!canProceed}
                  size="sm"
                >
                  {currentQuestionIndex === questions.length - 1 ? 'Finish' : 'Next'}
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}