import { apiKeyManager } from './apiKeyManager';

export interface AsciiArtData {
  art: string;
  text?: string;
}

export interface InfiniteWikiCard {
  topic: string;
  definition: string;
  visualAid: string;
}

class InfiniteWikiService {
  private openRouterClient?: { 
    chat: { 
      completions: { 
        create: (params: any) => Promise<any> 
      } 
    } 
  };

  constructor() {
    // OpenRouter only now
  }

  private async getOpenRouterClient() {
    // Always create a new client to ensure we use the current API key
    if (apiKeyManager.hasApiKey()) {
      const { default: OpenAI } = await import('openai');
      this.openRouterClient = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: apiKeyManager.getApiKeyOrThrow(),
        dangerouslyAllowBrowser: true,
        defaultHeaders: {
          'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
          'X-Title': 'Learn Flow Maze'
        }
      });
    }
    return this.openRouterClient;
  }

  async *streamDefinition(topic: string): AsyncGenerator<string, void, undefined> {
    const prompt = `Provide a concise, single-paragraph encyclopedia-style definition for the term: "${topic}". Be informative and neutral. Do not use markdown, titles, or any special formatting. Respond with only the text of the definition itself.`;

    try {
      if (apiKeyManager.hasApiKey()) {
        const client = await this.getOpenRouterClient();
        if (!client) {
          throw new Error('Failed to initialize OpenRouter client');
        }
        
        const stream = await client.chat.completions.create({
          model: 'anthropic/claude-3.5-sonnet',
          messages: [{ role: 'user', content: prompt }],
          stream: true,
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            yield content;
          }
        }
      } else {
        yield `Error: OpenRouter API is not configured. Please set your API key.`;
      }
    } catch (error) {
      console.error('Error streaming from OpenRouter:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      yield `Error: Could not generate content for "${topic}". ${errorMessage}`;
      throw new Error(errorMessage);
    }
  }

  async getRandomWord(): Promise<string> {
    const prompt = `Generate a single, random, interesting English word or a two-word concept. It can be a noun, verb, adjective, or a proper noun. Respond with only the word or concept itself, with no extra text, punctuation, or formatting.`;

    try {
      if (apiKeyManager.hasApiKey()) {
        const client = await this.getOpenRouterClient();
        if (!client) {
          throw new Error('Failed to initialize OpenRouter client');
        }
        
        const response = await client.chat.completions.create({
          model: 'anthropic/claude-3.5-sonnet',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 50,
        });
        return response.choices[0]?.message?.content?.trim() || '';
      } else {
        throw new Error('OpenRouter API is not configured.');
      }
    } catch (error) {
      console.error('Error getting random word from OpenRouter:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      throw new Error(`Could not get random word: ${errorMessage}`);
    }
  }

  async generateAsciiArt(topic: string): Promise<AsciiArtData> {
    const artPromptPart = `1. "art": meta ASCII visualization of the word "${topic}":
  - Palette: │─┌┐└┘├┤┬┴┼►◄▲▼○●◐◑░▒▓█▀▄■□▪▫★☆♦♠♣♥⟨⟩/\\_|
  - Shape mirrors concept - make the visual form embody the word's essence
  - Examples: 
    * "explosion" → radiating lines from center
    * "hierarchy" → pyramid structure
    * "flow" → curved directional lines
  - Return as single string with \\n for line breaks`;

    const keysDescription = `one key: "art"`;
    const promptBody = artPromptPart;

    const prompt = `For "${topic}", create a JSON object with ${keysDescription}.
${promptBody}

Return ONLY the raw JSON object, no additional text. The response must start with "{" and end with "}" and contain only the art property.`;

    const maxRetries = 1;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        let response: string;

        if (apiKeyManager.hasApiKey()) {
          const client = await this.getOpenRouterClient();
          if (!client) {
            throw new Error('Failed to initialize OpenRouter client');
          }
          
          const openRouterResponse = await client.chat.completions.create({
            model: 'anthropic/claude-3.5-sonnet',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 1000,
            response_format: { type: 'json_object' }
          });
          response = openRouterResponse.choices[0]?.message?.content?.trim() || '';
        } else {
          throw new Error('OpenRouter API is not configured.');
        }

        console.log(`Attempt ${attempt}/${maxRetries} - Raw API response:`, response);
        
        // Remove any markdown code fences if present
        const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
        const match = response.match(fenceRegex);
        if (match && match[1]) {
          response = match[1].trim();
        }

        // Ensure the string starts with { and ends with }
        if (!response.startsWith('{') || !response.endsWith('}')) {
          throw new Error('Response is not a valid JSON object');
        }

        const parsedData = JSON.parse(response) as AsciiArtData;
        
        // Validate the response structure
        if (typeof parsedData.art !== 'string' || parsedData.art.trim().length === 0) {
          throw new Error('Invalid or empty ASCII art in response');
        }
        
        const result: AsciiArtData = {
          art: parsedData.art,
        };
        
        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error occurred');
        console.warn(`Attempt ${attempt}/${maxRetries} failed:`, lastError.message);
        
        if (attempt === maxRetries) {
          console.error('All retry attempts failed for ASCII art generation');
          throw new Error(`Could not generate ASCII art after ${maxRetries} attempts: ${lastError.message}`);
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  async generateLearningCardContent(topic: string): Promise<InfiniteWikiCard> {
    try {
      // Get definition by streaming it and collecting all chunks
      let definition = '';
      try {
        for await (const chunk of this.streamDefinition(topic)) {
          definition += chunk;
        }
      } catch (definitionError) {
        console.warn('Failed to generate definition, using fallback:', definitionError);
        definition = `${topic} is a concept that requires further study and exploration.`;
      }

      // Generate ASCII art with fallback
      let visualAid = '';
      try {
        const asciiArtData = await this.generateAsciiArt(topic);
        visualAid = asciiArtData.art;
      } catch (asciiError) {
        console.warn('Failed to generate ASCII art, using simple fallback:', asciiError);
        // Create a simple text-based visual aid
        const topicLength = topic.length;
        const border = '═'.repeat(topicLength + 4);
        visualAid = `╔${border}╗\n║  ${topic.toUpperCase()}  ║\n╚${border}╝`;
      }

      return {
        topic,
        definition: definition.trim(),
        visualAid
      };
    } catch (error) {
      console.error('Error generating learning card content:', error);
      // Return a basic fallback instead of throwing
      const topicLength = topic.length;
      const border = '═'.repeat(topicLength + 4);
      return {
        topic,
        definition: `${topic} is an important concept that deserves careful study and understanding.`,
        visualAid: `╔${border}╗\n║  ${topic.toUpperCase()}  ║\n╚${border}╝`
      };
    }
  }

  getProvider(): string {
    return 'openrouter';
  }
}

const infiniteWikiService = new InfiniteWikiService();

export const streamDefinition = infiniteWikiService.streamDefinition.bind(infiniteWikiService);
export const getRandomWord = infiniteWikiService.getRandomWord.bind(infiniteWikiService);
export const generateAsciiArt = infiniteWikiService.generateAsciiArt.bind(infiniteWikiService);
export const generateLearningCardContent = infiniteWikiService.generateLearningCardContent.bind(infiniteWikiService);
export const getProvider = infiniteWikiService.getProvider.bind(infiniteWikiService);