import { generateLearningCardContent, getRandomWord, getProvider } from './infiniteWikiService';
import { LearningCard } from './openRouterService';

export interface WikiCardOptions {
  useRandomTopic?: boolean;
  difficulty?: 1 | 2 | 3 | 4 | 5;
}

class WikiCardService {
  constructor() {
    // OpenRouter only now - no provider configuration needed
  }

  async generateWikiCard(topic?: string, options: WikiCardOptions = {}): Promise<LearningCard> {
    const {
      useRandomTopic = false,
      difficulty = 3
    } = options;

    // Get topic - either use provided topic, generate random, or use fallback
    let finalTopic = topic;
    if (!finalTopic || useRandomTopic) {
      try {
        finalTopic = await getRandomWord();
      } catch (error) {
        console.warn('Failed to get random word, using fallback topic:', error);
        finalTopic = topic || 'Learning';
      }
    }

    try {
      // Generate content using infinite-wiki engine
      const wikiContent = await generateLearningCardContent(finalTopic);
      
      // Create a learning card with enhanced content
      const learningCard: LearningCard = {
        id: crypto.randomUUID(),
        topic: finalTopic,
        content: {
          definition: wikiContent.definition,
          keyPoints: this.extractKeyPoints(wikiContent.definition),
          visualAid: wikiContent.visualAid,
          examples: this.generateExamples(finalTopic, wikiContent.definition),
          connections: this.generateConnections(finalTopic)
        },
        difficulty,
        estimatedTime: Math.max(2, Math.min(5, Math.ceil(wikiContent.definition.length / 100))),
        prerequisites: this.generatePrerequisites(finalTopic, difficulty),
        masteryLevel: 0
      };

      return learningCard;
    } catch (error) {
      console.error('Wiki card service failed, creating fallback card:', error);
      
      // Create a basic fallback card instead of throwing
      return {
        id: crypto.randomUUID(),
        topic: finalTopic,
        content: {
          definition: `${finalTopic} is an important concept that deserves careful study and understanding.`,
          keyPoints: this.extractKeyPoints(`${finalTopic} involves multiple aspects that are worth exploring.`),
          visualAid: this.createFallbackVisual(finalTopic),
          examples: this.generateExamples(finalTopic, ''),
          connections: this.generateConnections(finalTopic)
        },
        difficulty,
        estimatedTime: 3,
        prerequisites: this.generatePrerequisites(finalTopic, difficulty),
        masteryLevel: 0
      };
    }
  }

  private extractKeyPoints(definition: string): string[] {
    // Simple extraction of key points from definition
    const sentences = definition.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const keyPoints: string[] = [];
    
    for (const sentence of sentences.slice(0, 5)) {
      const cleaned = sentence.trim();
      if (cleaned.length > 20) {
        keyPoints.push(cleaned);
      }
    }
    
    return keyPoints.length > 0 ? keyPoints : [definition.substring(0, 100) + '...'];
  }

  private generateExamples(topic: string, definition: string): string[] {
    // Generate contextual examples based on topic
    const examples: string[] = [];
    const topicLower = topic.toLowerCase();
    
    // Basic example patterns based on common topic types
    if (topicLower.includes('programming') || topicLower.includes('code') || topicLower.includes('software')) {
      examples.push(`Implementing ${topic} in a web application`);
      examples.push(`Using ${topic} for data processing`);
    } else if (topicLower.includes('math') || topicLower.includes('algebra') || topicLower.includes('geometry')) {
      examples.push(`Applying ${topic} in engineering calculations`);
      examples.push(`Using ${topic} for problem-solving`);
    } else if (topicLower.includes('science') || topicLower.includes('physics') || topicLower.includes('chemistry')) {
      examples.push(`${topic} in real-world experiments`);
      examples.push(`Practical applications of ${topic}`);
    } else {
      examples.push(`Real-world application of ${topic}`);
      examples.push(`${topic} in daily life`);
    }
    
    return examples.slice(0, 2);
  }

  private generateConnections(topic: string): string[] {
    // Generate related topics
    const connections: string[] = [];
    const topicLower = topic.toLowerCase();
    
    // Add some basic related concepts
    connections.push(`Advanced ${topic}`);
    connections.push(`${topic} applications`);
    connections.push(`History of ${topic}`);
    
    // Add domain-specific connections
    if (topicLower.includes('programming') || topicLower.includes('code')) {
      connections.push('Software Architecture', 'Design Patterns');
    } else if (topicLower.includes('math')) {
      connections.push('Statistics', 'Calculus');
    } else if (topicLower.includes('science')) {
      connections.push('Research Methods', 'Data Analysis');
    }
    
    return connections.slice(0, 4);
  }

  private generatePrerequisites(topic: string, difficulty: number): string[] {
    const prerequisites: string[] = [];
    const topicLower = topic.toLowerCase();
    
    if (difficulty <= 2) {
      prerequisites.push('Basic reading comprehension');
    } else if (difficulty >= 4) {
      prerequisites.push(`Intermediate knowledge in ${topic} domain`);
      prerequisites.push('Advanced analytical skills');
    } else {
      prerequisites.push(`Basic understanding of ${topic} concepts`);
    }
    
    return prerequisites;
  }

  private createFallbackVisual(topic: string): string {
    const topicLength = Math.min(topic.length, 20); // Limit length for visual
    const displayTopic = topic.length > 20 ? topic.substring(0, 17) + '...' : topic;
    const border = '═'.repeat(topicLength + 4);
    return `╔${border}╗\n║  ${displayTopic.toUpperCase()}  ║\n╚${border}╝`;
  }

  getCurrentProvider(): string {
    return getProvider();
  }
}

export const wikiCardService = new WikiCardService();