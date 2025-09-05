import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Skeleton } from './ui/skeleton';
import { 
  ImageIcon, 
  Download, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle,
  Palette,
  Settings,
  Zap
} from 'lucide-react';
import { imageGenerationService, ImageGenerationResponse } from '../services/imageGenerationService';
import { useToast } from '../hooks/use-toast';

interface ImageGeneratorProps {
  topic?: string;
  context?: string;
  keyPoints?: string[];
  onImageGenerated?: (imageUrl: string) => void;
  className?: string;
}

function ImageGenerator({ 
  topic = '', 
  context = '', 
  keyPoints = [],
  onImageGenerated,
  className = ''
}: ImageGeneratorProps) {
  const [prompt, setPrompt] = useState(topic || '');
  const [customContext, setCustomContext] = useState(context || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generationType, setGenerationType] = useState<'basic' | 'concept' | 'process'>('basic');
  
  const { toast } = useToast();

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Please enter a topic or description');
      return;
    }

    if (!imageGenerationService.isImageGenerationAvailable()) {
      setError('OpenRouter API key not configured. Please add your API key in settings.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedImage(null);

    try {
      let response: ImageGenerationResponse;

      switch (generationType) {
        case 'concept':
          response = await imageGenerationService.generateConceptDiagram(prompt, keyPoints);
          break;
        case 'process':
          const steps = keyPoints.length > 0 ? keyPoints : ['Step 1', 'Step 2', 'Step 3'];
          response = await imageGenerationService.generateProcessDiagram(prompt, steps);
          break;
        default:
          response = await imageGenerationService.generateEducationalImage(
            prompt, 
            customContext || context
          );
      }

      if (response.success && response.imageUrl) {
        setGeneratedImage(response.imageUrl);
        onImageGenerated?.(response.imageUrl);
        toast({
          title: "Image generated successfully!",
          description: "Your educational image is ready.",
        });
      } else {
        setError(response.error || 'Failed to generate image');
        toast({
          title: "Generation failed",
          description: response.error || 'Please try again with a different prompt.',
          variant: "destructive",
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, customContext, context, keyPoints, generationType, onImageGenerated, toast]);

  const handleDownload = useCallback(async () => {
    if (!generatedImage) return;

    try {
      const response = await fetch(generatedImage);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${prompt.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_generated.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Downloaded!",
        description: "Image saved to your device.",
      });
    } catch (err) {
      toast({
        title: "Download failed",
        description: "Could not download the image.",
        variant: "destructive",
      });
    }
  }, [generatedImage, prompt, toast]);

  const getStatusIcon = () => {
    if (isGenerating) return <RefreshCw className="animate-spin" size={16} />;
    if (error) return <AlertTriangle size={16} />;
    if (generatedImage) return <CheckCircle size={16} />;
    return <ImageIcon size={16} />;
  };

  const getStatusColor = () => {
    if (isGenerating) return 'text-blue-500';
    if (error) return 'text-red-500';
    if (generatedImage) return 'text-green-500';
    return 'text-muted-foreground';
  };

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette size={20} />
          AI Image Generator
          <Badge variant="outline" className="ml-auto">
            {imageGenerationService.isImageGenerationAvailable() ? 'Ready' : 'Setup Required'}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Generation Type Selector */}
        <div className="flex gap-2">
          <Button
            variant={generationType === 'basic' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setGenerationType('basic')}
          >
            <ImageIcon size={14} className="mr-1" />
            Basic
          </Button>
          <Button
            variant={generationType === 'concept' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setGenerationType('concept')}
          >
            <Settings size={14} className="mr-1" />
            Concept
          </Button>
          <Button
            variant={generationType === 'process' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setGenerationType('process')}
          >
            <Zap size={14} className="mr-1" />
            Process
          </Button>
        </div>

        {/* Input Fields */}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Topic or Subject
            </label>
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter the topic you want to visualize..."
              className="mt-1"
            />
          </div>

          {generationType === 'basic' && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Additional Context (Optional)
              </label>
              <Textarea
                value={customContext}
                onChange={(e) => setCustomContext(e.target.value)}
                placeholder="Add specific details or requirements for the image..."
                className="mt-1"
                rows={2}
              />
            </div>
          )}

          {generationType !== 'basic' && keyPoints.length > 0 && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Key Points to Include
              </label>
              <div className="mt-1 flex flex-wrap gap-1">
                {keyPoints.map((point, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {point}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Status */}
        <div className={`flex items-center gap-2 text-sm ${getStatusColor()}`}>
          {getStatusIcon()}
          <span>
            {isGenerating ? 'Generating image...' : 
             error ? 'Generation failed' : 
             generatedImage ? 'Image ready' : 
             'Ready to generate'}
          </span>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle size={16} />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Generated Image */}
        {isGenerating ? (
          <div className="space-y-2">
            <Skeleton className="w-full h-48 rounded-md" />
            <div className="text-xs text-muted-foreground text-center">
              Generating your image... This may take 10-30 seconds
            </div>
          </div>
        ) : generatedImage ? (
          <div className="space-y-3">
            <div className="relative group">
              <img
                src={generatedImage}
                alt={`Generated visualization for: ${prompt}`}
                className="w-full rounded-md border shadow-sm"
                style={{ maxHeight: '400px', objectFit: 'contain' }}
              />
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleDownload}
                  className="shadow-lg"
                >
                  <Download size={14} />
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="flex-1"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="animate-spin mr-2" size={16} />
                Generating...
              </>
            ) : (
              <>
                <ImageIcon className="mr-2" size={16} />
                Generate Image
              </>
            )}
          </Button>
          
          {generatedImage && (
            <Button
              variant="outline"
              onClick={handleDownload}
            >
              <Download size={16} />
            </Button>
          )}
        </div>

        {/* Tips */}
        {!generatedImage && !isGenerating && (
          <div className="text-xs text-muted-foreground space-y-1">
            <div>💡 <strong>Tips for better results:</strong></div>
            <div>• Use descriptive, specific prompts</div>
            <div>• Include desired style or format</div>
            <div>• Be clear about educational goals</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { ImageGenerator };
export default ImageGenerator;