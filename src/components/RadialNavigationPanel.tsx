import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Circle, ArrowRight } from 'lucide-react';

interface RadialOption {
  id: string;
  topic: string;
  difficulty: number;
  angle: number;
}

interface RadialNavigationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTopic: (topic: string) => void;
  currentTopic: string;
  surroundingConcepts: string[];
}

export function RadialNavigationPanel({ 
  isOpen, 
  onClose, 
  onSelectTopic, 
  currentTopic,
  surroundingConcepts 
}: RadialNavigationPanelProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  
  // Convert concepts to radial options with angles
  const radialOptions: RadialOption[] = surroundingConcepts.map((concept, index) => ({
    id: `concept-${index}`,
    topic: concept,
    difficulty: Math.floor(Math.random() * 3) + 2, // 2-4 difficulty
    angle: (360 / surroundingConcepts.length) * index
  }));

  const radius = 120; // Distance from center
  const centerX = 150; // SVG center X
  const centerY = 150; // SVG center Y

  // Calculate position for each option
  const getOptionPosition = (angle: number) => {
    const radian = (angle - 90) * (Math.PI / 180); // -90 to start from top
    return {
      x: centerX + radius * Math.cos(radian),
      y: centerY + radius * Math.sin(radian)
    };
  };

  const handleOptionClick = (topic: string) => {
    onSelectTopic(topic);
    onClose();
  };

  const getDifficultyColor = (level: number) => {
    switch (level) {
      case 1: return 'hsl(var(--chart-1))';
      case 2: return 'hsl(var(--chart-2))';
      case 3: return 'hsl(var(--chart-3))';
      case 4: return 'hsl(var(--chart-4))';
      case 5: return 'hsl(var(--chart-5))';
      default: return 'hsl(var(--muted))';
    }
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyPress);
      return () => document.removeEventListener('keydown', handleKeyPress);
    }
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Radial Interface */}
          <motion.div
            className="relative"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <svg width="300" height="300" className="overflow-visible">
              {/* Center circle */}
              <motion.circle
                cx={centerX}
                cy={centerY}
                r="40"
                fill="hsl(var(--background))"
                stroke="hsl(var(--border))"
                strokeWidth="2"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1 }}
              />
              
              {/* Current topic in center */}
              <text
                x={centerX}
                y={centerY - 5}
                textAnchor="middle"
                className="fill-foreground text-xs font-medium"
                style={{ fontSize: '11px' }}
              >
                Current:
              </text>
              <text
                x={centerX}
                y={centerY + 8}
                textAnchor="middle"
                className="fill-primary text-xs font-bold"
                style={{ fontSize: '10px' }}
              >
                {currentTopic.length > 12 ? `${currentTopic.slice(0, 12)}...` : currentTopic}
              </text>

              {/* Connection lines */}
              {radialOptions.map((option, index) => {
                const pos = getOptionPosition(option.angle);
                return (
                  <motion.line
                    key={`line-${option.id}`}
                    x1={centerX}
                    y1={centerY}
                    x2={pos.x}
                    y2={pos.y}
                    stroke="hsl(var(--border))"
                    strokeWidth="1"
                    strokeDasharray="3,3"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 0.3 }}
                    transition={{ delay: 0.2 + index * 0.1 }}
                  />
                );
              })}

              {/* Option circles */}
              {radialOptions.map((option, index) => {
                const pos = getOptionPosition(option.angle);
                const isSelected = selectedIndex === index;
                
                return (
                  <g key={option.id}>
                    {/* Option circle */}
                    <motion.circle
                      cx={pos.x}
                      cy={pos.y}
                      r={isSelected ? "32" : "28"}
                      fill="hsl(var(--background))"
                      stroke={getDifficultyColor(option.difficulty)}
                      strokeWidth="2"
                      className="cursor-pointer"
                      onMouseEnter={() => setSelectedIndex(index)}
                      onMouseLeave={() => setSelectedIndex(null)}
                      onClick={() => handleOptionClick(option.topic)}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.3 + index * 0.1, type: "spring" }}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                    />
                    
                    {/* Option text */}
                    <text
                      x={pos.x}
                      y={pos.y - 2}
                      textAnchor="middle"
                      className="fill-foreground text-xs font-medium pointer-events-none"
                      style={{ fontSize: '9px' }}
                    >
                      {option.topic.length > 8 ? `${option.topic.slice(0, 8)}...` : option.topic}
                    </text>
                    
                    {/* Difficulty indicator */}
                    <text
                      x={pos.x}
                      y={pos.y + 10}
                      textAnchor="middle"
                      className="fill-muted-foreground text-xs pointer-events-none"
                      style={{ fontSize: '8px' }}
                    >
                      L{option.difficulty}
                    </text>

                    {/* Selection arrow */}
                    {isSelected && (
                      <motion.g
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 400 }}
                      >
                        <circle
                          cx={pos.x + 40}
                          cy={pos.y}
                          r="12"
                          fill="hsl(var(--primary))"
                          className="drop-shadow-lg"
                        />
                        <ArrowRight
                          x={pos.x + 40 - 6}
                          y={pos.y - 6}
                          width="12"
                          height="12"
                          className="fill-primary-foreground"
                        />
                      </motion.g>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Instructions */}
            <motion.div
              className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <p className="text-xs text-muted-foreground">
                Select a concept to explore next
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Tap outside or press ESC to close
              </p>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}