// Learning Content Provider - Adapts existing learning system to generic interface
// Based on UI-logic-abstraction.md design document

import { ProgressiveContentProvider, CardContent, CardSection, PlaceholderProvider } from '../abstractions/interfaces';
import { BaseContentProvider, ContentProviderRegistry } from '../abstractions/providers/ContentProvider';
import { openRouterService, LearningCard as ILearningCard } from '../services/openRouterService';
import { progressiveCardService, ProgressiveCard, CardSection as ProgressiveCardSection } from '../services/progressiveCardService';
import { jokeGenerationService } from '../services/jokeGenerationService';
import { imageGenerationService } from '../services/imageGenerationService';

export class LearningContentProvider extends BaseContentProvider implements ProgressiveContentProvider {
  name = "educational";

  async generateContent(topic: string, options?: any): Promise<CardContent> {
    try {
      // Use existing learning card generation
      const learningCard = await openRouterService.generateLearningCard(topic);
      
      return this.adaptLearningCardToGeneric(learningCard, topic);
    } catch (error) {
      console.error('Failed to generate learning content:', error);
      throw new Error(`Learning content generation failed: ${error}`);
    }
  }

  async generateProgressively(
    topic: string,
    onSectionComplete: (section: CardSection) => void,
    options?: any
  ): Promise<CardContent> {
    try {
      const sections: CardSection[] = [];
      
      // Generate progressive card using existing service
      const progressiveCard = await progressiveCardService.generateProgressiveCard(
        topic,
        (section: ProgressiveCardSection) => {
          const genericSection = this.adaptProgressiveSectionToGeneric(section);
          sections.push(genericSection);
          onSectionComplete(genericSection);
        }
      );

      // Create the final card content
      return {
        id: crypto.randomUUID(),
        title: progressiveCard.title,
        sections,
        metadata: {
          provider: this.name,
          topic,
          difficulty: progressiveCard.difficulty,
          subject: progressiveCard.subject,
          estimatedReadTime: progressiveCard.estimatedReadTime,
          progressive: true
        },
        tags: [progressiveCard.subject, `difficulty-${progressiveCard.difficulty}`],
        createdAt: new Date(),
        lastModified: new Date()
      };
    } catch (error) {
      console.error('Failed to generate progressive learning content:', error);
      throw new Error(`Progressive learning content generation failed: ${error}`);
    }
  }

  async generateSection(
    cardId: string,
    sectionType: string,
    context: any
  ): Promise<CardSection> {
    const topic = context.topic || context.title || 'topic';
    
    switch (sectionType) {
      case 'definition':
        return this.createSection('text', await this.generateDefinition(topic), {
          title: 'Definition',
          priority: 1,
          metadata: { type: 'definition' }
        });

      case 'keyPoints':
        return this.createSection('list', await this.generateKeyPoints(topic), {
          title: 'Key Points',
          priority: 2,
          metadata: { type: 'keyPoints' }
        });

      case 'examples':
        return this.createSection('list', await this.generateExamples(topic), {
          title: 'Examples',
          priority: 3,
          metadata: { type: 'examples' }
        });

      case 'visualAid':
        const visualContent = await this.generateVisualAid(topic);
        return this.createSection('text', visualContent, {
          title: 'Visual Understanding',
          priority: 4,
          metadata: { type: 'visualAid' }
        });

      case 'connections':
        return this.createSection('list', await this.generateConnections(topic), {
          title: 'Related Concepts',
          priority: 5,
          metadata: { type: 'connections' }
        });

      case 'quiz':
        return this.createSection('custom', await this.generateQuizSection(topic), {
          title: 'Quick Quiz',
          priority: 10,
          metadata: { type: 'quiz', component: 'QuizRenderer' }
        });

      default:
        throw new Error(`Unsupported section type: ${sectionType}`);
    }
  }

