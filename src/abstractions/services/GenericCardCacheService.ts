// Generic Card Cache Service with position-based stack management
// Based on UI-logic-abstraction.md and card-stack-refactoring.md

import { EventEmitter } from 'events';
import { CachedCard, CardContent, ContentProvider } from '../interfaces';

export interface CardStack {
  cards: CachedCard[];           // Single ordered array
  currentPosition: number;       // Index of current card (-1 if not in stack)
  maxHistoryDisplay: number;     // How many history items to show
  maxNextTopicsDisplay: number;  // How many next topics to show
}

export class GenericCardCacheService extends EventEmitter {
  private cardStack: CardStack = {
    cards: [],
    currentPosition: -1,
    maxHistoryDisplay: 2,
    maxNextTopicsDisplay: 3
  };

  private cache: Map<string, CachedCard> = new Map();
  private loadingQueue: Set<string> = new Set();
  private maxCacheSize: number = 50;

  constructor(maxCacheSize: number = 50) {
    super();
    this.maxCacheSize = maxCacheSize;
  }

  // Get history cards (before current position)
  getHistory(): CachedCard[] {
    if (this.cardStack.currentPosition <= 0) return [];
    
    const startIndex = Math.max(0, this.cardStack.currentPosition - this.cardStack.maxHistoryDisplay);
    return this.cardStack.cards
      .slice(startIndex, this.cardStack.currentPosition)
      .reverse(); // Most recent first
  }

  // Get next topics (after current position)
  getNextTopics(): CachedCard[] {
    const startIndex = this.cardStack.currentPosition + 1;
    return this.cardStack.cards
      .slice(startIndex, startIndex + this.cardStack.maxNextTopicsDisplay);
  }

  // Get current card
  getCurrentCard(): CachedCard | null {
    if (this.cardStack.currentPosition >= 0 && this.cardStack.currentPosition < this.cardStack.cards.length) {
      return this.cardStack.cards[this.cardStack.currentPosition];
    }
    return null;
  }

  // Navigate to next card in stack
  navigateToNext(): CachedCard | null {
    if (this.cardStack.currentPosition + 1 < this.cardStack.cards.length) {
      this.cardStack.currentPosition++;
      const card = this.cardStack.cards[this.cardStack.currentPosition];
      card.lastAccessed = new Date();
      this.emit('navigationChanged', { 
        type: 'next', 
        position: this.cardStack.currentPosition, 
        card 
      });
      return card;
    }
    return null;
  }

  // Navigate to previous card in stack
  navigateToPrevious(): CachedCard | null {
    if (this.cardStack.currentPosition > 0) {
      this.cardStack.currentPosition--;
      const card = this.cardStack.cards[this.cardStack.currentPosition];
      card.lastAccessed = new Date();
      this.emit('navigationChanged', { 
        type: 'previous', 
        position: this.cardStack.currentPosition, 
        card 
      });
      return card;
    }
    return null;
  }

  // Add card to end of stack
  addCardToStack(card: CachedCard): void {
    // Remove if already exists
    this.removeCardFromStack(card.content.title);
    
    // Add to end
    card.stackPosition = this.cardStack.cards.length;
    this.cardStack.cards.push(card);
    this.cache.set(card.id, card);
    
    // If this is first card, set as current
    if (this.cardStack.currentPosition === -1) {
      this.cardStack.currentPosition = 0;
    }

    // Manage cache size
    this.manageCacheSize();

    this.emit('cardAdded', { card, position: card.stackPosition });
  }

  // Insert card at current position + 1 (next up)
  insertCardAsNext(card: CachedCard): void {
    const insertIndex = this.cardStack.currentPosition + 1;
    this.cardStack.cards.splice(insertIndex, 0, card);
    this.cache.set(card.id, card);
    
    // Update positions for cards after insertion
    for (let i = insertIndex; i < this.cardStack.cards.length; i++) {
      this.cardStack.cards[i].stackPosition = i;
    }

    this.manageCacheSize();
    this.emit('cardInserted', { card, position: insertIndex });
  }

