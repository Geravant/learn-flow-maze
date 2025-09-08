// Custom hook for card gesture handling
// Abstracted gesture logic from LearningCard to be reusable across any content type

import { useRef, useCallback, useState } from 'react';
import { useMotionValue, PanInfo } from 'framer-motion';
import { CardContent, CardActions } from '../interfaces';

export interface GestureConfig {
  swipeThreshold?: number;
  doubleTapThreshold?: number;
  longPressThreshold?: number;
  rotationFactor?: number;
  enabledGestures?: string[];
}

export interface GestureState {
  isDragging: boolean;
  showHints: boolean;
  lastTapTime: number;
}

export interface GestureHandlers {
  handlePanStart: () => void;
  handlePanEnd: (event: any, info: PanInfo) => void;
  handleTap: (event: React.MouseEvent) => void;
  handleLongPress: () => void;
  resetGestureState: () => void;
}

const DEFAULT_CONFIG: Required<GestureConfig> = {
  swipeThreshold: 100,
  doubleTapThreshold: 300,
  longPressThreshold: 1000,
  rotationFactor: 0.1,
  enabledGestures: ['swipe', 'doubleTap', 'longPress']
};

export function useCardGestures(
  content: CardContent,
  actions: CardActions,
  config: GestureConfig = {}
) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Motion values for animations
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  // Gesture state
  const [gestureState, setGestureState] = useState<GestureState>({
    isDragging: false,
    showHints: false,
    lastTapTime: 0
  });
  
  // Refs for timers
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const tapTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Pan/swipe handlers
  const handlePanStart = useCallback(() => {
    if (!finalConfig.enabledGestures.includes('swipe')) return;
    
    setGestureState(prev => ({
      ...prev,
      isDragging: true,
      showHints: true
    }));
    
    // Clear any pending long press
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, [finalConfig.enabledGestures]);

  const handlePanEnd = useCallback((event: any, info: PanInfo) => {
    if (!finalConfig.enabledGestures.includes('swipe')) return;
    
    setGestureState(prev => ({
      ...prev,
      isDragging: false,
      showHints: false
    }));

    const offsetX = info.offset.x;
    const offsetY = info.offset.y;
    const velocityX = info.velocity.x;
    const velocityY = info.velocity.y;

    // Determine primary direction and trigger appropriate action
    if (Math.abs(offsetX) > Math.abs(offsetY)) {
      // Horizontal swipe
      if (offsetX > finalConfig.swipeThreshold || velocityX > 500) {
        actions.onSwipeRight?.(content);
      } else if (offsetX < -finalConfig.swipeThreshold || velocityX < -500) {
        actions.onSwipeLeft?.(content);
      }
    } else {
      // Vertical swipe
      if (offsetY > finalConfig.swipeThreshold || velocityY > 500) {
        actions.onSwipeDown?.(content);
      } else if (offsetY < -finalConfig.swipeThreshold || velocityY < -500) {
        actions.onSwipeUp?.(content);
      }
    }

    // Reset position
    x.set(0);
    y.set(0);
  }, [actions, content, finalConfig.swipeThreshold, finalConfig.enabledGestures, x, y]);

  // Tap handlers
  const handleTap = useCallback((event: React.MouseEvent) => {
    if (!finalConfig.enabledGestures.includes('doubleTap')) return;
    
    const now = Date.now();
    const rect = event.currentTarget.getBoundingClientRect();
    const location = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };

    if (now - gestureState.lastTapTime < finalConfig.doubleTapThreshold) {
      // Double tap detected
      if (tapTimer.current) {
        clearTimeout(tapTimer.current);
        tapTimer.current = null;
      }
      
      actions.onDoubleTap?.(content, location);
      
      setGestureState(prev => ({
        ...prev,
        lastTapTime: 0 // Reset to prevent triple tap
      }));
    } else {
      // Single tap - wait for potential double tap
      setGestureState(prev => ({
        ...prev,
        lastTapTime: now
      }));
      
      // Clear any existing timer
      if (tapTimer.current) {
        clearTimeout(tapTimer.current);
      }
      
      // Set timer for single tap action (if needed)
      tapTimer.current = setTimeout(() => {
        // Single tap action could go here if needed
        // For now, we only handle double taps
      }, finalConfig.doubleTapThreshold);
    }
  }, [actions, content, finalConfig.doubleTapThreshold, finalConfig.enabledGestures, gestureState.lastTapTime]);

  // Long press handlers
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (!finalConfig.enabledGestures.includes('longPress')) return;
    
    // Start long press timer
    longPressTimer.current = setTimeout(() => {
      handleLongPress();
    }, finalConfig.longPressThreshold);
    
    // Also handle potential tap
    handleTap(event);
  }, [finalConfig.enabledGestures, finalConfig.longPressThreshold, handleTap]);

  const handleMouseUp = useCallback(() => {
    // Clear long press timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleLongPress = useCallback(() => {
    if (!finalConfig.enabledGestures.includes('longPress')) return;
    
    actions.onLongPress?.(content);
    
    // Clear the timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, [actions, content, finalConfig.enabledGestures]);

  // Context menu handler (right-click as alternative to long press)
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    handleLongPress();
  }, [handleLongPress]);

  // Touch handlers for mobile
  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    if (!finalConfig.enabledGestures.includes('longPress')) return;
    
    // Start long press timer for touch
    longPressTimer.current = setTimeout(() => {
      handleLongPress();
    }, finalConfig.longPressThreshold);
  }, [finalConfig.enabledGestures, finalConfig.longPressThreshold, handleLongPress]);

  const handleTouchEnd = useCallback(() => {
    // Clear long press timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Reset gesture state
  const resetGestureState = useCallback(() => {
    setGestureState({
      isDragging: false,
      showHints: false,
      lastTapTime: 0
    });
    
    // Clear all timers
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
    }
    
    // Reset motion values
    x.set(0);
    y.set(0);
  }, [x, y]);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
    }
  }, []);

  // Section tap handler
  const handleSectionTap = useCallback((section: any) => {
    actions.onSectionTap?.(section, content);
  }, [actions, content]);

  return {
    // Motion values
    x,
    y,
    
    // Gesture state
    gestureState,
    
    // Event handlers
    handlers: {
      handlePanStart,
      handlePanEnd,
      handleTap: handleMouseDown, // Use mouse down for combined tap/long press
      handleMouseUp,
      handleContextMenu,
      handleTouchStart,
      handleTouchEnd,
      handleLongPress,
      handleSectionTap,
      resetGestureState
    } as GestureHandlers & {
      handleMouseUp: () => void;
      handleContextMenu: (event: React.MouseEvent) => void;
      handleTouchStart: (event: React.TouchEvent) => void;
      handleTouchEnd: () => void;
      handleSectionTap: (section: any) => void;
    },
    
    // Utility functions
    resetGestureState,
    cleanup,
    
    // Configuration
    config: finalConfig
  };
}

// Hook for gesture hint display
export function useGestureHints(gestureState: GestureState, actions: CardActions) {
  const getAvailableGestures = useCallback(() => {
    const gestures = [];
    
    if (actions.onSwipeUp) gestures.push({ direction: 'up', icon: '↑', label: 'Up' });
    if (actions.onSwipeDown) gestures.push({ direction: 'down', icon: '↓', label: 'Down' });
    if (actions.onSwipeLeft) gestures.push({ direction: 'left', icon: '←', label: 'Left' });
    if (actions.onSwipeRight) gestures.push({ direction: 'right', icon: '→', label: 'Right' });
    if (actions.onDoubleTap) gestures.push({ direction: 'center', icon: '⌕', label: 'Double Tap' });
    if (actions.onLongPress) gestures.push({ direction: 'center', icon: '●', label: 'Long Press' });
    
    return gestures;
  }, [actions]);

  return {
    shouldShowHints: gestureState.showHints,
    availableGestures: getAvailableGestures()
  };
}

export default useCardGestures;