import { apiKeyManager } from './apiKeyManager';

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  loading?: boolean;
}

export interface ProgressiveQuiz {
  id: string;
  topic: string;
  questions: QuizQuestion[];
  loading: boolean;
}

class ProgressiveQuizService {
  private baseUrl = 'https://openrouter.ai/api/v1';

  private async makeRequest(messages: any[]) {
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
        temperature: 0.6,
        max_tokens: 600,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    return response.json();
  }

  async generateProgressiveQuiz(
    topic: string,
    cardContent: string,
    onQuestionUpdate: (question: QuizQuestion) => void
  ): Promise<ProgressiveQuiz> {
    const quizId = crypto.randomUUID();
    
    // Initialize quiz with loading questions
    const initialQuestions: QuizQuestion[] = [
      {
        id: 'q1',
        question: '',
        options: [],
        correctAnswer: 0,
        explanation: '',
        loading: true
      },
      {
        id: 'q2',
        question: '',
        options: [],
        correctAnswer: 0,
        explanation: '',
        loading: true
      },
      {
        id: 'q3',
        question: '',
        options: [],
        correctAnswer: 0,
        explanation: '',
        loading: true
      }
    ];

    const quiz: ProgressiveQuiz = {
      id: quizId,
      topic,
      questions: initialQuestions,
      loading: true
    };

    // Generate questions progressively
    this.loadQuestion(topic, cardContent, 1, 'conceptual', (question) => {
      onQuestionUpdate({ ...question, id: 'q1' });
    });

    this.loadQuestion(topic, cardContent, 2, 'application', (question) => {
      onQuestionUpdate({ ...question, id: 'q2' });
    });

    this.loadQuestion(topic, cardContent, 3, 'analytical', (question) => {
      onQuestionUpdate({ ...question, id: 'q3' });
    });

    return quiz;
  }

  private async loadQuestion(
    topic: string,
    cardContent: string,
    questionNumber: number,
    type: 'conceptual' | 'application' | 'analytical',
    onQuestionUpdate: (question: QuizQuestion) => void
  ) {
    try {
      let prompt: string;

      switch (type) {
        case 'conceptual':
          prompt = `Based on this learning content about "${topic}": ${cardContent}

Create a conceptual understanding question that tests if the student grasps the basic definition and core concept. Return as JSON:
{
  "question": "What is... / Which statement best describes...",
  "options": ["A) option", "B) option", "C) option", "D) option"],
  "correctAnswer": 0,
  "explanation": "Brief explanation of why this answer is correct"
}`;
          break;
        
        case 'application':
          prompt = `Based on this learning content about "${topic}": ${cardContent}

Create an application question that tests if the student can apply their knowledge to real-world scenarios. Return as JSON:
{
  "question": "How would you use... / In which scenario...",
  "options": ["A) option", "B) option", "C) option", "D) option"],
  "correctAnswer": 0,
  "explanation": "Brief explanation of why this answer is correct"
}`;
          break;
        
        case 'analytical':
          prompt = `Based on this learning content about "${topic}": ${cardContent}

Create an analytical question that tests deeper thinking and comparison. Return as JSON:
{
  "question": "Why is... / What would happen if...",
  "options": ["A) option", "B) option", "C) option", "D) option"],
  "correctAnswer": 0,
  "explanation": "Brief explanation of why this answer is correct"
}`;
          break;
      }

      const response = await this.makeRequest([
        {
          role: 'system',
          content: 'You are an educational assessment expert. Create engaging quiz questions that test understanding, not memorization.'
        },
        { role: 'user', content: prompt }
      ]);

      const content = JSON.parse(response.choices[0].message.content);
      
      onQuestionUpdate({
        id: `q${questionNumber}`,
        question: content.question,
        options: content.options,
        correctAnswer: content.correctAnswer,
        explanation: content.explanation,
        loading: false
      });
    } catch (error) {
      console.error(`Failed to generate question ${questionNumber}:`, error);
      
      // Fallback question
      onQuestionUpdate({
        id: `q${questionNumber}`,
        question: `What is an important aspect of ${topic}?`,
        options: [
          'A) It has practical applications',
          'B) It is completely theoretical',
          'C) It is outdated',
          'D) It is only for experts'
        ],
        correctAnswer: 0,
        explanation: `${topic} typically has important practical applications and relevance.`,
        loading: false
      });
    }
  }
}

export const progressiveQuizService = new ProgressiveQuizService();