  validateContent(content: CardContent): boolean {
    // Validate that it contains educational content
    const hasDefinition = content.sections.some(s => s.metadata?.type === 'definition');
    const hasKeyPoints = content.sections.some(s => s.metadata?.type === 'keyPoints');
    
    return hasDefinition || hasKeyPoints;
  }

  getSupportedSectionTypes(): string[] {
    return ['definition', 'keyPoints', 'examples', 'visualAid', 'connections', 'quiz'];
  }

  // Private methods for adapting existing learning system

  private adaptLearningCardToGeneric(learningCard: ILearningCard, topic: string): CardContent {
    const sections: CardSection[] = [
      this.createSection('text', learningCard.definition, {
        title: 'Definition',
        priority: 1,
        metadata: { type: 'definition' }
      }),
      this.createSection('list', learningCard.keyPoints, {
        title: 'Key Points',
        priority: 2,
        metadata: { type: 'keyPoints' }
      }),
      this.createSection('list', learningCard.examples, {
        title: 'Examples',
        priority: 3,
        metadata: { type: 'examples' }
      }),
      this.createSection('text', learningCard.visualAid, {
        title: 'Visual Understanding',
        priority: 4,
        metadata: { type: 'visualAid' }
      }),
      this.createSection('list', learningCard.connections, {
        title: 'Related Concepts',
        priority: 5,
        metadata: { type: 'connections' }
      })
    ];

    return {
      id: crypto.randomUUID(),
      title: learningCard.title,
      sections,
      metadata: {
        provider: this.name,
        topic,
        difficulty: learningCard.difficulty,
        subject: learningCard.subject,
        estimatedReadTime: learningCard.estimatedReadTime
      },
      tags: [learningCard.subject, `difficulty-${learningCard.difficulty}`],
      createdAt: new Date(),
      lastModified: new Date()
    };
  }

  private adaptProgressiveSectionToGeneric(section: ProgressiveCardSection): CardSection {
    return this.createSection(
      this.mapProgressiveTypeToGeneric(section.type),
      section.content,
      {
        title: this.getProgressiveSectionTitle(section.type),
        priority: this.getProgressiveSectionPriority(section.type),
        loading: section.loading,
        metadata: { 
          type: section.type,
          originalSection: true
        }
      }
    );
  }

  private mapProgressiveTypeToGeneric(type: string): string {
    switch (type) {
      case 'definition':
      case 'visualAid':
        return 'text';
      case 'keyPoints':
      case 'examples':
      case 'connections':
        return 'list';
      default:
        return 'text';
    }
  }

  private getProgressiveSectionTitle(type: string): string {
    switch (type) {
      case 'definition': return 'Definition';
      case 'keyPoints': return 'Key Points';
      case 'examples': return 'Examples';
      case 'visualAid': return 'Visual Understanding';
      case 'connections': return 'Related Concepts';
      default: return type.charAt(0).toUpperCase() + type.slice(1);
    }
  }

  private getProgressiveSectionPriority(type: string): number {
    switch (type) {
      case 'definition': return 1;
      case 'keyPoints': return 2;
      case 'examples': return 3;
      case 'visualAid': return 4;
      case 'connections': return 5;
      default: return 10;
    }
  }

  // Content generation methods using existing services
  
  private async generateDefinition(topic: string): Promise<string> {
    // Use existing service or generate directly
    const response = await openRouterService.generateResponse(
      `Provide a clear, concise definition of ${topic}.`,
      { maxTokens: 200 }
    );
    return response.trim();
  }

