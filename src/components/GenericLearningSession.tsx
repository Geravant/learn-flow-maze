// Generic Learning Session - Shows integration with existing learning system
// Demonstrates backward compatibility while using the abstraction layer

import React, { useState } from 'react';
import { GenericSession } from '../abstractions/components/GenericSession';
import { LearningContentProvider, LearningPlaceholderProvider } from '../providers/LearningContentProvider';
import { learningTheme, SessionConfiguration } from '../abstractions/interfaces';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { BookOpen, Brain, Play, Settings } from 'lucide-react';

interface GenericLearningSessionProps {
  initialTopic?: string;
  onComplete?: (stats: any) => void;
}

export function GenericLearningSession({ 
  initialTopic, 
  onComplete 
}: GenericLearningSessionProps) {
  const [topic, setTopic] = useState(initialTopic || '');
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionConfig, setSessionConfig] = useState<SessionConfiguration>({
    name: "Enhanced Learning Session",
    maxCacheSize: 25,
    enableProgressiveLoading: true,
    enableAssetGeneration: true,
    supportedGestures: ["swipe", "doubleTap", "longPress"],
    theme: learningTheme,
    placeholderProvider: new LearningPlaceholderProvider()
  });

  const contentProvider = new LearningContentProvider();

  const startLearningSession = () => {
    if (topic.trim()) {
      setSessionStarted(true);
    }
  };

  const handleSessionComplete = (stats: any) => {
    setSessionStarted(false);
    onComplete?.(stats);
  };

  const handleSessionError = (error: Error) => {
    console.error('Learning session error:', error);
    // Could show error UI or fallback to traditional learning interface
  };

  if (sessionStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
        <GenericSession
          contentProvider={contentProvider}
          initialPrompt={topic}
          sessionConfig={sessionConfig}
          onComplete={handleSessionComplete}
          onError={handleSessionError}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Brain className="w-8 h-8 text-green-600" />
            <BookOpen className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Enhanced Learning Experience</h1>
          <p className="text-muted-foreground">
            Powered by the Generic Card System with progressive loading and interactive features
          </p>
        </div>

        <div className="space-y-6">
          {/* Topic Input */}
          <div>
            <label htmlFor="topic-input" className="block text-sm font-medium mb-2">
              What would you like to learn about?
            </label>
            <Input
              id="topic-input"
              placeholder="Enter a topic (e.g., Quantum Physics, Machine Learning, Art History)"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="text-lg py-3"
              onKeyPress={(e) => e.key === 'Enter' && startLearningSession()}
            />
          </div>

          {/* Quick Topic Suggestions */}
          <div>
            <p className="text-sm font-medium mb-3">Popular Topics:</p>
            <div className="flex flex-wrap gap-2">
              {[
                'Artificial Intelligence',
                'Climate Change',
                'Renaissance Art',
                'Quantum Computing',
                'Psychology',
                'Cryptocurrency',
                'Space Exploration',
                'Genetics'
              ].map((suggestedTopic) => (
                <Button
                  key={suggestedTopic}
                  variant="outline"
                  size="sm"
                  onClick={() => setTopic(suggestedTopic)}
                  className="hover:bg-primary hover:text-primary-foreground"
                >
                  {suggestedTopic}
                </Button>
              ))}
            </div>
          </div>

          {/* Feature Highlights */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Enhanced Features
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="w-2 h-2 rounded-full p-0"></Badge>
                Progressive content loading
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="w-2 h-2 rounded-full p-0"></Badge>
                Swipe navigation
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="w-2 h-2 rounded-full p-0"></Badge>
                Interactive learning cards
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="w-2 h-2 rounded-full p-0"></Badge>
                Context-aware jokes
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="w-2 h-2 rounded-full p-0"></Badge>
                Smart caching system
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="w-2 h-2 rounded-full p-0"></Badge>
                Session analytics
              </div>
            </div>
          </div>

          {/* Start Button */}
          <Button
            onClick={startLearningSession}
            disabled={!topic.trim()}
            size="lg"
            className="w-full text-lg py-6"
          >
            <Play className="w-5 h-5 mr-3" />
            Start Learning Journey
          </Button>

          {/* Backward Compatibility Note */}
          <div className="text-center text-sm text-muted-foreground border-t pt-4">
            <p>
              This enhanced experience uses the same learning content generation as the original system,
              but with improved UI interactions and progressive loading.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default GenericLearningSession;