  // Jump to specific card in stack
  jumpToCard(cardId: string): CachedCard | null {
    const index = this.cardStack.cards.findIndex(card => card.id === cardId);
    if (index !== -1) {
      this.cardStack.currentPosition = index;
      const card = this.cardStack.cards[index];
      card.lastAccessed = new Date();
      this.emit('navigationChanged', { 
        type: 'jump', 
        position: index, 
        card 
      });
      return card;
    }
    return null;
  }

  // Remove card from stack
  removeCardFromStack(identifier: string): boolean {
    // Try by ID first, then by title
    let index = this.cardStack.cards.findIndex(card => 
      card.id === identifier || card.content.title === identifier
    );
    
    if (index !== -1) {
      const removedCard = this.cardStack.cards.splice(index, 1)[0];
      this.cache.delete(removedCard.id);
      
      // Adjust current position if necessary
      if (index < this.cardStack.currentPosition) {
        this.cardStack.currentPosition--;
      } else if (index === this.cardStack.currentPosition) {
        // If we removed current card, stay at same position (next card moves into place)
        if (this.cardStack.currentPosition >= this.cardStack.cards.length) {
          this.cardStack.currentPosition = Math.max(0, this.cardStack.cards.length - 1);
        }
      }
      
      // Update positions for remaining cards
      for (let i = index; i < this.cardStack.cards.length; i++) {
        this.cardStack.cards[i].stackPosition = i;
      }

      this.emit('cardRemoved', { card: removedCard, position: index });
      return true;
    }
    return false;
  }

  // Get card by ID
  getCard(cardId: string): CachedCard | null {
    return this.cache.get(cardId) || null;
  }

  // Check if card exists
  hasCard(cardId: string): boolean {
    return this.cache.has(cardId);
  }

  // Update card progress
  updateCardProgress(cardId: string, progress: number): void {
    const card = this.cache.get(cardId);
    if (card) {
      card.loadingProgress = Math.min(100, Math.max(0, progress));
      card.isFullyLoaded = card.loadingProgress === 100;
      card.lastModified = new Date();
      this.emit('cardProgressUpdated', { card, progress });
    }
  }

  // Mark card as complete
  markCardComplete(cardId: string): void {
    this.updateCardProgress(cardId, 100);
  }

  // Preload cards using content provider
  async preloadCards(
    prompts: string[], 
    provider: ContentProvider, 
    options?: any
  ): Promise<void> {
    const loadPromises = prompts.map(async (prompt, index) => {
      // Skip if already loading
      if (this.loadingQueue.has(prompt)) {
        return;
      }

      this.loadingQueue.add(prompt);
      
      try {
        // Create placeholder card
        const placeholderCard: CachedCard = {
          id: crypto.randomUUID(),
          content: {
            id: crypto.randomUUID(),
            title: `Loading: ${prompt.slice(0, 50)}...`,
            sections: [{
              id: 'placeholder',
              type: 'text',
              content: 'Loading content...',
              priority: 1,
              metadata: {}
            }],
            metadata: { isPlaceholder: true },
            createdAt: new Date(),
            lastModified: new Date()
          },
          loadingProgress: 0,
          isFullyLoaded: false,
          lastAccessed: new Date(),
          createdAt: new Date(),
          metadata: { prompt, provider: provider.name }
        };

        this.addCardToStack(placeholderCard);

        // Generate actual content
        const content = await provider.generateContent(prompt, options);
        
        // Update the card with real content
        placeholderCard.content = content;
        placeholderCard.isFullyLoaded = true;
        placeholderCard.loadingProgress = 100;
        placeholderCard.lastModified = new Date();

        this.emit('cardLoaded', { card: placeholderCard, prompt });
        
      } catch (error) {
        this.emit('cardLoadError', { prompt, error });
      } finally {
        this.loadingQueue.delete(prompt);
      }
    });

    await Promise.allSettled(loadPromises);
  }

