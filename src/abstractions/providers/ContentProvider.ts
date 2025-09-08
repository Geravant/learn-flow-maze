// Base Content Provider implementations
// Based on UI-logic-abstraction.md design document

import { ContentProvider, ProgressiveContentProvider, CardContent, CardSection, PlaceholderProvider } from '../interfaces';

// Abstract base class for content providers
export abstract class BaseContentProvider implements ContentProvider {
  abstract name: string;
  
  abstract generateContent(prompt: string, options?: any): Promise<CardContent>;
  
  abstract generateSection(
    cardId: string, 
    sectionType: string, 
    context: any
  ): Promise<CardSection>;
  
  abstract validateContent(content: CardContent): boolean;
  
  abstract getSupportedSectionTypes(): string[];

  // Helper method to create basic card structure
  protected createBasicCard(
    title: string,
    sections: CardSection[],
    metadata: Record<string, any> = {}
  ): CardContent {
    return {
      id: crypto.randomUUID(),
      title,
      sections,
      metadata: {
        provider: this.name,
        ...metadata
      },
      createdAt: new Date(),
      lastModified: new Date()
    };
  }

  // Helper method to create basic section
  protected createSection(
    type: string,
    content: any,
    options: {
      id?: string;
      title?: string;
      priority?: number;
      loading?: boolean;
      error?: string;
      metadata?: Record<string, any>;
    } = {}
  ): CardSection {
    return {
      id: options.id || crypto.randomUUID(),
      type,
      title: options.title,
      content,
      loading: options.loading || false,
      error: options.error,
      priority: options.priority || 1,
      metadata: options.metadata || {}
    };
  }
}

// Example content provider for testing
export class ExampleContentProvider extends BaseContentProvider {
  name = "example";

  async generateContent(prompt: string, options?: any): Promise<CardContent> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    const sections: CardSection[] = [
      this.createSection('text', `This is example content for: "${prompt}"`, {
        title: 'Example Text',
        priority: 1
      }),
      this.createSection('list', [
        'First example point',
        'Second example point',
        'Third example point'
      ], {
        title: 'Example List',
        priority: 2
      }),
      this.createSection('code', `// Example code for ${prompt}\nfunction example() {\n  return "${prompt}";\n}`, {
        title: 'Example Code',
        priority: 3
      })
    ];

    return this.createBasicCard(
      `Example: ${prompt}`,
      sections,
      {
        prompt,
        difficulty: 'beginner',
        estimatedReadTime: '2 minutes'
      }
    );
  }

  async generateSection(
    cardId: string, 
    sectionType: string, 
    context: any
  ): Promise<CardSection> {
    await new Promise(resolve => setTimeout(resolve, 200));

    switch (sectionType) {
      case 'summary':
        return this.createSection('text', `Summary for card ${cardId}`, {
          title: 'Summary',
          priority: 0
        });
      
      case 'details':
        return this.createSection('text', `Detailed information about ${context.topic || 'this topic'}`, {
          title: 'Details',
          priority: 10
        });
      
      default:
        throw new Error(`Unsupported section type: ${sectionType}`);
    }
  }

  validateContent(content: CardContent): boolean {
    return content.sections.length > 0 && 
           content.sections.every(section => section.content !== null && section.content !== undefined);
  }

  getSupportedSectionTypes(): string[] {
    return ['text', 'list', 'code', 'summary', 'details'];
  }
}

// Progressive content provider example
export class ProgressiveExampleProvider extends BaseContentProvider implements ProgressiveContentProvider {
  name = "progressive-example";

  async generateContent(prompt: string, options?: any): Promise<CardContent> {
    // For non-progressive calls, generate all content at once
    return this.generateProgressively(prompt, () => {}, options);
  }

  async generateProgressively(
    prompt: string,
    onSectionComplete: (section: CardSection) => void,
    options?: any
  ): Promise<CardContent> {
    const cardId = crypto.randomUUID();
    const sections: CardSection[] = [];

    // Generate sections progressively
    const sectionConfigs = [
      { type: 'text', title: 'Introduction', delay: 500 },
      { type: 'list', title: 'Key Points', delay: 800 },
      { type: 'text', title: 'Detailed Explanation', delay: 1200 },
      { type: 'code', title: 'Example Code', delay: 1500 }
    ];

    for (const config of sectionConfigs) {
      await new Promise(resolve => setTimeout(resolve, config.delay));
      
      const section = await this.generateSection(cardId, config.type, { prompt, title: config.title });
      sections.push(section);
      onSectionComplete(section);
    }

    return this.createBasicCard(
      `Progressive: ${prompt}`,
      sections,
      { prompt, progressive: true }
    );
  }

  async generateSection(cardId: string, sectionType: string, context: any): Promise<CardSection> {
    const { prompt, title } = context;

    switch (sectionType) {
      case 'text':
        if (title === 'Introduction') {
          return this.createSection('text', `Introduction to ${prompt}...`, {
            title: 'Introduction',
            priority: 1
          });
        } else {
          return this.createSection('text', `Detailed explanation of ${prompt}...`, {
            title: 'Detailed Explanation',
            priority: 3
          });
        }
      
      case 'list':
        return this.createSection('list', [
          `Key point 1 about ${prompt}`,
          `Key point 2 about ${prompt}`,
          `Key point 3 about ${prompt}`
        ], {
          title: 'Key Points',
          priority: 2
        });
      
      case 'code':
        return this.createSection('code', 
          `// Example implementation\nfunction ${prompt.replace(/\s+/g, '')}() {\n  // Implementation here\n  return true;\n}`, {
          title: 'Example Code',
          priority: 4
        });
      
      default:
        throw new Error(`Unsupported section type: ${sectionType}`);
    }
  }

  validateContent(content: CardContent): boolean {
    return content.sections.length > 0 && content.metadata.progressive === true;
  }

  getSupportedSectionTypes(): string[] {
    return ['text', 'list', 'code'];
  }
}

// Example placeholder provider
export class ExamplePlaceholderProvider implements PlaceholderProvider {
  async generatePlaceholder(prompt: string): Promise<string> {
    const placeholders = [
      `🤔 Thinking about "${prompt}"...`,
      `🔍 Researching "${prompt}"...`,
      `💡 Generating insights about "${prompt}"...`,
      `📝 Crafting content for "${prompt}"...`,
      `🚀 Preparing your "${prompt}" experience...`
    ];
    
    return placeholders[Math.floor(Math.random() * placeholders.length)];
  }

  async generateSectionPlaceholder(sectionType: string, context: any): Promise<string> {
    const topic = context.topic || 'this topic';
    
    switch (sectionType) {
      case 'text':
        return `📄 Writing about ${topic}...`;
      case 'list':
        return `📋 Organizing key points for ${topic}...`;
      case 'code':
        return `💻 Generating code examples for ${topic}...`;
      case 'image':
        return `🖼️ Creating visual aids for ${topic}...`;
      default:
        return `⚡ Generating ${sectionType} content for ${topic}...`;
    }
  }
}

// Content provider registry
export class ContentProviderRegistry {
  private static providers: Map<string, () => ContentProvider> = new Map();

  static register(name: string, factory: () => ContentProvider): void {
    this.providers.set(name, factory);
  }

  static create(name: string): ContentProvider | null {
    const factory = this.providers.get(name);
    return factory ? factory() : null;
  }

  static getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}

// Register default providers
ContentProviderRegistry.register('example', () => new ExampleContentProvider());
ContentProviderRegistry.register('progressive-example', () => new ProgressiveExampleProvider());