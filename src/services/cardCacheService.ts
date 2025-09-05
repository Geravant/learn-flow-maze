import { openRouterService, LearningCard } from './openRouterService';
import { progressiveCardService, ProgressiveCard } from './progressiveCardService';
import { imageGenerationService } from './imageGenerationService';
import { topicSuggestionService } from './topicSuggestionService';
import { cardLoadingService } from './cardLoadingService';

export interface CachedCard {
  id: string;
  card: LearningCard;
  progressiveCard?: ProgressiveCard;
  generatedImage?: string;
  isFullyLoaded: boolean;
  loadingProgress: number; // 0-100
  topic: string;
  difficulty: number;
  createdAt: Date;
  lastAccessed: Date;
  visitedAt?: Date; // When this card was visited (moved to history)
}

export interface CacheStats {
  totalCards: number;
  fullyLoadedCards: number;
  cacheHitRate: number;
  averageLoadTime: number;
  nextTopicsCount: number;
  historyCount: number;
}

class CardCacheService {
  private cache: Map<string, CachedCard> = new Map();
  private loadingQueue: Set<string> = new Set();
  private maxCacheSize: number = 10; // Maximum cards to cache
  private preloadCount: number = 3; // Number of cards to preload
  private stats: CacheStats = {
    totalCards: 0,
    fullyLoadedCards: 0,
    cacheHitRate: 0,
    averageLoadTime: 0,
    nextTopicsCount: 0,
    historyCount: 0
  };

  constructor() {
    this.setupPeriodicCleanup();
  }

  // Get a cached card if available, otherwise return null
  getCachedCard(topic: string): CachedCard | null {
    const cachedCard = this.cache.get(topic);
    if (cachedCard) {
      cachedCard.lastAccessed = new Date();
      this.updateHitRate(true);
      return cachedCard;
    }
    this.updateHitRate(false);
    return null;
  }

