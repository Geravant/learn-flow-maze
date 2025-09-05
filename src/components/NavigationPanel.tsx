import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { ScrollArea } from './ui/scroll-area';
import { 
  X,
  BookOpen,
  Clock,
  Target,
  TrendingUp,
  ChevronRight,
  Brain,
  Loader2,
  CheckCircle,
  ImageIcon
} from 'lucide-react';
import { LearningCard } from '../services/openRouterService';
import { CachedCard } from '../services/cardCacheService';

interface NavigationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  cachedCards: CachedCard[];
  currentTopic: string;
  onSelectCachedCard?: (cachedCard: CachedCard) => void;
  sessionStats?: {
    cardsCompleted: number;
    sessionTime: string;
    masteryLevel: number;
  };
}

function NavigationPanel({ 
  isOpen, 
  onClose, 
  cachedCards, 
  currentTopic,
  onSelectCachedCard,
  sessionStats = {
    cardsCompleted: 0,
    sessionTime: '0:00',
    masteryLevel: 0
  }
}: NavigationPanelProps) {

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          
          {/* Panel */}
          <motion.div
            className="fixed right-0 top-0 h-full w-80 bg-background border-l border-border z-50 shadow-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Brain size={20} className="text-primary" />
                  <h2 className="text-lg font-semibold">Learning Path</h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 w-8 p-0"
                >
                  <X size={16} />
                </Button>
              </div>

              <ScrollArea className="flex-1 p-4">
                {/* Current Topic */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Current Topic</h3>
                  <Card className="p-3 bg-primary/5 border-primary/20">
                    <div className="flex items-center gap-2">
                      <Target size={16} className="text-primary" />
                      <span className="font-medium">{currentTopic}</span>
                    </div>
                  </Card>
                </div>

                {/* Session Stats */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Session Progress</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Card className="p-3 text-center">
                      <BookOpen size={16} className="mx-auto mb-1 text-muted-foreground" />
                      <div className="text-lg font-semibold">{sessionStats.cardsCompleted}</div>
                      <div className="text-xs text-muted-foreground">Cards</div>
                    </Card>
                    <Card className="p-3 text-center">
                      <Clock size={16} className="mx-auto mb-1 text-muted-foreground" />
                      <div className="text-lg font-semibold">{sessionStats.sessionTime}</div>
                      <div className="text-xs text-muted-foreground">Time</div>
                    </Card>
                  </div>
                  
                  {/* Mastery Level */}
                  <Card className="p-3 mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Mastery Level</span>
                      <Badge variant="outline">
                        <TrendingUp size={12} className="mr-1" />
                        {sessionStats.masteryLevel}%
                      </Badge>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary rounded-full h-2 transition-all duration-300"
                        style={{ width: `${sessionStats.masteryLevel}%` }}
                      />
                    </div>
                  </Card>
                </div>

                {/* Cached Cards */}
                {cachedCards.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                      Cached Cards ({cachedCards.length})
                    </h3>
                    <div className="space-y-3">
                      {cachedCards.slice(0, 5).map((cachedCard, index) => (
                        <Card 
                          key={cachedCard.id}
                          className="p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => onSelectCachedCard?.(cachedCard)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                              {cachedCard.isFullyLoaded ? (
                                <CheckCircle size={12} className="text-green-500" />
                              ) : (
                                <span className="text-xs font-medium text-primary">
                                  {index + 1}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-foreground mb-1 line-clamp-1">
                                {cachedCard.topic}
                              </h4>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {cachedCard.card?.content?.definition || 'Loading...'}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge 
                                  variant="secondary" 
                                  className="text-xs h-5"
                                >
                                  Level {cachedCard.difficulty}
                                </Badge>
                                {cachedCard.generatedImage && (
                                  <Badge 
                                    variant="outline" 
                                    className="text-xs h-5"
                                  >
                                    <ImageIcon size={10} className="mr-1" />
                                    AI
                                  </Badge>
                                )}
                                {!cachedCard.isFullyLoaded && (
                                  <Badge 
                                    variant="outline" 
                                    className="text-xs h-5"
                                  >
                                    <Loader2 size={10} className="mr-1 animate-spin" />
                                    {cachedCard.loadingProgress}%
                                  </Badge>
                                )}
                              </div>
                              
                              {/* Loading Progress Bar */}
                              {!cachedCard.isFullyLoaded && (
                                <Progress 
                                  value={cachedCard.loadingProgress} 
                                  className="h-1 mt-2"
                                />
                              )}
                            </div>
                            <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
                          </div>
                        </Card>
                      ))}
                      
                      {cachedCards.length > 5 && (
                        <div className="text-center py-2">
                          <span className="text-xs text-muted-foreground">
                            +{cachedCards.length - 5} more cached cards
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {cachedCards.length === 0 && (
                  <div className="text-center py-8">
                    <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No cached cards yet
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cards will be cached as you progress
                    </p>
                  </div>
                )}
              </ScrollArea>

              {/* Footer Actions */}
              <div className="p-4 border-t border-border">
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={onClose}
                >
                  Continue Learning
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export { NavigationPanel };
export default NavigationPanel;