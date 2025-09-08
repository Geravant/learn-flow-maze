// Learning-Specific Asset Generators
// Educational content-aware asset generation using the Generic Asset Generation Service

import { AssetGenerator, AssetRequest, AssetResult } from '../abstractions/services/GenericAssetGenerationService';
import { imageGenerationService } from './imageGenerationService';
import { openRouterService } from './openRouterService';

// Educational Diagram Generator
export class EducationalDiagramGenerator implements AssetGenerator {
  name = 'educational-diagram';
  supportedTypes = ['diagram', 'flowchart', 'concept-map'];
  priority = 90;

  canGenerate(request: AssetRequest): boolean {
    return this.supportedTypes.includes(request.type) && 
           this.isEducationalContext(request);
  }

  async generate(request: AssetRequest): Promise<AssetResult> {
    const startTime = performance.now();

    try {
      let diagramDescription: string;
      
      switch (request.type) {
        case 'concept-map':
          diagramDescription = await this.generateConceptMapDescription(request.prompt);
          break;
        case 'flowchart':
          diagramDescription = await this.generateFlowchartDescription(request.prompt);
          break;
        case 'diagram':
        default:
          diagramDescription = await this.generateDiagramDescription(request.prompt);
          break;
      }

      // Generate the actual diagram image
      const imageUrl = await imageGenerationService.generateImage(
        diagramDescription,
        {
          style: 'diagram',
          quality: request.parameters.quality || 'medium',
          format: 'educational'
        }
      );

      return {
        id: `edu-diagram-${Date.now()}`,
        requestId: request.id,
        type: request.type,
        url: imageUrl,
        metadata: {
          generatedAt: new Date(),
          generationTime: performance.now() - startTime,
          provider: this.name,
          diagramType: request.type,
          description: diagramDescription,
          educationalLevel: this.inferEducationalLevel(request.prompt),
          subject: this.inferSubject(request.prompt)
        }
      };

    } catch (error) {
      throw new Error(`Educational diagram generation failed: ${error}`);
    }
  }

  estimateCost(request: AssetRequest): number {
    // Base cost for diagram generation
    let cost = 0.15;
    
    // Complexity factors
    if (request.type === 'concept-map') cost += 0.05;
    if (request.parameters.quality === 'high') cost += 0.10;
    
    return cost;
  }

  validateParameters(request: AssetRequest): boolean {
    return typeof request.prompt === 'string' && request.prompt.length > 10;
  }

  private isEducationalContext(request: AssetRequest): boolean {
    const educationalKeywords = [
      'learn', 'teach', 'explain', 'concept', 'definition',
      'process', 'steps', 'how to', 'understanding', 'knowledge'
    ];
    
    const prompt = request.prompt.toLowerCase();
    return educationalKeywords.some(keyword => prompt.includes(keyword));
  }

  private async generateConceptMapDescription(prompt: string): Promise<string> {
    const response = await openRouterService.generateResponse(
      `Create a detailed description for a concept map diagram about: ${prompt}. 
       Include main concepts, connections, and hierarchical relationships. 
       Format as a visual description for diagram generation.`,
      { maxTokens: 400 }
    );
    
    return `Educational concept map: ${response.trim()}. Clean, organized layout with clear connections and labels.`;
  }

  private async generateFlowchartDescription(prompt: string): Promise<string> {
    const response = await openRouterService.generateResponse(
      `Create a flowchart description for: ${prompt}. 
       Include decision points, processes, and flow direction. 
       Format as a visual description with clear steps.`,
      { maxTokens: 350 }
    );
    
    return `Educational flowchart: ${response.trim()}. Clear boxes, arrows, and decision diamonds with readable text.`;
  }

  private async generateDiagramDescription(prompt: string): Promise<string> {
    const response = await openRouterService.generateResponse(
      `Create a visual diagram description for: ${prompt}. 
       Focus on educational clarity and visual explanation of concepts.`,
      { maxTokens: 300 }
    );
    
    return `Educational diagram: ${response.trim()}. Clear, simple, educational style with labels and annotations.`;
  }

  private inferEducationalLevel(prompt: string): string {
    const prompt_lower = prompt.toLowerCase();
    
    if (prompt_lower.includes('elementary') || prompt_lower.includes('basic')) return 'elementary';
    if (prompt_lower.includes('advanced') || prompt_lower.includes('complex')) return 'advanced';
    if (prompt_lower.includes('university') || prompt_lower.includes('college')) return 'university';
    
    return 'intermediate';
  }

  private inferSubject(prompt: string): string {
    const subjects = {
      'science': ['biology', 'chemistry', 'physics', 'anatomy', 'ecology'],
      'mathematics': ['math', 'algebra', 'geometry', 'calculus', 'statistics'],
      'technology': ['computer', 'programming', 'software', 'algorithm', 'data'],
      'history': ['history', 'historical', 'ancient', 'civilization', 'war'],
      'language': ['grammar', 'writing', 'literature', 'linguistics', 'poetry']
    };

    const prompt_lower = prompt.toLowerCase();
    
    for (const [subject, keywords] of Object.entries(subjects)) {
      if (keywords.some(keyword => prompt_lower.includes(keyword))) {
        return subject;
      }
    }
    
    return 'general';
  }
}

