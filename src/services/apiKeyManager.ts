class ApiKeyManager {
  private apiKey: string | null = null;

  constructor() {
    // Initialize as null - API key will be set by user through UI
    this.apiKey = null;
    console.log('ApiKeyManager initialized - waiting for user to provide API key');
  }

  setApiKey(key: string): void {
    this.apiKey = key;
    console.log('API key set successfully:', {
      keyLength: key?.length || 0,
      keyStart: key?.substring(0, 10) || 'none'
    });
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