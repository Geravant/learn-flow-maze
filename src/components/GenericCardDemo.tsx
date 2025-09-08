// Demo component to test the Generic Card System
// Shows how to use the abstraction layer with different content providers

import React, { useState } from 'react';
import { GenericSession } from '../abstractions/components/GenericSession';
import { ExampleContentProvider, ProgressiveExampleProvider, ExamplePlaceholderProvider } from '../abstractions/providers/ContentProvider';
import { LearningContentProvider, LearningPlaceholderProvider } from '../providers/LearningContentProvider';
import { 
  defaultTheme, 
  learningTheme, 
  codeExplorerTheme, 
  researchTheme,
  SessionConfiguration 
} from '../abstractions/interfaces';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { 
  BookOpen, 
  Code, 
  Lightbulb, 
  Search,
  Play,
  Palette
} from 'lucide-react';

export function GenericCardDemo() {
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');

  // Configuration for different session types
  const sessionConfigs = {
    example: {
      name: "Example Session",
      maxCacheSize: 20,
      enableProgressiveLoading: false,
      enableAssetGeneration: false,
      supportedGestures: ["swipe", "doubleTap"],
      theme: defaultTheme,
      placeholderProvider: new ExamplePlaceholderProvider()
    } as SessionConfiguration,

    progressive: {
      name: "Progressive Example",
      maxCacheSize: 15,
      enableProgressiveLoading: true,
      enableAssetGeneration: true,
      supportedGestures: ["swipe", "doubleTap", "longPress"],
      theme: codeExplorerTheme,
      placeholderProvider: new ExamplePlaceholderProvider()
    } as SessionConfiguration,

    learning: {
      name: "Learning Session",
      maxCacheSize: 30,
      enableProgressiveLoading: true,
      enableAssetGeneration: true,
      supportedGestures: ["swipe", "doubleTap", "longPress"],
      theme: learningTheme,
      placeholderProvider: new LearningPlaceholderProvider()
    } as SessionConfiguration,

    research: {
      name: "Research Session",
      maxCacheSize: 25,
      enableProgressiveLoading: true,
      enableAssetGeneration: false,
      supportedGestures: ["swipe", "doubleTap"],
      theme: researchTheme,
      placeholderProvider: new ExamplePlaceholderProvider()
    } as SessionConfiguration
  };

  const contentProviders = {
    example: new ExampleContentProvider(),
    progressive: new ProgressiveExampleProvider(),
    learning: new LearningContentProvider(),
    research: new ExampleContentProvider() // Could be a ResearchContentProvider
  };

  const examplePrompts = {
    example: [
      "JavaScript Promises",
      "React Hooks",
      "CSS Grid Layout",
      "Node.js Modules"
    ],
    progressive: [
      "Machine Learning Basics",
      "Database Design",
      "API Development",
      "Testing Strategies"
    ],
    learning: [
      "Quantum Computing",
      "Photosynthesis",
      "Renaissance Art",
      "Economic Theory"
    ],
    research: [
      "Climate Change Impact",
      "Artificial Intelligence Ethics",
      "Space Exploration",
      "Renewable Energy"
    ]
  };

  const startSession = (sessionType: string, prompt?: string) => {
    setActiveSession(sessionType);
    // The GenericSession component will handle the actual session
  };

  const stopSession = () => {
    setActiveSession(null);
  };

  if (activeSession) {
    const sessionType = activeSession as keyof typeof sessionConfigs;
    const config = sessionConfigs[sessionType];
    const provider = contentProviders[sessionType];
    const initialPrompt = customPrompt || examplePrompts[sessionType][0];

    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Generic Card System Demo</h1>
              <Badge variant="outline">{config.name}</Badge>
            </div>
            <Button variant="outline" onClick={stopSession}>
              Exit Session
            </Button>
          </div>

          <GenericSession
            contentProvider={provider}
            initialPrompt={initialPrompt}
            sessionConfig={config}
            onComplete={(stats) => {
              console.log('Session completed with stats:', stats);
              stopSession();
            }}
            onError={(error) => {
              console.error('Session error:', error);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Generic Card System Demo</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Explore different content providers and session configurations using the abstracted card interface.
            Each demo showcases different capabilities of the generic system.
          </p>
        </div>

        <Tabs defaultValue="sessions" className="max-w-4xl mx-auto">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sessions">Session Types</TabsTrigger>
            <TabsTrigger value="customization">Customization</TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Example Session */}
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-3 mb-4">
                  <Lightbulb className="w-6 h-6 text-blue-600" />
                  <h3 className="text-xl font-semibold">Example Session</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  Basic content generation with simple sections. Good for testing core functionality.
                </p>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {examplePrompts.example.map((prompt) => (
                      <Button
                        key={prompt}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCustomPrompt(prompt);
                          startSession('example');
                        }}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                  <Button 
                    className="w-full"
                    onClick={() => startSession('example')}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start Example Session
                  </Button>
                </div>
              </Card>

              {/* Progressive Session */}
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-3 mb-4">
                  <Code className="w-6 h-6 text-purple-600" />
                  <h3 className="text-xl font-semibold">Progressive Session</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  Progressive content loading with real-time section updates and asset generation.
                </p>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {examplePrompts.progressive.map((prompt) => (
                      <Button
                        key={prompt}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCustomPrompt(prompt);
                          startSession('progressive');
                        }}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                  <Button 
                    className="w-full"
                    onClick={() => startSession('progressive')}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start Progressive Session
                  </Button>
                </div>
              </Card>

              {/* Learning Session */}
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-3 mb-4">
                  <BookOpen className="w-6 h-6 text-green-600" />
                  <h3 className="text-xl font-semibold">Learning Session</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  Educational content with structured learning sections and joke-based placeholders.
                </p>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {examplePrompts.learning.map((prompt) => (
                      <Button
                        key={prompt}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCustomPrompt(prompt);
                          startSession('learning');
                        }}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                  <Button 
                    className="w-full"
                    onClick={() => startSession('learning')}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start Learning Session
                  </Button>
                </div>
              </Card>

              {/* Research Session */}
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-3 mb-4">
                  <Search className="w-6 h-6 text-red-600" />
                  <h3 className="text-xl font-semibold">Research Session</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  Research-focused content with specialized theming and academic-style presentation.
                </p>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {examplePrompts.research.map((prompt) => (
                      <Button
                        key={prompt}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCustomPrompt(prompt);
                          startSession('research');
                        }}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                  <Button 
                    className="w-full"
                    onClick={() => startSession('research')}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start Research Session
                  </Button>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="customization" className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <Palette className="w-6 h-6 text-primary" />
                <h3 className="text-xl font-semibold">Custom Session</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="custom-prompt">Custom Prompt</Label>
                  <Input
                    id="custom-prompt"
                    placeholder="Enter your custom prompt..."
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    className="mt-2"
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button
                    variant="outline"
                    onClick={() => startSession('example', customPrompt)}
                    disabled={!customPrompt.trim()}
                  >
                    Basic
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => startSession('progressive', customPrompt)}
                    disabled={!customPrompt.trim()}
                  >
                    Progressive
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => startSession('learning', customPrompt)}
                    disabled={!customPrompt.trim()}
                  >
                    Learning
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => startSession('research', customPrompt)}
                    disabled={!customPrompt.trim()}
                  >
                    Research
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Features Demonstrated</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">UI Features</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Swipe gesture navigation</li>
                    <li>• Double-tap interactions</li>
                    <li>• Progressive content loading</li>
                    <li>• Custom section renderers</li>
                    <li>• Theme customization</li>
                    <li>• Loading states & placeholders</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">System Features</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Position-based card stack</li>
                    <li>• Content provider abstraction</li>
                    <li>• Cache management</li>
                    <li>• Session statistics</li>
                    <li>• Asset generation</li>
                    <li>• Error handling</li>
                  </ul>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default GenericCardDemo;