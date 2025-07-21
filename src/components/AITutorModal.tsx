import { useState } from 'react';
import { LearningCard } from '@/services/openRouterService';
import { openRouterService } from '@/services/openRouterService';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Bot, 
  MessageCircle, 
  Lightbulb, 
  BookOpen,
  Brain,
  Zap,
  RefreshCcw
} from 'lucide-react';

interface AITutorModalProps {
  card: LearningCard;
  onClose: () => void;
}

interface HelpOption {
  id: string;
  title: string;
  description: string;
  icon: any;
  level: "beginner" | "intermediate" | "advanced";
}

const helpOptions: HelpOption[] = [
  {
    id: 'simplify',
    title: 'Simplify This',
    description: 'Break it down with simple language and analogies',
    icon: Lightbulb,
    level: 'beginner'
  },
  {
    id: 'examples',
    title: 'More Examples',
    description: 'Show me practical, real-world examples',
    icon: Zap,
    level: 'intermediate'
  },
  {
    id: 'deeper',
    title: 'Go Deeper',
    description: 'Provide technical depth and advanced connections',
    icon: Brain,
    level: 'advanced'
  },
  {
    id: 'analogy',
    title: 'Use an Analogy',
    description: 'Explain this concept using a familiar comparison',
    icon: MessageCircle,
    level: 'beginner'
  }
];

export function AITutorModal({ card, onClose }: AITutorModalProps) {
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [selectedOption, setSelectedOption] = useState<HelpOption | null>(null);
  const { toast } = useToast();

  const handleHelpRequest = async (option: HelpOption) => {
    setSelectedOption(option);
    setLoading(true);

    try {
      let adaptedExplanation;
      
      if (option.id === 'analogy') {
        // Special handling for analogies
        const prompt = `Explain "${card.topic}" using a simple, relatable analogy. Make it easy to understand and memorable.

Original content: ${card.content.definition}

Create a clear analogy that helps visualize or understand this concept.`;
        
        // This would need a custom method, but for now we'll use adaptExplanation
        adaptedExplanation = await openRouterService.adaptExplanation(
          `${card.content.definition}\n\nPlease explain this using a simple analogy.`,
          'beginner'
        );
      } else {
        adaptedExplanation = await openRouterService.adaptExplanation(
          card.content.definition,
          option.level
        );
      }

      setExplanation(adaptedExplanation);
      
      toast({
        title: "AI Tutor Response",
        description: `Generated ${option.level} level explanation`,
      });
    } catch (error) {
      console.error('Failed to get AI tutor help:', error);
      toast({
        title: "AI Tutor Unavailable",
        description: "Failed to generate explanation. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetTutor = () => {
    setExplanation('');
    setSelectedOption(null);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot size={20} className="text-primary" />
            AI Learning Assistant
          </DialogTitle>
          <DialogDescription>
            Get personalized help with: <strong>{card.topic}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {!explanation ? (
            /* Help Options */
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-foreground">How can I help you understand this better?</h3>
                <p className="text-xs text-muted-foreground">
                  Choose the type of explanation that works best for you:
                </p>
              </div>

              <div className="grid gap-3">
                {helpOptions.map((option) => {
                  const IconComponent = option.icon;
                  return (
                    <button
                      key={option.id}
                      onClick={() => handleHelpRequest(option)}
                      disabled={loading}
                      className="w-full text-left p-4 rounded-lg border border-border hover:border-primary/50 transition-all duration-200 hover:bg-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <IconComponent size={16} className="text-primary" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-foreground text-sm">
                              {option.title}
                            </h4>
                            <Badge 
                              variant="outline" 
                              className="text-xs py-0.5 px-2"
                            >
                              {option.level}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {option.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {loading && (
                <div className="flex items-center justify-center py-8 space-y-3">
                  <div className="text-center space-y-3">
                    <RefreshCcw className="w-6 h-6 animate-spin text-primary mx-auto" />
                    <p className="text-sm text-muted-foreground">
                      AI tutor is thinking...
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* AI Response */
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                {selectedOption && (
                  <>
                    <selectedOption.icon size={16} className="text-primary" />
                    <span className="text-sm font-medium text-foreground">
                      {selectedOption.title}
                    </span>
                    <Badge variant="outline" className="ml-auto">
                      {selectedOption.level}
                    </Badge>
                  </>
                )}
              </div>

              <div className="bg-accent/30 p-4 rounded-lg">
                <div className="prose prose-sm max-w-none">
                  <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {explanation}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetTutor}
                  className="flex-1"
                >
                  Try Different Approach
                </Button>
                <Button
                  size="sm"
                  onClick={onClose}
                  className="flex-1"
                >
                  Got It, Thanks!
                </Button>
              </div>
            </div>
          )}

          {/* Current Topic Summary */}
          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <BookOpen size={14} className="text-muted-foreground mt-0.5" />
              <div className="flex-1 text-xs">
                <p className="font-medium text-muted-foreground mb-1">Current Topic:</p>
                <p className="text-muted-foreground leading-relaxed">
                  {card.content.definition}
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}