// Learning Illustration Generator
export class LearningIllustrationGenerator implements AssetGenerator {
  name = 'learning-illustration';
  supportedTypes = ['image', 'illustration'];
  priority = 85;

  canGenerate(request: AssetRequest): boolean {
    return this.supportedTypes.includes(request.type) && 
           this.hasEducationalIntent(request);
  }

  async generate(request: AssetRequest): Promise<AssetResult> {
    const startTime = performance.now();

    try {
      // Enhance prompt for educational illustration
      const educationalPrompt = await this.enhancePromptForEducation(request.prompt);
      
      const imageUrl = await imageGenerationService.generateImage(
        educationalPrompt,
        {
          style: 'educational-illustration',
          quality: request.parameters.quality || 'medium',
          aspectRatio: request.parameters.aspectRatio || '16:9'
        }
      );

      return {
        id: `learn-illus-${Date.now()}`,
        requestId: request.id,
        type: request.type,
        url: imageUrl,
        metadata: {
          generatedAt: new Date(),
          generationTime: performance.now() - startTime,
          provider: this.name,
          originalPrompt: request.prompt,
          enhancedPrompt: educationalPrompt,
          illustrationStyle: 'educational',
          targetAudience: this.identifyTargetAudience(request.prompt)
        }
      };

    } catch (error) {
      throw new Error(`Learning illustration generation failed: ${error}`);
    }
  }

  estimateCost(request: AssetRequest): number {
    let cost = 0.12;
    
    if (request.parameters.quality === 'high') cost += 0.08;
    if (request.parameters.aspectRatio === '1:1') cost += 0.02; // Square images cost more
    
    return cost;
  }

  private hasEducationalIntent(request: AssetRequest): boolean {
    const educationalIndicators = [
      'explanation', 'tutorial', 'lesson', 'example', 'demonstration',
      'illustration', 'visual aid', 'concept', 'learning'
    ];
    
    const prompt = request.prompt.toLowerCase();
    return educationalIndicators.some(indicator => prompt.includes(indicator));
  }

  private async enhancePromptForEducation(originalPrompt: string): Promise<string> {
    const enhancement = await openRouterService.generateResponse(
      `Enhance this prompt for educational illustration generation: "${originalPrompt}". 
       Make it more descriptive, educational, and visually clear. Include style guidance for learning materials.
       Keep it under 200 characters.`,
      { maxTokens: 150 }
    );
    
    return `Educational illustration: ${enhancement.trim()}. Clean, clear, instructional style with good contrast and readable elements.`;
  }

  private identifyTargetAudience(prompt: string): string {
    const audiences = {
      'children': ['kids', 'children', 'elementary', 'primary'],
      'teenagers': ['teen', 'high school', 'adolescent'],
      'adults': ['adult', 'professional', 'university', 'college'],
      'seniors': ['senior', 'elderly', 'retirement']
    };

    const prompt_lower = prompt.toLowerCase();
    
    for (const [audience, keywords] of Object.entries(audiences)) {
      if (keywords.some(keyword => prompt_lower.includes(keyword))) {
        return audience;
      }
    }
    
    return 'general';
  }
}

// Interactive Learning Asset Generator
export class InteractiveLearningAssetGenerator implements AssetGenerator {
  name = 'interactive-learning';
  supportedTypes = ['interactive', 'quiz-visual', 'animation'];
  priority = 80;

  canGenerate(request: AssetRequest): boolean {
    return this.supportedTypes.includes(request.type);
  }

  async generate(request: AssetRequest): Promise<AssetResult> {
    const startTime = performance.now();

    try {
      let assetContent: any;

      switch (request.type) {
        case 'quiz-visual':
          assetContent = await this.generateQuizVisualization(request.prompt);
          break;
        case 'animation':
          assetContent = await this.generateAnimationStoryboard(request.prompt);
          break;
        case 'interactive':
        default:
          assetContent = await this.generateInteractiveContent(request.prompt);
          break;
      }

      // For now, return a placeholder URL - in a real implementation,
      // this would generate actual interactive content
      const mockUrl = `interactive://learning/${request.type}/${Date.now()}`;

      return {
        id: `interactive-${Date.now()}`,
        requestId: request.id,
        type: request.type,
        url: mockUrl,
        metadata: {
          generatedAt: new Date(),
          generationTime: performance.now() - startTime,
          provider: this.name,
          interactiveType: request.type,
          content: assetContent,
          isInteractive: true,
          requiresJavaScript: true
        }
      };

    } catch (error) {
      throw new Error(`Interactive learning asset generation failed: ${error}`);
    }
  }

  estimateCost(request: AssetRequest): number {
    // Interactive content is more expensive to generate
    let cost = 0.25;
    
    if (request.type === 'animation') cost += 0.15;
    if (request.parameters.complexity === 'high') cost += 0.20;
    
    return cost;
  }