  // Generate assets for cards
  async generateAssets(
    cardId: string,
    assetTypes: string[],
    onAssetComplete?: (type: string, asset: any) => void
  ): Promise<void> {
    const card = this.cache.get(cardId);
    if (!card) return;

    if (!card.generatedAssets) {
      card.generatedAssets = {};
    }

    const assetPromises = assetTypes.map(async (type) => {
      try {
        let asset: any;
        
        switch (type) {
          case 'image':
            // Would integrate with image generation service
            asset = await this.generateImageAsset(card);
            if (!card.generatedAssets!.images) {
              card.generatedAssets!.images = [];
            }
            card.generatedAssets!.images.push(asset);
            break;
            
          case 'audio':
            // Would integrate with audio generation service
            asset = await this.generateAudioAsset(card);
            if (!card.generatedAssets!.audio) {
              card.generatedAssets!.audio = [];
            }
            card.generatedAssets!.audio.push(asset);
            break;
            
          default:
            console.warn(`Unknown asset type: ${type}`);
            return;
        }

        onAssetComplete?.(type, asset);
        this.emit('assetGenerated', { cardId, type, asset });
        
      } catch (error) {
        this.emit('assetGenerationError', { cardId, type, error });
      }
    });

    await Promise.allSettled(assetPromises);
  }

  // Get stack statistics
  getStackStats(): {
    totalCards: number;
    currentPosition: number;
    historyCount: number;
    nextTopicsCount: number;
    cacheSize: number;
    fullyLoadedCount: number;
  } {
    const fullyLoadedCount = Array.from(this.cache.values())
      .filter(card => card.isFullyLoaded).length;

    return {
      totalCards: this.cardStack.cards.length,
      currentPosition: this.cardStack.currentPosition,
      historyCount: this.getHistory().length,
      nextTopicsCount: this.getNextTopics().length,
      cacheSize: this.cache.size,
      fullyLoadedCount
    };
  }

  // Clear the entire stack and cache
  clear(): void {
    this.cardStack = {
      cards: [],
      currentPosition: -1,
      maxHistoryDisplay: 2,
      maxNextTopicsDisplay: 3
    };
    this.cache.clear();
    this.loadingQueue.clear();
    this.emit('stackCleared');
  }

  // Private helper methods

  private manageCacheSize(): void {
    if (this.cache.size > this.maxCacheSize) {
      // Remove oldest cards that are not in the current stack
      const stackCardIds = new Set(this.cardStack.cards.map(card => card.id));
      const allCards = Array.from(this.cache.values())
        .filter(card => !stackCardIds.has(card.id))
        .sort((a, b) => a.lastAccessed.getTime() - b.lastAccessed.getTime());

      const cardsToRemove = allCards.slice(0, this.cache.size - this.maxCacheSize);
      cardsToRemove.forEach(card => {
        this.cache.delete(card.id);
        this.emit('cardEvicted', { card });
      });
    }
  }

  private async generateImageAsset(card: CachedCard): Promise<string> {
    // Placeholder for image generation
    // In real implementation, would use imageGenerationService
    return `https://via.placeholder.com/400x300?text=${encodeURIComponent(card.content.title)}`;
  }

  private async generateAudioAsset(card: CachedCard): Promise<string> {
    // Placeholder for audio generation
    // In real implementation, would use text-to-speech service
    return `audio://generated/${card.id}`;
  }

  // Configuration methods

  setDisplayLimits(historyDisplay: number, nextTopicsDisplay: number): void {
    this.cardStack.maxHistoryDisplay = historyDisplay;
    this.cardStack.maxNextTopicsDisplay = nextTopicsDisplay;
    this.emit('displayLimitsChanged', { historyDisplay, nextTopicsDisplay });
  }

  setMaxCacheSize(size: number): void {
    this.maxCacheSize = size;
    this.manageCacheSize();
  }

  // Export/Import functionality for session persistence
  exportStack(): any {
    return {
      cardStack: this.cardStack,
      cards: Array.from(this.cache.entries())
    };
  }

  importStack(data: any): void {
    this.clear();
    this.cardStack = data.cardStack || this.cardStack;
    
    if (data.cards && Array.isArray(data.cards)) {
      data.cards.forEach(([id, card]: [string, CachedCard]) => {
        this.cache.set(id, card);
      });
    }

    this.emit('stackImported', { data });
  }
}