  // Get all cached cards for display in navigation
  getAllCachedCards(): CachedCard[] {
    return Array.from(this.cache.values())
      .sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime());
  }

  // Get Next Topics (unvisited cached cards)
  getNextTopics(): CachedCard[] {
    return Array.from(this.cache.values())
      .filter(card => !card.visitedAt) // Only cards that haven't been visited
      .sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime());
  }

  // Get History (visited cached cards in visit order)
  getHistory(): CachedCard[] {
    return Array.from(this.cache.values())
      .filter(card => card.visitedAt) // Only cards that have been visited
      .sort((a, b) => (b.visitedAt?.getTime() || 0) - (a.visitedAt?.getTime() || 0));
  }

  // Mark a card as visited (move from Next Topics to History)
  markCardAsVisited(topic: string): void {
    const cachedCard = this.cache.get(topic);
    if (cachedCard) {
      cachedCard.visitedAt = new Date();
      cachedCard.lastAccessed = new Date();
      console.log(`📚 Moved card to history: ${topic}`);
      this.updateStats();
    }
  }

  // Get cards that are ready to use (fully loaded)
  getReadyCards(): CachedCard[] {
    return Array.from(this.cache.values())
      .filter(card => card.isFullyLoaded)
      .sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime());
  }

  // Preload cards for upcoming topics
  async preloadCards(currentTopic: string, difficulty: number = 3): Promise<void> {
    try {
      // Generate related topics for preloading
      const relatedTopics = await this.generateRelatedTopics(currentTopic, this.preloadCount);
      
      // Start preloading each topic in background
      const preloadPromises = relatedTopics.map(topic => 
        this.preloadCard(topic, difficulty)
      );

      // Don't wait for all to complete - let them load in background
      Promise.allSettled(preloadPromises).then(results => {
        console.log(`Preloading completed for ${currentTopic}:`, 
          results.filter(r => r.status === 'fulfilled').length + '/' + results.length + ' succeeded'
        );
      });

    } catch (error) {
      console.error('Failed to start preloading:', error);
    }
  }

  // Preload a single card with all content
  private async preloadCard(topic: string, difficulty: number): Promise<CachedCard> {
    // Check if already cached or loading
    if (this.cache.has(topic) || this.loadingQueue.has(topic)) {
      return this.cache.get(topic)!;
    }

    this.loadingQueue.add(topic);
    const startTime = Date.now();

    try {
      // Create initial cached card
      const cachedCard: CachedCard = {
        id: crypto.randomUUID(),
        card: {} as LearningCard, // Will be populated
        topic,
        difficulty,
        isFullyLoaded: false,
        loadingProgress: 0,
        createdAt: new Date(),
        lastAccessed: new Date()
      };

      this.cache.set(topic, cachedCard);
      this.cleanupCache(); // Ensure we don't exceed max size

      // Step 1: Generate basic card (20% progress)
      console.log(`Starting preload for: ${topic}`);
      const card = await openRouterService.generateLearningCard(topic, difficulty);
      cachedCard.card = card;
      cachedCard.loadingProgress = 20;

      // Step 2: Generate progressive card sections (40% progress)
      const progressiveCard = await progressiveCardService.generateProgressiveCard(
        topic, 
        difficulty, 
        (section) => {
          // Update the cached progressive card in real-time
          if (cachedCard.progressiveCard) {
            const updatedSections = cachedCard.progressiveCard.sections.map(s => 
              s.id === section.id ? section : s
            );
            cachedCard.progressiveCard = {
              ...cachedCard.progressiveCard,
              sections: updatedSections
            };
          }
        }
      );
      cachedCard.progressiveCard = progressiveCard;
      cachedCard.loadingProgress = 40;

      // Step 3: Wait for all progressive sections to complete (70% progress)
      await this.waitForProgressiveCompletion(progressiveCard);
      cachedCard.loadingProgress = 70;

      // Step 4: Generate image in background (100% progress)
      if (cardLoadingService.canGenerateImages()) {
        try {
          const contentInfo = {
            activeCard: cachedCard.card,
            ...cardLoadingService.extractContent(progressiveCard, true),
            hasGeneratedImage: false,
            isGeneratingImage: false
          };
          
          if (cardLoadingService.isContentReadyForImageGeneration(contentInfo)) {
            const result = await cardLoadingService.generateImageForCard(
              topic, 
              contentInfo.definitionContent,
              { generateImageImmediately: true }
            );
            
            if (result.success && result.imageUrl) {
              cachedCard.generatedImage = result.imageUrl;
            }
          }
        } catch (imageError) {
          console.warn(`Image generation failed for ${topic}:`, imageError);
          // Continue without image - not critical
        }
      }

      // Mark as fully loaded
      cachedCard.isFullyLoaded = true;
      cachedCard.loadingProgress = 100;
      
      const loadTime = Date.now() - startTime;
      this.updateStats(loadTime);
      
      console.log(`✅ Preloaded card for "${topic}" in ${loadTime}ms`);
      
      return cachedCard;

    } catch (error) {
      console.error(`❌ Failed to preload card for "${topic}":`, error);
      this.cache.delete(topic); // Remove failed cache entry
      throw error;
    } finally {
      this.loadingQueue.delete(topic);
    }
  }

  // Wait for progressive card sections to complete loading
  private async waitForProgressiveCompletion(progressiveCard: ProgressiveCard, maxWait: number = 10000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      const pendingSections = progressiveCard.sections.filter(s => s.loading);
      if (pendingSections.length === 0) {
        return; // All sections loaded
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.warn('Progressive card sections did not complete within timeout');
  }

  // Generate related topics for preloading with intelligent adjustments
  private async generateRelatedTopics(currentTopic: string, count: number): Promise<string[]> {
    try {
      console.log(`🧠 Generating ${count} related topics for: "${currentTopic}"`);
      
      // Get AI-generated connections
      const connections = await openRouterService.generateConnections(currentTopic);
      
      if (connections && connections.length > 0) {
        console.log(`✅ Generated ${connections.length} AI connections for "${currentTopic}":`, connections);
        return connections.slice(0, count);
      } else {
        console.log(`⚠️ No AI connections generated for "${currentTopic}", using intelligent fallbacks`);
        return this.generateIntelligentFallbacks(currentTopic, count);
      }
    } catch (error) {
      console.error(`❌ Failed to generate related topics for "${currentTopic}":`, error);
      return this.generateIntelligentFallbacks(currentTopic, count);
    }
  }

  // Generate intelligent fallback topics based on the current topic
  private generateIntelligentFallbacks(currentTopic: string, count: number): string[] {
    const fallbacks: string[] = [];
    const topic = currentTopic.toLowerCase();
    
    // Add foundational concepts
    if (!topic.includes('fundamentals') && !topic.includes('basics')) {
      fallbacks.push(`${currentTopic} Fundamentals`);
    }
    
    // Add advanced concepts
    if (!topic.includes('advanced')) {
      fallbacks.push(`Advanced ${currentTopic}`);
    }
    
    // Add practical applications
    if (!topic.includes('applications') && !topic.includes('uses')) {
      fallbacks.push(`${currentTopic} Applications`);
    }
    
    // Add related fields based on topic type
    if (topic.includes('machine learning') || topic.includes('ai')) {
      fallbacks.push('Deep Learning', 'Neural Networks', 'Natural Language Processing');
    } else if (topic.includes('physics') || topic.includes('quantum')) {
      fallbacks.push('Classical Physics', 'Thermodynamics', 'Electromagnetic Theory');
    } else if (topic.includes('psychology') || topic.includes('cognitive')) {
      fallbacks.push('Behavioral Psychology', 'Cognitive Science', 'Social Psychology');
    } else if (topic.includes('economics') || topic.includes('finance')) {
      fallbacks.push('Microeconomics', 'Market Theory', 'Financial Analysis');
    } else if (topic.includes('biology') || topic.includes('life')) {
      fallbacks.push('Molecular Biology', 'Genetics', 'Evolution');
    } else if (topic.includes('chemistry')) {
      fallbacks.push('Organic Chemistry', 'Biochemistry', 'Physical Chemistry');
    } else if (topic.includes('mathematics') || topic.includes('math')) {
      fallbacks.push('Calculus', 'Linear Algebra', 'Statistics');
    } else if (topic.includes('programming') || topic.includes('software')) {
      fallbacks.push('Data Structures', 'Algorithms', 'Software Design');
    } else {
      // Generic fallbacks for any topic
      fallbacks.push(
        `${currentTopic} Theory`,
        `${currentTopic} History`,
        `${currentTopic} Case Studies`,
        `${currentTopic} Research Methods`,
        `Modern ${currentTopic}`,
        `${currentTopic} Trends`
      );
    }
    
    console.log(`🎯 Generated ${Math.min(fallbacks.length, count)} intelligent fallbacks for "${currentTopic}":`, fallbacks.slice(0, count));
    return fallbacks.slice(0, count);
  }

  // Clean up old cached cards to maintain memory limits
  private cleanupCache(): void {
    if (this.cache.size <= this.maxCacheSize) return;

    // Sort by last accessed time and remove oldest
    const sortedCards = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime());

    const toRemove = sortedCards.slice(0, this.cache.size - this.maxCacheSize);
    toRemove.forEach(([topic]) => {
      console.log(`🗑️ Removing cached card: ${topic}`);
      this.cache.delete(topic);
    });
  }

  // Set up periodic cleanup of very old cached cards
  private setupPeriodicCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const maxAge = 30 * 60 * 1000; // 30 minutes

      for (const [topic, cachedCard] of this.cache.entries()) {
        if (now - cachedCard.lastAccessed.getTime() > maxAge) {
          console.log(`🕒 Removing expired cache entry: ${topic}`);
          this.cache.delete(topic);
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  // Update cache hit rate statistics
  private updateHitRate(hit: boolean): void {
    this.stats.totalCards++;
    if (hit) this.stats.fullyLoadedCards++;
    this.stats.cacheHitRate = (this.stats.fullyLoadedCards / this.stats.totalCards) * 100;
  }

  // Update loading time statistics
  private updateStats(loadTime?: number): void {
    if (loadTime) {
      this.stats.averageLoadTime = (this.stats.averageLoadTime + loadTime) / 2;
    }
    
    // Update queue counts
    const nextTopics = this.getNextTopics();
    const history = this.getHistory();
    
    this.stats.nextTopicsCount = nextTopics.length;
    this.stats.historyCount = history.length;
  }

  // Get cache statistics
  getCacheStats(): CacheStats {
    return { ...this.stats };
  }

  // Clear entire cache
  clearCache(): void {
    this.cache.clear();
    this.loadingQueue.clear();
    console.log('🧹 Cache cleared');
  }

  // Warm cache with a specific card (force preload)
  async warmCache(topic: string, difficulty: number = 3): Promise<void> {
    try {
      await this.preloadCard(topic, difficulty);
    } catch (error) {
      console.error(`Failed to warm cache for ${topic}:`, error);
    }
  }

  // Check if a topic is currently being preloaded
  isPreloading(topic: string): boolean {
    return this.loadingQueue.has(topic);
  }

  // Get preloading progress for a topic
  getLoadingProgress(topic: string): number {
    const cachedCard = this.cache.get(topic);
    return cachedCard?.loadingProgress || 0;
  }
}

// Export singleton instance
export const cardCacheService = new CardCacheService();
export default cardCacheService;