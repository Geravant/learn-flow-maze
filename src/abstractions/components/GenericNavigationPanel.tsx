// Generic Navigation Panel Component
// Abstracted from NavigationPanel.tsx to work with any content type

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { ScrollArea } from '../../components/ui/scroll-area';
import { 
  X,
  ChevronRight,
  Clock,
  Target,
  TrendingUp,
  Loader2,
  CheckCircle,
  Layers
} from 'lucide-react';
import { CachedCard, CardTheme, defaultTheme } from '../interfaces';

export interface GenericNavigationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  historyCards: CachedCard[];
  nextCards: CachedCard[];
  currentCardId?: string;
  onSelectCard?: (card: CachedCard) => void;
  sessionStats?: {
    cardsGenerated: number;
    sessionTime: string;
    totalTime: number;
    cacheHitRate: number;
  };
  theme?: CardTheme;
  title?: string;
  icon?: React.ReactNode;
}

export function GenericNavigationPanel({ 
  isOpen, 
  onClose, 
  historyCards, 
  nextCards, 
  currentCardId,
  onSelectCard,
  sessionStats = {
    cardsGenerated: 0,
    sessionTime: '0:00',
    totalTime: 0,
    cacheHitRate: 0
  },
  theme = defaultTheme,
  title = "Navigation",
  icon = <Layers size={20} />
}: GenericNavigationPanelProps) {

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const renderCardPreview = (card: CachedCard, index: number, section: 'history' | 'next') => {
    const isCurrentCard = card.id === currentCardId;
    const sectionColor = section === 'history' ? '#f59e0b' : theme.primaryColor; // amber for history
    
    return (
      <motion.div
        key={card.id}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.1 }}
        className={`
          border rounded-lg p-3 cursor-pointer transition-all duration-200 hover:shadow-md
          ${isCurrentCard ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'}
        `}
        onClick={() => onSelectCard?.(card)}
        style={{
          borderColor: isCurrentCard ? theme.primaryColor : 'hsl(var(--border))'
        }}
      >
        <div className="flex items-start gap-3">
          {/* Loading/Status Indicator */}
          <div className="flex-shrink-0 mt-1">
            {card.isFullyLoaded ? (
              <CheckCircle size={16} style={{ color: sectionColor }} />
            ) : (
              <Loader2 size={16} className="animate-spin" style={{ color: sectionColor }} />
            )}
          </div>

          {/* Card Content Preview */}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate mb-1">
              {card.content.title}
            </h4>
            
            {/* First section preview */}
            {card.content.sections.length > 0 && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                {typeof card.content.sections[0].content === 'string' 
                  ? card.content.sections[0].content.slice(0, 100)
                  : 'Content available'
                }...
              </p>
            )}

            {/* Card Metadata */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock size={12} />
                <span>{new Date(card.createdAt).toLocaleTimeString()}</span>
              </div>
              
              {!card.isFullyLoaded && (
                <div className="flex items-center gap-1">
                  <Progress 
                    value={card.loadingProgress} 
                    className="w-12 h-1"
                  />
                  <span className="text-xs text-muted-foreground">
                    {card.loadingProgress}%
                  </span>
                </div>
              )}
            </div>

            {/* Tags */}
            {card.content.tags && card.content.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {card.content.tags.slice(0, 2).map((tag, tagIndex) => (
                  <Badge key={tagIndex} variant="secondary" className="text-xs px-1 py-0">
                    {tag}
                  </Badge>
                ))}
                {card.content.tags.length > 2 && (
                  <Badge variant="secondary" className="text-xs px-1 py-0">
                    +{card.content.tags.length - 2}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Navigation Arrow */}
          <ChevronRight size={14} className="flex-shrink-0 mt-2 text-muted-foreground" />
        </div>
      </motion.div>
    );
  };

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
            style={{ backgroundColor: theme.backgroundColor }}
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <span style={{ color: theme.primaryColor }}>{icon}</span>
                  <h2 className="text-lg font-semibold" style={{ color: theme.textColor }}>
                    {title}
                  </h2>
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
                {/* Session Stats */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium mb-3" style={{ color: theme.primaryColor }}>
                    Session Statistics
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/30 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold" style={{ color: theme.primaryColor }}>
                        {sessionStats.cardsGenerated}
                      </div>
                      <div className="text-xs text-muted-foreground">Cards</div>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold" style={{ color: theme.primaryColor }}>
                        {formatTime(sessionStats.totalTime)}
                      </div>
                      <div className="text-xs text-muted-foreground">Time</div>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold" style={{ color: theme.primaryColor }}>
                        {Math.round(sessionStats.cacheHitRate)}%
                      </div>
                      <div className="text-xs text-muted-foreground">Cache Hit</div>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3 text-center">
                      <TrendingUp 
                        size={16} 
                        className="mx-auto mb-1" 
                        style={{ color: theme.primaryColor }} 
                      />
                      <div className="text-xs text-muted-foreground">Efficiency</div>
                    </div>
                  </div>
                </div>

                {/* Current Card Indicator */}
                {currentCardId && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium mb-2" style={{ color: theme.primaryColor }}>
                      Current Position
                    </h3>
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center gap-2">
                      <Target size={16} style={{ color: theme.primaryColor }} />
                      <span className="text-sm font-medium">Active Card</span>
                    </div>
                  </div>
                )}

                {/* History Section */}
                {historyCards.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <span style={{ color: '#f59e0b' }}>←</span>
                      <span style={{ color: theme.textColor }}>
                        History ({historyCards.length})
                      </span>
                    </h3>
                    <div className="space-y-2">
                      {historyCards.map((card, index) => 
                        renderCardPreview(card, index, 'history')
                      )}
                    </div>
                  </div>
                )}

                {/* Next Cards Section */}
                {nextCards.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <span style={{ color: theme.primaryColor }}>→</span>
                      <span style={{ color: theme.textColor }}>
                        Next Cards ({nextCards.length})
                      </span>
                    </h3>
                    <div className="space-y-2">
                      {nextCards.map((card, index) => 
                        renderCardPreview(card, index, 'next')
                      )}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {historyCards.length === 0 && nextCards.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Layers size={32} className="mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No cards in navigation stack</p>
                    <p className="text-xs mt-1">Cards will appear here as you navigate</p>
                  </div>
                )}
              </ScrollArea>

              {/* Footer Actions */}
              <div className="border-t border-border p-4">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onClose}
                    className="flex-1"
                  >
                    Close
                  </Button>
                  {(historyCards.length > 0 || nextCards.length > 0) && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        // Could add export or share functionality
                        console.log('Export navigation stack');
                      }}
                      className="flex-1"
                      style={{ backgroundColor: theme.primaryColor }}
                    >
                      Export
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default GenericNavigationPanel;