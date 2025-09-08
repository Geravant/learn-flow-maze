// Generic Card Component with gesture handling and theme support
// Based on UI-logic-abstraction.md design document

import React, { useState, useCallback, useRef } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { 
  GenericCardProps, 
  CardSection, 
  CardTheme, 
  defaultTheme 
} from '../interfaces';
import { 
  CheckCircle, 
  Clock, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertTriangle
} from 'lucide-react';

const SWIPE_THRESHOLD = 100;
const ROTATION_FACTOR = 0.1;

interface SectionRendererProps {
  section: CardSection;
  theme: CardTheme;
  onSectionTap?: (section: CardSection) => void;
  renderCustomSection?: (section: CardSection) => React.ReactNode;
}

function SectionRenderer({ 
  section, 
  theme, 
  onSectionTap, 
  renderCustomSection 
}: SectionRendererProps) {
  // Try custom renderer first
  if (renderCustomSection) {
    const customContent = renderCustomSection(section);
    if (customContent) {
      return (
        <div 
          className="section-container cursor-pointer" 
          onClick={() => onSectionTap?.(section)}
        >
          {customContent}
        </div>
      );
    }
  }

  // Handle loading state
  if (section.loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary mr-3" />
        <span className="text-muted-foreground">Loading {section.title || section.type}...</span>
      </div>
    );
  }

  // Handle error state
  if (section.error) {
    return (
      <div className="flex items-center justify-center py-8 text-destructive">
        <AlertTriangle className="w-6 h-6 mr-3" />
        <span>Error loading {section.title || section.type}: {section.error}</span>
      </div>
    );
  }

  const sectionStyle = theme.sectionStyles[section.type] || theme.sectionStyles.custom;

  return (
    <div 
      className="section-container cursor-pointer transition-colors hover:bg-muted/20 rounded-lg"
      style={sectionStyle}
      onClick={() => onSectionTap?.(section)}
    >
      {section.title && (
        <h3 className="text-lg font-semibold mb-3" style={{ color: theme.primaryColor }}>
          {section.title}
        </h3>
      )}
      
      <div className="section-content">
        {renderSectionContent(section, theme)}
      </div>
    </div>
  );
}

function renderSectionContent(section: CardSection, theme: CardTheme): React.ReactNode {
  switch (section.type) {
    case 'text':
      return (
        <div className="prose prose-sm max-w-none" style={{ color: theme.textColor }}>
          {typeof section.content === 'string' ? (
            <p className="whitespace-pre-wrap">{section.content}</p>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: section.content }} />
          )}
        </div>
      );

    case 'list':
      const items = Array.isArray(section.content) ? section.content : [section.content];
      return (
        <ul className="list-disc list-inside space-y-2" style={{ color: theme.textColor }}>
          {items.map((item, index) => (
            <li key={index}>{typeof item === 'string' ? item : JSON.stringify(item)}</li>
          ))}
        </ul>
      );

    case 'image':
      if (typeof section.content === 'string') {
        return (
          <img 
            src={section.content} 
            alt={section.title || 'Card image'} 
            className="max-w-full h-auto rounded-lg shadow-sm"
          />
        );
      }
      break;

    case 'code':
      return (
        <pre className="overflow-x-auto text-sm" style={theme.sectionStyles.code}>
          <code>{section.content}</code>
        </pre>
      );

    default:
      // Fallback for unknown section types
      return (
        <div style={{ color: theme.textColor }}>
          {typeof section.content === 'object' ? (
            <pre className="text-sm overflow-x-auto">
              {JSON.stringify(section.content, null, 2)}
            </pre>
          ) : (
            <span>{String(section.content)}</span>
          )}
        </div>
      );
  }

  return null;
}

