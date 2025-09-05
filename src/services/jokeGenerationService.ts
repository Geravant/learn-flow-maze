import { openRouterService } from './openRouterService';

interface TopicJoke {
  topic: string;
  joke: string;
  generatedAt: Date;
}

class JokeGenerationService {
  private jokeCache: Map<string, TopicJoke> = new Map();
  private maxCacheSize: number = 20;
  
  // Generate a short, topic-related joke (always fresh for each card)
  async generateTopicJoke(topic: string, forceNew: boolean = false): Promise<string> {
    try {
      // Check cache first (unless forcing new generation)
      if (!forceNew) {
        const cachedJoke = this.jokeCache.get(topic.toLowerCase());
        if (cachedJoke && this.isJokeFresh(cachedJoke)) {
          console.log(`😄 Using cached joke for: ${topic}`);
          return cachedJoke.joke;
        }
      }

      console.log(`🎭 Generating ${forceNew ? 'fresh' : 'new'} joke for: ${topic}`);
      
      const prompt = `Generate a short, clean joke (one-liner or very brief setup+punchline) about "${topic}, Jimmy Carr Style". 
      The joke should be:
      - Preferably a wordplay
      - Related to the topic but not too technical
      - Lighthearted and fun
      - Maximum 2 sentences
      - Clever but not complex
      
      Just return the joke, nothing else.`;

      const response = await openRouterService.makeSimpleRequest([
        { role: 'user', content: prompt }
      ], {
        max_tokens: 100,
        temperature: 0.8
      });

      const joke = response.trim();
      
      // Cache the joke
      this.cacheJoke(topic, joke);
      
      console.log(`✅ Generated joke for ${topic}: ${joke}`);
      return joke;
      
    } catch (error) {
      console.warn('Failed to generate topic joke:', error);
      // Return a fallback joke
      return this.getFallbackJoke(topic);
    }
  }

  // Generate joke specifically for loading state (always fresh)
  async generateLoadingJoke(topic: string, forceNew: boolean = true): Promise<string> {
    try {
      const joke = await this.generateTopicJoke(topic, forceNew);
      // Add a loading context if the joke doesn't already reference learning/loading
      if (!joke.toLowerCase().includes('learn') && 
          !joke.toLowerCase().includes('study') && 
          !joke.toLowerCase().includes('load')) {
        return `${joke} 📚 (While we prep your ${topic} adventure!)`;
      }
      return joke;
    } catch (error) {
      return this.getFallbackLoadingJoke(topic);
    }
  }

  // Cache management
  private cacheJoke(topic: string, joke: string): void {
    // Clean old entries if cache is full
    if (this.jokeCache.size >= this.maxCacheSize) {
      const oldestTopic = Array.from(this.jokeCache.entries())
        .sort(([,a], [,b]) => a.generatedAt.getTime() - b.generatedAt.getTime())[0][0];
      this.jokeCache.delete(oldestTopic);
    }

    this.jokeCache.set(topic.toLowerCase(), {
      topic,
      joke,
      generatedAt: new Date()
    });
  }

  private isJokeFresh(cachedJoke: TopicJoke): boolean {
    const maxAge = 30 * 60 * 1000; // 30 minutes
    return Date.now() - cachedJoke.generatedAt.getTime() < maxAge;
  }

  // Fallback jokes for when generation fails
  private getFallbackJoke(topic: string): string {
    const fallbacks = [
      `Why did the ${topic} expert break up with their calculator? It just wasn't adding up! 🧮`,
      `What do you call a ${topic} enthusiast who loves to dance? A ${topic.toLowerCase()}-mover! 💃`,
      `How does ${topic} stay in shape? It does concept-ups! 💪`,
      `Why don't ${topic} jokes ever get old? Because they're always learning new punchlines! 😄`,
      `What's a ${topic} expert's favorite type of music? Algo-rhythms! 🎵`
    ];
    
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  private getFallbackLoadingJoke(topic: string): string {
    const loadingFallbacks = [
      `Preparing your ${topic} knowledge buffet... 🍽️`,
      `Loading ${topic} wisdom (batteries not included) ⚡`,
      `Warming up the ${topic} brain cells... 🧠`,
      `Downloading ${topic} enlightenment... 📡`,
      `Assembling your ${topic} learning adventure! 🎢`
    ];
    
    return loadingFallbacks[Math.floor(Math.random() * loadingFallbacks.length)];
  }

  // Clear cache
  clearCache(): void {
    this.jokeCache.clear();
    console.log('🧹 Joke cache cleared');
  }

  // Get cache stats
  getCacheStats() {
    return {
      size: this.jokeCache.size,
      maxSize: this.maxCacheSize,
      topics: Array.from(this.jokeCache.keys())
    };
  }
}

// Export singleton instance
export const jokeGenerationService = new JokeGenerationService();
export default jokeGenerationService;