import { imageGenerationService } from './imageGenerationService';
import { LearningCard } from './openRouterService';
import { ProgressiveCard } from './progressiveCardService';

export interface CardLoadingConfig {
  generateImageImmediately?: boolean;
  delayBeforeImageGeneration?: number;
  onImageGenerationStart?: () => void;
  onImageGenerationComplete?: (imageUrl: string) => void;
  onImageGenerationError?: (error: string) => void;
}

export interface CardContentInfo {
  activeCard: LearningCard | ProgressiveCard | null;
  visualAidContent: string;
  definitionContent: string;
  hasGeneratedImage: boolean;
  isGeneratingImage: boolean;
}

class CardLoadingService {
  
  // Extract content safely from either card type
  extractContent(card: LearningCard | ProgressiveCard | null, isProgressive: boolean = false): {
    visualAidContent: string;
    definitionContent: string;
  } {
    if (!card) {
      return { visualAidContent: '', definitionContent: '' };
    }

    if (isProgressive) {
      const progressiveCard = card as ProgressiveCard;
      const visualAidSection = progressiveCard.sections.find(s => s.type === 'visualAid');
      const definitionSection = progressiveCard.sections.find(s => s.type === 'definition');
      
      return {
        visualAidContent: visualAidSection?.content as string || '',
        definitionContent: definitionSection?.content as string || ''
      };
    } else {
      const traditionalCard = card as LearningCard;
      return {
        visualAidContent: traditionalCard.content?.visualAid || '',
        definitionContent: traditionalCard.content?.definition || ''
      };
    }
  }

  // Check if content is ready for image generation
  isContentReadyForImageGeneration(contentInfo: CardContentInfo): boolean {
    return !!(
      contentInfo.activeCard &&
      contentInfo.visualAidContent &&
      contentInfo.definitionContent &&
      !contentInfo.hasGeneratedImage &&
      !contentInfo.isGeneratingImage
    );
  }

  // Check if image generation is available
  canGenerateImages(): boolean {
    return imageGenerationService.isImageGenerationAvailable();
  }

  // Generate image for a card with the given content
  async generateImageForCard(
    topic: string, 
    definitionContent: string,
    config: CardLoadingConfig = {}
  ): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
    
    if (!this.canGenerateImages()) {
      return { success: false, error: 'Image generation not available' };
    }

    try {
      console.log('Starting image generation for topic:', topic);
      config.onImageGenerationStart?.();

      const response = await imageGenerationService.generateEducationalImage(topic, definitionContent);

      if (response.success && response.imageUrl) {
        console.log('✅ Image generation completed for:', topic);
        config.onImageGenerationComplete?.(response.imageUrl);
        return { success: true, imageUrl: response.imageUrl };
      } else {
        const error = response.error || 'Failed to generate image';
        console.error('❌ Image generation failed for:', topic, error);
        config.onImageGenerationError?.(error);
        return { success: false, error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Image generation error for:', topic, errorMessage);
      config.onImageGenerationError?.(errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  // Auto-generate image when content is ready
  async autoGenerateImageWhenReady(
    contentInfo: CardContentInfo,
    config: CardLoadingConfig = {}
  ): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
    
    // Check if we should generate
    if (!this.isContentReadyForImageGeneration(contentInfo)) {
      console.log('Skipping auto-generation:', {
        hasActiveCard: !!contentInfo.activeCard,
        hasVisualAid: !!contentInfo.visualAidContent,
        hasDefinition: !!contentInfo.definitionContent,
        hasGeneratedImage: contentInfo.hasGeneratedImage,
        isGenerating: contentInfo.isGeneratingImage
      });
      return { success: false, error: 'Content not ready for generation' };
    }

    if (!this.canGenerateImages()) {
      console.log('Skipping auto-generation: Image generation not available');
      return { success: false, error: 'Image generation not available' };
    }

    // Determine delay
    const delay = config.generateImageImmediately 
      ? 0 
      : (config.delayBeforeImageGeneration ?? 100); // Reduced default delay

    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    return this.generateImageForCard(
      contentInfo.activeCard!.topic,
      contentInfo.definitionContent,
      config
    );
  }

  // Check if ASCII content is loaded and ready
  isAsciiContentLoaded(contentInfo: CardContentInfo): boolean {
    return !!(contentInfo.activeCard && contentInfo.visualAidContent);
  }

  // Check if progressive sections are still loading
  areProgressiveSectionsLoading(card: ProgressiveCard | null): boolean {
    if (!card) return false;
    return card.sections.some(section => section.loading);
  }

  // Get loading progress for progressive card
  getProgressiveLoadingProgress(card: ProgressiveCard | null): number {
    if (!card) return 0;
    
    const totalSections = card.sections.length;
    const loadedSections = card.sections.filter(s => !s.loading).length;
    
    return totalSections > 0 ? Math.round((loadedSections / totalSections) * 100) : 0;
  }

  // Create a loading configuration for immediate generation
  createImmediateGenerationConfig(callbacks: {
    onStart?: () => void;
    onComplete?: (imageUrl: string) => void;
    onError?: (error: string) => void;
  }): CardLoadingConfig {
    return {
      generateImageImmediately: true,
      delayBeforeImageGeneration: 0,
      onImageGenerationStart: callbacks.onStart,
      onImageGenerationComplete: callbacks.onComplete,
      onImageGenerationError: callbacks.onError
    };
  }

  // Create a loading configuration for delayed generation
  createDelayedGenerationConfig(
    delay: number = 1000,
    callbacks: {
      onStart?: () => void;
      onComplete?: (imageUrl: string) => void;
      onError?: (error: string) => void;
    }
  ): CardLoadingConfig {
    return {
      generateImageImmediately: false,
      delayBeforeImageGeneration: delay,
      onImageGenerationStart: callbacks.onStart,
      onImageGenerationComplete: callbacks.onComplete,
      onImageGenerationError: callbacks.onError
    };
  }
}

// Export singleton instance
export const cardLoadingService = new CardLoadingService();
export default cardLoadingService;