export function GenericCard({ 
  content, 
  cachedAssets, 
  actions, 
  isActive = true, 
  renderCustomSection,
  theme = defaultTheme
}: GenericCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showGestureHints, setShowGestureHints] = useState(false);
  const lastTapTime = useRef<number>(0);
  const doubleTapThreshold = 300; // 300ms for double tap detection

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  // Transform values for visual feedback
  const rotateZ = useTransform(x, [-200, 200], [-10, 10]);
  const opacity = useTransform(x, [-150, 0, 150], [0.7, 1, 0.7]);

  const handlePanStart = useCallback(() => {
    setIsDragging(true);
    setShowGestureHints(true);
  }, []);

  const handlePanEnd = useCallback((event: any, info: PanInfo) => {
    setIsDragging(false);
    setShowGestureHints(false);

    const offsetX = info.offset.x;
    const offsetY = info.offset.y;
    const velocityX = info.velocity.x;
    const velocityY = info.velocity.y;

    // Determine primary direction
    if (Math.abs(offsetX) > Math.abs(offsetY)) {
      // Horizontal swipe
      if (offsetX > SWIPE_THRESHOLD || velocityX > 500) {
        actions.onSwipeRight?.(content);
      } else if (offsetX < -SWIPE_THRESHOLD || velocityX < -500) {
        actions.onSwipeLeft?.(content);
      }
    } else {
      // Vertical swipe
      if (offsetY > SWIPE_THRESHOLD || velocityY > 500) {
        actions.onSwipeDown?.(content);
      } else if (offsetY < -SWIPE_THRESHOLD || velocityY < -500) {
        actions.onSwipeUp?.(content);
      }
    }

    // Reset position
    x.set(0);
    y.set(0);
  }, [actions, content, x, y]);

  const handleTap = useCallback((event: React.MouseEvent) => {
    const now = Date.now();
    const rect = event.currentTarget.getBoundingClientRect();
    const location = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };

    if (now - lastTapTime.current < doubleTapThreshold) {
      // Double tap
      actions.onDoubleTap?.(content, location);
    }

    lastTapTime.current = now;
  }, [actions, content]);

  const handleLongPress = useCallback(() => {
    actions.onLongPress?.(content);
  }, [actions, content]);

  const handleSectionTap = useCallback((section: CardSection) => {
    actions.onSectionTap?.(section, content);
  }, [actions, content]);

  // Sort sections by priority
  const sortedSections = [...content.sections].sort((a, b) => a.priority - b.priority);

  return (
    <div className="generic-card-container relative w-full max-w-2xl mx-auto">
      <motion.div
        drag={isActive}
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0.2}
        onPanStart={handlePanStart}
        onPanEnd={handlePanEnd}
        onClick={handleTap}
        onContextMenu={(e) => {
          e.preventDefault();
          handleLongPress();
        }}
        style={{
          x,
          y,
          rotateZ,
          opacity,
          backgroundColor: theme.backgroundColor
        }}
        whileHover={{ scale: isActive ? 1.02 : 1 }}
        whileTap={{ scale: isActive ? 0.98 : 1 }}
        className="cursor-pointer"
      >
        <Card className="overflow-hidden shadow-lg border-2 transition-all duration-200"
              style={{ borderColor: theme.primaryColor + '20' }}>
          {/* Card Header */}
          <div 
            className="px-6 py-4 border-b"
            style={{ 
              backgroundColor: theme.primaryColor + '10',
              borderBottomColor: theme.primaryColor + '20'
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 
                  className="text-xl font-bold mb-2 leading-tight"
                  style={{ color: theme.primaryColor }}
                >
                  {content.title}
                </h2>
                
                {/* Tags */}
                {content.tags && content.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {content.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Metadata */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{new Date(content.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    <span>{sortedSections.length} sections</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card Content */}
          <div className="card-content">
            {sortedSections.map((section) => (
              <SectionRenderer
                key={section.id}
                section={section}
                theme={theme}
                onSectionTap={handleSectionTap}
                renderCustomSection={renderCustomSection}
              />
            ))}
          </div>

          {/* Assets Display */}
          {cachedAssets && (
            <div className="px-6 py-4 border-t" style={{ borderTopColor: theme.primaryColor + '20' }}>
              {cachedAssets.images && cachedAssets.images.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2" style={{ color: theme.primaryColor }}>
                    Generated Images
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {cachedAssets.images.slice(0, 4).map((image, index) => (
                      <img 
                        key={index}
                        src={image} 
                        alt={`Generated ${index + 1}`}
                        className="w-full h-24 object-cover rounded border"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </motion.div>

      {/* Gesture Hints */}
      {showGestureHints && isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 pointer-events-none flex items-center justify-center bg-black/10 rounded-lg"
        >
          <div className="grid grid-cols-3 grid-rows-3 gap-4 text-white/80">
            {actions.onSwipeUp && (
              <div className="col-start-2 row-start-1 flex flex-col items-center">
                <ArrowUp className="w-8 h-8" />
                <span className="text-sm">Up</span>
              </div>
            )}
            
            {actions.onSwipeLeft && (
              <div className="col-start-1 row-start-2 flex flex-col items-center">
                <ArrowLeft className="w-8 h-8" />
                <span className="text-sm">Left</span>
              </div>
            )}
            
            {actions.onSwipeRight && (
              <div className="col-start-3 row-start-2 flex flex-col items-center">
                <ArrowRight className="w-8 h-8" />
                <span className="text-sm">Right</span>
              </div>
            )}
            
            {actions.onSwipeDown && (
              <div className="col-start-2 row-start-3 flex flex-col items-center">
                <ArrowDown className="w-8 h-8" />
                <span className="text-sm">Down</span>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Loading Overlay */}
      {sortedSections.some(section => section.loading) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-lg"
        >
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading content...</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default GenericCard;