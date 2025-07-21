interface LearningCard {
  id: string;
  topic: string;
  content: {
    definition: string;
    keyPoints: string[];
    visualAid: string; // ASCII art as string
    examples: string[];
    connections: string[];
  };
  difficulty: 1 | 2 | 3 | 4 | 5;
  estimatedTime: number;
  prerequisites: string[];
  masteryLevel: number;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

class OpenRouterService {
  private apiKey: string | null = null;
  private baseUrl = 'https://openrouter.ai/api/v1';

  constructor() {
    // For now, we'll use a temporary input method
    // In production, this would come from environment variables
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  private async makeRequest(endpoint: string, body: any) {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not set');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Educational Maze'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    return response.json();
  }

  async generateLearningCard(topic: string, difficulty: number = 3): Promise<LearningCard> {
    const prompt = `Create an educational learning card for the topic "${topic}" at difficulty level ${difficulty}/5.

Follow the 7±2 rule (maximum 7 elements per section) and structure as JSON:

{
  "definition": "Clear, concise explanation in 2-3 sentences",
  "keyPoints": ["3-5 main takeaways that fit working memory limits"],
  "visualAid": "Simple ASCII art representation or diagram using basic characters",
  "examples": ["2-3 real-world applications or examples"],
  "connections": ["3-5 related topics for exploration"],
  "estimatedTime": "learning time in minutes (2-4 range)",
  "prerequisites": ["1-3 concepts needed to understand this topic"]
}

Make it engaging, bite-sized, and mobile-friendly. Focus on clarity over complexity.`;

    const response = await this.makeRequest('/chat/completions', {
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        {
          role: 'system',
          content: 'You are an expert educational content creator specializing in bite-sized, working memory-optimized learning. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    try {
      const content = response.choices[0].message.content;
      const parsed = JSON.parse(content);
      
      return {
        id: crypto.randomUUID(),
        topic,
        content: {
          definition: parsed.definition,
          keyPoints: parsed.keyPoints.slice(0, 7), // Enforce 7±2 rule
          visualAid: parsed.visualAid,
          examples: parsed.examples.slice(0, 3),
          connections: parsed.connections.slice(0, 5)
        },
        difficulty: Math.max(1, Math.min(5, difficulty)) as 1 | 2 | 3 | 4 | 5,
        estimatedTime: parsed.estimatedTime || 3,
        prerequisites: parsed.prerequisites || [],
        masteryLevel: 0
      };
    } catch (error) {
      console.error('Failed to parse learning card response:', error);
      throw new Error('Failed to generate learning card');
    }
  }

  async generateQuiz(topic: string, cardContent: string): Promise<QuizQuestion[]> {
    const prompt = `Based on this learning content about "${topic}":

${cardContent}

Generate 3 comprehension questions as JSON array. Each question should:
- Test understanding, not memorization
- Have 4 multiple choice options
- Include explanation for correct answer
- Be appropriate for mobile display

Format: [{"question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": 0, "explanation": "..."}]`;

    const response = await this.makeRequest('/chat/completions', {
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        {
          role: 'system',
          content: 'You are an educational assessment expert. Respond with valid JSON array only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.6,
      max_tokens: 800
    });

    try {
      const content = response.choices[0].message.content;
      const questions = JSON.parse(content);
      
      return questions.map((q: any, index: number) => ({
        id: crypto.randomUUID(),
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation
      }));
    } catch (error) {
      console.error('Failed to parse quiz response:', error);
      throw new Error('Failed to generate quiz');
    }
  }

  async generateConnections(topic: string): Promise<string[]> {
    const prompt = `Suggest 5 related topics to explore after learning about "${topic}". 
    
Consider:
- Logical learning progression
- Cross-domain connections
- Practical applications
- Current relevance

Return as JSON array of strings: ["topic1", "topic2", ...]`;

    const response = await this.makeRequest('/chat/completions', {
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        {
          role: 'system',
          content: 'You are a learning path expert. Respond with JSON array only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 200
    });

    try {
      const content = response.choices[0].message.content;
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to parse connections response:', error);
      return [`Related to ${topic}`, `Advanced ${topic}`, `${topic} applications`];
    }
  }

  async adaptExplanation(content: string, userLevel: "beginner" | "intermediate" | "advanced"): Promise<string> {
    const prompt = `Adapt this explanation for a ${userLevel} level learner:

${content}

${userLevel === 'beginner' ? 'Use simple language, analogies, and basic examples.' : 
  userLevel === 'intermediate' ? 'Include more depth while maintaining clarity.' :
  'Provide technical depth and advanced connections.'}

Keep it concise and mobile-friendly.`;

    const response = await this.makeRequest('/chat/completions', {
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        {
          role: 'system',
          content: 'You are an adaptive learning expert. Provide clear, level-appropriate explanations.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.6,
      max_tokens: 500
    });

    return response.choices[0].message.content;
  }
}

export const openRouterService = new OpenRouterService();
export type { LearningCard, QuizQuestion };