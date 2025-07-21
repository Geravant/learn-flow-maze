import { apiKeyManager } from './apiKeyManager';

export interface CardSection {
  id: string;
  type: 'definition' | 'keyPoints' | 'visualAid' | 'examples' | 'connections';
  content: any;
  loading: boolean;
  error?: string;
}

export interface ProgressiveCard {
  id: string;
  topic: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  estimatedTime: number;
  prerequisites: string[];
  masteryLevel: number;
  sections: CardSection[];
}

class ProgressiveCardService {
  private baseUrl = 'https://openrouter.ai/api/v1';

  private async makeRequest(messages: any[], maxTokens: number = 300) {
    const apiKey = apiKeyManager.getApiKey();
    if (!apiKey) {
      throw new Error('OpenRouter API key not set');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Educational Maze'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages,
        temperature: 0.7,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    return response.json();
  }

  async generateProgressiveCard(
    topic: string, 
    difficulty: number = 3,
    onSectionUpdate: (section: CardSection) => void
  ): Promise<ProgressiveCard> {
    const cardId = crypto.randomUUID();
    
    // Initialize card with loading sections
    const initialSections: CardSection[] = [
      { id: 'definition', type: 'definition', content: null, loading: true },
      { id: 'keyPoints', type: 'keyPoints', content: null, loading: true },
      { id: 'visualAid', type: 'visualAid', content: null, loading: true },
      { id: 'examples', type: 'examples', content: null, loading: true },
      { id: 'connections', type: 'connections', content: null, loading: true }
    ];

    const card: ProgressiveCard = {
      id: cardId,
      topic,
      difficulty: Math.max(1, Math.min(5, difficulty)) as 1 | 2 | 3 | 4 | 5,
      estimatedTime: 3,
      prerequisites: difficulty > 3 ? [`Basic ${topic} knowledge`] : [],
      masteryLevel: 0,
      sections: initialSections
    };

    // Load sections progressively with delays to avoid overwhelming mobile networks
    setTimeout(() => this.loadDefinition(topic, difficulty, onSectionUpdate), 100);
    setTimeout(() => this.loadKeyPoints(topic, difficulty, onSectionUpdate), 500);
    setTimeout(() => this.loadVisualAid(topic, onSectionUpdate), 1000);
    setTimeout(() => this.loadExamples(topic, onSectionUpdate), 1500);
    setTimeout(() => this.loadConnections(topic, onSectionUpdate), 2000);

    return card;
  }

  private async loadDefinition(
    topic: string, 
    difficulty: number, 
    onSectionUpdate: (section: CardSection) => void
  ) {
    try {
      const prompt = `For the topic "${topic}" at difficulty ${difficulty}/5, provide a clear, informative description explaining what this topic is and why it matters. Return as JSON: {"definition": "your 2-3 sentence description"}`;
      
      const response = await this.makeRequest([
        { role: 'user', content: prompt }
      ], 200);

      const content = JSON.parse(response.choices[0].message.content);
      
      onSectionUpdate({
        id: 'definition',
        type: 'definition',
        content: content.definition,
        loading: false
      });
    } catch (error) {
      onSectionUpdate({
        id: 'definition',
        type: 'definition',
        content: `${topic} is an important concept that deserves careful study and understanding.`,
        loading: false,
        error: 'Failed to generate definition'
      });
    }
  }

  private async loadKeyPoints(
    topic: string, 
    difficulty: number, 
    onSectionUpdate: (section: CardSection) => void
  ) {
    try {
      const prompt = `For the topic "${topic}" at difficulty ${difficulty}/5, provide 3-5 specific learning objectives - what the student will understand or be able to do after studying this topic. Use action words like "Understand...", "Learn how...", "Identify...". Return as JSON: {"keyPoints": ["objective 1", "objective 2", ...]}`;
      
      const response = await this.makeRequest([
        { role: 'user', content: prompt }
      ], 300);

      const content = JSON.parse(response.choices[0].message.content);
      
      onSectionUpdate({
        id: 'keyPoints',
        type: 'keyPoints',
        content: content.keyPoints.slice(0, 5),
        loading: false
      });
    } catch (error) {
      onSectionUpdate({
        id: 'keyPoints',
        type: 'keyPoints',
        content: [
          `Understand the fundamentals of ${topic}`,
          `Learn key concepts and terminology`,
          `Identify practical applications`
        ],
        loading: false,
        error: 'Failed to generate key points'
      });
    }
  }

  private async loadVisualAid(
    topic: string, 
    onSectionUpdate: (section: CardSection) => void
  ) {
    try {
      const prompt = `Create a simple ASCII art representation for "${topic}" using basic characters like |-+*/\\=. Make it conceptually meaningful but simple. Return as JSON: {"visualAid": "your ascii art with \\n for line breaks"}`;
      
      const response = await this.makeRequest([
        { role: 'user', content: prompt }
      ], 400);

      const content = JSON.parse(response.choices[0].message.content);
      
      onSectionUpdate({
        id: 'visualAid',
        type: 'visualAid',
        content: content.visualAid,
        loading: false
      });
    } catch (error) {
      // Create simple fallback visual
      const topicLength = Math.min(topic.length, 20);
      const displayTopic = topic.length > 20 ? topic.substring(0, 17) + '...' : topic;
      const border = '='.repeat(topicLength + 4);
      
      onSectionUpdate({
        id: 'visualAid',
        type: 'visualAid',
        content: `┌${border}┐\n│  ${displayTopic.toUpperCase()}  │\n└${border}┘`,
        loading: false,
        error: 'Using fallback visual'
      });
    }
  }

  private async loadExamples(
    topic: string, 
    onSectionUpdate: (section: CardSection) => void
  ) {
    try {
      const prompt = `For the topic "${topic}", provide 2-3 real-world applications, use cases, or concrete examples. Return as JSON: {"examples": ["example 1", "example 2", ...]}`;
      
      const response = await this.makeRequest([
        { role: 'user', content: prompt }
      ], 300);

      const content = JSON.parse(response.choices[0].message.content);
      
      onSectionUpdate({
        id: 'examples',
        type: 'examples',
        content: content.examples.slice(0, 3),
        loading: false
      });
    } catch (error) {
      onSectionUpdate({
        id: 'examples',
        type: 'examples',
        content: [
          `Real-world application of ${topic}`,
          `Practical use in industry`
        ],
        loading: false,
        error: 'Failed to generate examples'
      });
    }
  }

  private async loadConnections(
    topic: string, 
    onSectionUpdate: (section: CardSection) => void
  ) {
    try {
      const prompt = `For the topic "${topic}", provide 3-5 related topics for further exploration. Return as JSON: {"connections": ["related topic 1", "related topic 2", ...]}`;
      
      const response = await this.makeRequest([
        { role: 'user', content: prompt }
      ], 250);

      const content = JSON.parse(response.choices[0].message.content);
      
      onSectionUpdate({
        id: 'connections',
        type: 'connections',
        content: content.connections.slice(0, 5),
        loading: false
      });
    } catch (error) {
      onSectionUpdate({
        id: 'connections',
        type: 'connections',
        content: [
          `Advanced ${topic}`,
          `${topic} applications`,
          `${topic} theory`
        ],
        loading: false,
        error: 'Failed to generate connections'
      });
    }
  }
}

export const progressiveCardService = new ProgressiveCardService();