  private async generateQuizVisualization(prompt: string): Promise<any> {
    const quizData = await openRouterService.generateResponse(
      `Create a visual quiz about: ${prompt}. 
       Include question, multiple choice options, visual elements, and correct answer.
       Format as JSON with visual descriptions.`,
      { maxTokens: 500 }
    );

    try {
      return JSON.parse(quizData);
    } catch {
      return {
        type: 'visual-quiz',
        topic: prompt,
        question: `Visual quiz about ${prompt}`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 0,
        visualElements: ['diagram', 'illustration']
      };
    }
  }

  private async generateAnimationStoryboard(prompt: string): Promise<any> {
    const storyboard = await openRouterService.generateResponse(
      `Create an educational animation storyboard for: ${prompt}. 
       Include 3-5 key frames with descriptions of visual elements and transitions.`,
      { maxTokens: 600 }
    );

    return {
      type: 'animation-storyboard',
      topic: prompt,
      frames: storyboard.split('\n').filter(line => line.trim()),
      duration: '30-60 seconds',
      style: 'educational'
    };
  }

  private async generateInteractiveContent(prompt: string): Promise<any> {
    const interactiveSpec = await openRouterService.generateResponse(
      `Design an interactive learning element for: ${prompt}. 
       Describe user interactions, feedback mechanisms, and learning objectives.`,
      { maxTokens: 400 }
    );

    return {
      type: 'interactive-element',
      topic: prompt,
      interactions: ['click', 'drag', 'input'],
      feedback: 'immediate',
      specification: interactiveSpec.trim()
    };
  }
}

// Learning Audio Generator (for accessibility and multi-modal learning)
export class LearningAudioGenerator implements AssetGenerator {
  name = 'learning-audio';
  supportedTypes = ['audio', 'narration', 'pronunciation'];
  priority = 75;

  canGenerate(request: AssetRequest): boolean {
    return this.supportedTypes.includes(request.type);
  }

  async generate(request: AssetRequest): Promise<AssetResult> {
    const startTime = performance.now();

    try {
      // Generate script for text-to-speech
      const script = await this.generateAudioScript(request.prompt, request.type);
      
      // In a real implementation, this would use a TTS service
      const mockAudioUrl = `audio://learning/${request.type}/${Date.now()}.mp3`;

      return {
        id: `audio-${Date.now()}`,
        requestId: request.id,
        type: request.type,
        url: mockAudioUrl,
        metadata: {
          generatedAt: new Date(),
          generationTime: performance.now() - startTime,
          provider: this.name,
          script: script,
          duration: this.estimateAudioDuration(script),
          voice: 'educational-neutral',
          format: 'mp3'
        }
      };

    } catch (error) {
      throw new Error(`Learning audio generation failed: ${error}`);
    }
  }

  estimateCost(request: AssetRequest): number {
    // Audio generation cost based on estimated length
    const baseWords = 100;
    const estimatedWords = request.prompt.split(' ').length * 3; // Assume expansion
    return 0.05 + (estimatedWords / baseWords) * 0.02;
  }

  private async generateAudioScript(prompt: string, type: string): Promise<string> {
    let scriptPrompt: string;

    switch (type) {
      case 'narration':
        scriptPrompt = `Create a clear, engaging narration script for: ${prompt}. 
                       Use conversational tone suitable for educational audio.`;
        break;
      case 'pronunciation':
        scriptPrompt = `Create a pronunciation guide for: ${prompt}. 
                       Include phonetic breakdowns and example sentences.`;
        break;
      case 'audio':
      default:
        scriptPrompt = `Create an educational audio script about: ${prompt}. 
                       Make it clear, concise, and engaging for listeners.`;
        break;
    }

    const script = await openRouterService.generateResponse(scriptPrompt, { maxTokens: 400 });
    return script.trim();
  }

  private estimateAudioDuration(script: string): number {
    // Rough estimation: 150 words per minute average speaking rate
    const wordCount = script.split(/\s+/).length;
    return Math.ceil((wordCount / 150) * 60); // Duration in seconds
  }
}

// Export all learning-specific generators
export const learningAssetGenerators = {
  EducationalDiagramGenerator,
  LearningIllustrationGenerator,
  InteractiveLearningAssetGenerator,
  LearningAudioGenerator
};

// Factory function to create and configure learning generators
export function createLearningAssetGenerators(): AssetGenerator[] {
  return [
    new EducationalDiagramGenerator(),
    new LearningIllustrationGenerator(),
    new InteractiveLearningAssetGenerator(),
    new LearningAudioGenerator()
  ];
}

// Helper function to register all learning generators with an asset generation service
export function registerLearningGenerators(assetService: any): void {
  const generators = createLearningAssetGenerators();
  
  generators.forEach(generator => {
    assetService.registerGenerator(generator);
  });
}

export default {
  learningAssetGenerators,
  createLearningAssetGenerators,
  registerLearningGenerators
};