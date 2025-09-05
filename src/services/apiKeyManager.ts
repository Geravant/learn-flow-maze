class ApiKeyManager {
  private apiKey: string | null = null;

  constructor() {
    // Initialize with environment variable if available
    this.apiKey = import.meta.env.VITE_OPENROUTER_API_KEY || null;
  }

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  getApiKey(): string | null {
    return this.apiKey;
  }

  hasApiKey(): boolean {
    return this.apiKey !== null && this.apiKey.trim() !== '';
  }

  clearApiKey(): void {
    this.apiKey = null;
  }

  // Get API key with error handling
  getApiKeyOrThrow(): string {
    if (!this.hasApiKey()) {
      throw new Error('OpenRouter API key is not configured. Please set your API key.');
    }
    return this.apiKey!;
  }
}

// Create singleton instance
export const apiKeyManager = new ApiKeyManager();