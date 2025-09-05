import { apiKeyManager } from './apiKeyManager';

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
  private baseUrl = 'https://openrouter.ai/api/v1';

  constructor() {
    // Uses centralized API key manager
  }

  setApiKey(key: string) {
    apiKeyManager.setApiKey(key);
  }

  private async makeRequest(endpoint: string, body: Record<string, any>) {
    const apiKey = apiKeyManager.getApiKey();
    if (!apiKey) {
      throw new Error('OpenRouter API key not set');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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
    // Import the infinite-wiki service for enhanced content generation
    const { generateLearningCardContent } = await import('./infiniteWikiService');
    
    // Generate core content using infinite-wiki engine
    let wikiContent;
    try {
      wikiContent = await generateLearningCardContent(topic);
    } catch (error) {
      console.warn('Failed to use infinite-wiki service, falling back to OpenRouter:', error);
      wikiContent = null;
    }

    const prompt = `Create an educational learning card for the topic "${topic}" at difficulty level ${difficulty}/5.
${wikiContent ? `Use this definition as a base: "${wikiContent.definition}"` : ''}

Follow the 7±2 rule (maximum 7 elements per section) and structure as JSON:

{
  "definition": "${wikiContent?.definition || 'Clear, informative description explaining what this topic is and why it matters (2-3 sentences)'}",
  "keyPoints": ["3-5 specific learning objectives - what the student will understand or be able to do after studying this topic"],
  "visualAid": "${wikiContent?.visualAid || 'Simple ASCII art representation or diagram using basic characters'}",
  "examples": ["2-3 real-world applications, use cases, or concrete examples"],
  "connections": ["3-5 related topics for further exploration"],
  "estimatedTime": "learning time in minutes (2-4 range)",
  "prerequisites": ["1-3 concepts needed to understand this topic"]
}

IMPORTANT: 
- Definition should be descriptive and contextual
- Key Points should be actionable learning objectives (use "Understand...", "Learn how...", "Identify...", etc.)
- Make it engaging, bite-sized, and mobile-friendly.`;

    const response = await this.makeRequest('/chat/completions', {
      model: 'google/gemini-2.5-flash-lite',
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
      let content = response.choices[0].message.content;
      
      // Clean up potential control characters and formatting issues
      content = content.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
      
      // Try to extract JSON if it's wrapped in code blocks
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?})\s*```/);
      if (jsonMatch) {
        content = jsonMatch[1];
      }
      
      const parsed = JSON.parse(content);
      
      return {
        id: crypto.randomUUID(),
        topic,
        content: {
          definition: wikiContent?.definition || parsed.definition,
          keyPoints: parsed.keyPoints?.slice(0, 7) || [`Key aspects of ${topic}`], // Enforce 7±2 rule
          visualAid: wikiContent?.visualAid || parsed.visualAid || `[${topic}]`,
          examples: parsed.examples?.slice(0, 3) || [`Example application of ${topic}`],
          connections: parsed.connections?.slice(0, 5) || [`Related to ${topic}`]
        },
        difficulty: Math.max(1, Math.min(5, difficulty)) as 1 | 2 | 3 | 4 | 5,
        estimatedTime: parsed.estimatedTime || 3,
        prerequisites: parsed.prerequisites || [],
        masteryLevel: 0
      };
    } catch (error) {
      console.error('Failed to parse learning card response:', error);
      
      // Create a fallback card if parsing fails
      return {
        id: crypto.randomUUID(),
        topic,
        content: {
          definition: wikiContent?.definition || `${topic} is an important concept that deserves careful study.`,
          keyPoints: [`Understanding ${topic} fundamentals`, `Exploring ${topic} applications`, `Mastering ${topic} concepts`],
          visualAid: wikiContent?.visualAid || `╔════════════╗\n║   ${topic.toUpperCase()}   ║\n╚════════════╝`,
          examples: [`Real-world ${topic} example`, `Practical ${topic} application`],
          connections: [`Advanced ${topic}`, `${topic} theory`, `${topic} practice`]
        },
        difficulty: Math.max(1, Math.min(5, difficulty)) as 1 | 2 | 3 | 4 | 5,
        estimatedTime: 3,
        prerequisites: difficulty > 3 ? [`Basic ${topic} knowledge`] : [],
        masteryLevel: 0
      };
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
      
      return questions.map((q: { question: string; options: string[]; correctAnswer: number; explanation: string }) => ({
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