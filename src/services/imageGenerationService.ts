import { apiKeyManager } from './apiKeyManager';

interface ImageGenerationRequest {
  prompt: string;
  width?: number;
  height?: number;
  quality?: 'standard' | 'high';
}

interface ImageGenerationResponse {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

// Gemini API response interfaces (based on their actual format)
interface GeminiInlineData {
  data: string; // base64 encoded image data
  mime_type: string; // e.g., "image/png"
}

interface GeminiContentPart {
  text?: string;
  inline_data?: GeminiInlineData;
}

interface GeminiContent {
  parts: GeminiContentPart[];
  role?: string;
}

interface GeminiCandidate {
  content?: GeminiContent;
  finish_reason?: string;
  index?: number;
}

interface GeminiApiResponse {
  candidates?: GeminiCandidate[];
  usage_metadata?: {
    prompt_token_count: number;
    candidates_token_count: number;
    total_token_count: number;
  };
  // OpenRouter fallback format
  choices?: Array<{
    message?: {
      content?: string;
      images?: Array<string | { 
        type?: string; 
        image_url?: { url: string }; 
        url?: string; 
      }>;
    };
    finish_reason?: string;
    index?: number;
  }>;
}

class ImageGenerationService {
  private baseUrl = 'https://openrouter.ai/api/v1';
  private model = 'google/gemini-2.5-flash-image-preview';

  constructor() {
    // Uses centralized API key manager
  }

  setApiKey(key: string) {
    apiKeyManager.setApiKey(key);
  }

  private async makeRequest(endpoint: string, body: Record<string, any>) {
    const apiKey = apiKeyManager.getApiKey();
    if (!apiKey || !apiKey.trim()) {
      throw new Error('OpenRouter API key not set. Please provide your API key in the learning session.');
    }

    console.log('ImageGeneration: Making API request with key present:', !!apiKey);

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Educational Maze - Image Generation'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API request failed:', {
        status: response.status,
        statusText: response.statusText,
        errorText,
        apiKeyPresent: !!apiKey,
        apiKeyLength: apiKey?.length
      });
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    return response.json() as Promise<GeminiApiResponse>;
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    try {
      const { prompt } = request;

      const enhancedPrompt = `Create a clear, educational visualization for: ${prompt}. 
Style: Clean, minimalist, suitable for learning materials, with pixellated fleur of sega games. 
Requirements: High contrast, easy to understand, professional appearance,
large font, no more than seven main elements.
`;

      const response = await this.makeRequest('/chat/completions', {
        model: this.model,
        messages: [
          {
            role: 'user',
            content: enhancedPrompt
          }
        ],
        modalities: ["image", "text"],
        temperature: 0.7,
        max_tokens: 4096
      });

      // Extract image from response based on Gemini API format
      console.log('Processing API response structure:', {
        hasCandidates: !!response.candidates,
        candidatesLength: response.candidates?.length || 0,
        hasChoices: !!response.choices,
        choicesLength: response.choices?.length || 0
      });
      
      // Log response format for debugging (can be removed later)
      // console.log('Full API response sample:', JSON.stringify(response, null, 2).substring(0, 500) + '...');
      
      // Check for candidates array (Gemini's native response structure)
      if (response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0];
        
        if (candidate.content && candidate.content.parts) {
          console.log('Found content parts:', candidate.content.parts.length);
          
          // Look for parts with inline_data (image data)
          for (const part of candidate.content.parts) {
            if (part.inline_data && part.inline_data.data) {
              console.log('Found inline image data:', {
                dataLength: part.inline_data.data.length,
                mimeType: part.inline_data.mime_type
              });
              
              // Convert binary data to base64 data URL
              const mimeType = part.inline_data.mime_type || 'image/png';
              const imageDataUrl = `data:${mimeType};base64,${part.inline_data.data}`;
              
              return {
                success: true,
                imageUrl: imageDataUrl
              };
            }
          }
        }
      }
      
      // Fallback: Check OpenRouter's normalized format
      if (response.choices && response.choices.length > 0) {
        const choice = response.choices[0];
        // Process OpenRouter choice format
        
        // Check for images array
        if (choice.message?.images?.[0]) {
          console.log('Found image in choices.message.images');
          const imageData = choice.message.images[0];
          
          // Handle different image formats
          let imageUrl: string;
          if (typeof imageData === 'string') {
            imageUrl = imageData;
          } else if (imageData.image_url?.url) {
            imageUrl = imageData.image_url.url;
          } else if (imageData.url) {
            imageUrl = imageData.url;
          } else {
            console.error('Unexpected image data format:', imageData);
            throw new Error('Image data in unexpected format');
          }
          
          console.log('Extracted image URL length:', imageUrl.length);
          return {
            success: true,
            imageUrl: imageUrl
          };
        }
        
        // Check if content contains base64 image
        if (choice.message?.content) {
          const content = choice.message.content;
          console.log('Processing content for image data:', {
            contentType: typeof content,
            contentLength: content?.length || 0,
            startsWithDataImage: content?.toString().startsWith('data:image/')
          });
          
          if (typeof content === 'string' && content.startsWith('data:image/')) {
            console.log('Found base64 image in content');
            return {
              success: true,
              imageUrl: content
            };
          }
        }
      }
      
      throw new Error('No image data found in API response');

    } catch (error) {
      console.error('Image generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async generateEducationalImage(topic: string, context?: string): Promise<ImageGenerationResponse> {
    const prompt = context 
      ? `Educational diagram for "${topic}": ${context}. Make it clear, informative, and suitable for learning.`
      : `Educational visualization of "${topic}". Create a clear, informative diagram that helps explain this concept.`;

    return this.generateImage({
      prompt
    });
  }

  async generateConceptDiagram(topic: string, keyPoints: string[]): Promise<ImageGenerationResponse> {
    const contextualPrompt = `Create a concept diagram for "${topic}" showing these key elements: ${keyPoints.join(', ')}. 
    Use a clean, educational style with clear labels and logical flow.`;

    return this.generateImage({
      prompt: contextualPrompt
    });
  }

  async generateProcessDiagram(topic: string, steps: string[]): Promise<ImageGenerationResponse> {
    const processPrompt = `Create a process flow diagram for "${topic}" with these steps: ${steps.map((step, i) => `${i + 1}. ${step}`).join(', ')}. 
    Show clear progression with arrows and numbered steps.`;

    return this.generateImage({
      prompt: processPrompt
    });
  }

  isImageGenerationAvailable(): boolean {
    return !!apiKeyManager.getApiKey();
  }

  getStatusMessage(): string {
    if (!this.isImageGenerationAvailable()) {
      return 'API key required for image generation';
    }
    return 'Image generation available';
  }
}

export const imageGenerationService = new ImageGenerationService();
export type { ImageGenerationRequest, ImageGenerationResponse };