  private async generateKeyPoints(topic: string): Promise<string[]> {
    const response = await openRouterService.generateResponse(
      `List 3-5 key points about ${topic}. Format as a simple list.`,
      { maxTokens: 300 }
    );
    
    return response.split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/^[-*•]\s*/, '').trim())
      .filter(line => line.length > 0);
  }

  private async generateExamples(topic: string): Promise<string[]> {
    const response = await openRouterService.generateResponse(
      `Provide 2-3 practical examples of ${topic}.`,
      { maxTokens: 300 }
    );
    
    return response.split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/^[-*•]\s*/, '').trim())
      .filter(line => line.length > 0);
  }

  private async generateVisualAid(topic: string): Promise<string> {
    const response = await openRouterService.generateResponse(
      `Describe ${topic} in a visual way that helps understanding. Use analogies or metaphors.`,
      { maxTokens: 250 }
    );
    return response.trim();
  }

  private async generateConnections(topic: string): Promise<string[]> {
    const response = await openRouterService.generateResponse(
      `List related concepts and topics connected to ${topic}.`,
      { maxTokens: 200 }
    );
    
    return response.split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/^[-*•]\s*/, '').trim())
      .filter(line => line.length > 0);
  }

  private async generateQuizSection(topic: string): Promise<any> {
    try {
      const response = await openRouterService.generateResponse(
        `Create a multiple choice quiz question about ${topic}. Format as JSON with question, options array, and correct answer index.`,
        { maxTokens: 400 }
      );
      
      // Parse the quiz data
      const quizData = JSON.parse(response.trim());
      return {
        type: 'quiz',
        topic,
        question: quizData.question,
        options: quizData.options,
        correctAnswer: quizData.correctAnswer,
        interactive: true
      };
    } catch (error) {
      return {
        type: 'quiz',
        topic,
        placeholder: `Quiz about ${topic} will be generated here`,
        error: 'Quiz generation failed'
      };
    }
  }

  // Enhanced content generation with better integration to existing services
  async enhanceWithAssets(content: CardContent): Promise<CardContent> {
    const enhancedSections = await Promise.all(
      content.sections.map(async (section, index) => {
        // Generate images for visual sections
        if (section.metadata?.type === 'visualAid') {
          try {
            const imageUrl = await imageGenerationService.generateImage(
              `Educational illustration for: ${section.content}`,
              { style: 'educational', quality: 'medium' }
            );
            
            return {
              ...section,
              type: 'image' as const,
              content: {
                url: imageUrl,
                alt: `Visual aid for ${content.title}`,
                caption: section.content
              },
              metadata: {
                ...section.metadata,
                hasGeneratedAsset: true,
                originalContent: section.content
              }
            };
          } catch (error) {
            console.warn('Failed to generate image for visual aid:', error);
          }
        }
        return section;
      })
    );

    return {
      ...content,
      sections: enhancedSections,
      metadata: {
        ...content.metadata,
        assetsGenerated: true,
        enhancementDate: new Date()
      }
    };
  }
}

// Learning-specific placeholder provider
export class LearningPlaceholderProvider implements PlaceholderProvider {
  async generatePlaceholder(topic: string): Promise<string> {
    try {
      return await jokeGenerationService.generateLoadingJoke(topic, true);
    } catch (error) {
      return `🎓 Preparing your ${topic} learning adventure! 🚀`;
    }
  }

  async generateSectionPlaceholder(sectionType: string, context: any): Promise<string> {
    const topic = context.topic || 'this topic';
    
    switch (sectionType) {
      case 'definition':
        return `🤔 Crafting a crystal-clear explanation of ${topic}...`;
      case 'keyPoints':
        return `🎯 Identifying the most important concepts about ${topic}...`;
      case 'examples':
        return `💡 Finding perfect examples to illustrate ${topic}...`;
      case 'visualAid':
        return `🖼️ Creating visual aids to help you understand ${topic}...`;
      case 'connections':
        return `🔗 Discovering how ${topic} connects to other concepts...`;
      case 'quiz':
        return `❓ Preparing quiz questions to test your ${topic} knowledge...`;
      default:
        return `⚡ Generating ${sectionType} content for ${topic}...`;
    }
  }
}

// Register the learning provider
ContentProviderRegistry.register('learning', () => new LearningContentProvider());
ContentProviderRegistry.register('educational', () => new LearningContentProvider());