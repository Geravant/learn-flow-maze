// Generic Asset Generation Service
// Content-agnostic asset generation for images, audio, and other media

import { EventEmitter } from 'events';
import { CardContent, CardSection } from '../interfaces';

export interface AssetRequest {
  id: string;
  type: 'image' | 'audio' | 'video' | 'diagram' | 'chart' | 'custom';
  prompt: string;
  parameters: Record<string, any>;
  priority: number;
  createdAt: Date;
  cardId?: string;
  sectionId?: string;
  metadata?: Record<string, any>;
}

export interface AssetResult {
  id: string;
  requestId: string;
  type: string;
  url: string;
  localPath?: string;
  metadata: {
    dimensions?: { width: number; height: number };
    duration?: number;
    fileSize?: number;
    format?: string;
    generatedAt: Date;
    generationTime: number;
    provider: string;
    cost?: number;
  };
  alternativeFormats?: Array<{
    format: string;
    url: string;
    size?: number;
  }>;
}

export interface AssetGenerator {
  name: string;
  supportedTypes: string[];
  priority: number;
  
  canGenerate(request: AssetRequest): boolean;
  generate(request: AssetRequest): Promise<AssetResult>;
  estimateCost?(request: AssetRequest): number;
  validateParameters?(request: AssetRequest): boolean;
}

export interface AssetCache {
  get(key: string): AssetResult | null;
  set(key: string, asset: AssetResult, ttl?: number): void;
  has(key: string): boolean;
  delete(key: string): void;
  clear(): void;
  size(): number;
}

export interface AssetGenerationConfig {
  enableCaching: boolean;
  cacheSize: number;
  cacheTTL: number; // milliseconds
  maxConcurrentGenerations: number;
  defaultPriority: number;
  enableBatching: boolean;
  batchSize: number;
  batchTimeout: number;
  fallbackEnabled: boolean;
  qualityPresets: Record<string, Record<string, any>>;
  costLimits: {
    perRequest: number;
    perHour: number;
    perDay: number;
  };
}

const DEFAULT_CONFIG: AssetGenerationConfig = {
  enableCaching: true,
  cacheSize: 100,
  cacheTTL: 24 * 60 * 60 * 1000, // 24 hours
  maxConcurrentGenerations: 3,
  defaultPriority: 50,
  enableBatching: false,
  batchSize: 5,
  batchTimeout: 5000,
  fallbackEnabled: true,
  qualityPresets: {
    low: { width: 512, height: 512, quality: 0.6 },
    medium: { width: 1024, height: 1024, quality: 0.8 },
    high: { width: 2048, height: 2048, quality: 1.0 }
  },
  costLimits: {
    perRequest: 1.0,
    perHour: 10.0,
    perDay: 50.0
  }
};

export class GenericAssetGenerationService extends EventEmitter {
  private config: AssetGenerationConfig;
  private generators: Map<string, AssetGenerator> = new Map();
  private cache: AssetCache;
  private requestQueue: AssetRequest[] = [];
  private activeRequests: Map<string, Promise<AssetResult>> = new Map();
  private requestIdCounter = 0;
  
  // Cost tracking
  private costTracker = {
    hourly: new Map<number, number>(), // hour -> cost
    daily: new Map<string, number>()   // date -> cost
  };

  // Batching
  private batchTimer: NodeJS.Timeout | null = null;
  private currentBatch: AssetRequest[] = [];

  constructor(config: Partial<AssetGenerationConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new InMemoryAssetCache(this.config.cacheSize, this.config.cacheTTL);
  }

  // Generator management
  registerGenerator(generator: AssetGenerator): void {
    this.generators.set(generator.name, generator);
    this.emit('generatorRegistered', generator.name);
  }

  unregisterGenerator(generatorName: string): void {
    this.generators.delete(generatorName);
    this.emit('generatorUnregistered', generatorName);
  }

  getRegisteredGenerators(): AssetGenerator[] {
    return Array.from(this.generators.values());
  }

  // Asset generation
  async generateAsset(
    type: AssetRequest['type'],
    prompt: string,
    parameters: Record<string, any> = {},
    options: {
      priority?: number;
      cardId?: string;
      sectionId?: string;
      forceRegenerate?: boolean;
    } = {}
  ): Promise<AssetResult> {
    const requestId = `req-${Date.now()}-${this.requestIdCounter++}`;
    
    const request: AssetRequest = {
      id: requestId,
      type,
      prompt,
      parameters: this.mergeWithPresets(parameters),
      priority: options.priority || this.config.defaultPriority,
      createdAt: new Date(),
      cardId: options.cardId,
      sectionId: options.sectionId,
      metadata: options
    };

    // Check cache first (unless force regenerate)
    if (this.config.enableCaching && !options.forceRegenerate) {
      const cacheKey = this.generateCacheKey(request);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.emit('assetCacheHit', requestId, cached);
        return cached;
      }
    }

    // Check cost limits
    if (!this.checkCostLimits(request)) {
      throw new Error('Asset generation would exceed cost limits');
    }

    // Add to queue or batch
    if (this.config.enableBatching) {
      return this.addToBatch(request);
    } else {
      return this.processRequest(request);
    }
  }

  // Batch processing
  private addToBatch(request: AssetRequest): Promise<AssetResult> {
    return new Promise((resolve, reject) => {
      request.metadata = {
        ...request.metadata,
        resolve,
        reject
      };

      this.currentBatch.push(request);
      
      if (this.currentBatch.length >= this.config.batchSize) {
        this.processBatch();
      } else if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => {
          this.processBatch();
        }, this.config.batchTimeout);
      }
    });
  }

  private async processBatch(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    const batch = [...this.currentBatch];
    this.currentBatch = [];

    if (batch.length === 0) return;

    this.emit('batchProcessingStarted', batch.length);

    // Group by compatible generators
    const grouped = this.groupRequestsByGenerator(batch);

    for (const [generatorName, requests] of grouped) {
      const generator = this.generators.get(generatorName);
      if (!generator) continue;

      try {
        // Process requests concurrently within generator limits
        const promises = requests.map(request => this.processRequest(request));
        await Promise.allSettled(promises);
      } catch (error) {
        this.emit('batchProcessingError', generatorName, error);
      }
    }

    this.emit('batchProcessingCompleted', batch.length);
  }

  // Individual request processing
  private async processRequest(request: AssetRequest): Promise<AssetResult> {
    // Check if already processing
    if (this.activeRequests.has(request.id)) {
      return this.activeRequests.get(request.id)!;
    }

    // Wait for available slot
    while (this.activeRequests.size >= this.config.maxConcurrentGenerations) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const requestPromise = this.executeRequest(request);
    this.activeRequests.set(request.id, requestPromise);

    try {
      const result = await requestPromise;
      
      // Cache the result
      if (this.config.enableCaching) {
        const cacheKey = this.generateCacheKey(request);
        this.cache.set(cacheKey, result);
      }

      // Track cost
      this.trackCost(request, result);

      this.emit('assetGenerated', request.id, result);
      return result;

    } catch (error) {
      this.emit('assetGenerationFailed', request.id, error);
      
      // Try fallback generators
      if (this.config.fallbackEnabled) {
        const fallbackResult = await this.tryFallbacks(request, error as Error);
        if (fallbackResult) return fallbackResult;
      }

      throw error;
    } finally {
      this.activeRequests.delete(request.id);
    }
  }

  private async executeRequest(request: AssetRequest): Promise<AssetResult> {
    const startTime = performance.now();
    
    // Find best generator
    const generator = this.findBestGenerator(request);
    if (!generator) {
      throw new Error(`No suitable generator found for type: ${request.type}`);
    }

    this.emit('assetGenerationStarted', request.id, generator.name);

    try {
      const result = await generator.generate(request);
      const generationTime = performance.now() - startTime;
      
      // Add timing metadata
      result.metadata.generationTime = generationTime;
      result.metadata.generatedAt = new Date();
      result.metadata.provider = generator.name;

      return result;

    } catch (error) {
      const generationTime = performance.now() - startTime;
      throw new Error(`Generator ${generator.name} failed after ${generationTime}ms: ${error}`);
    }
  }

  private async tryFallbacks(request: AssetRequest, originalError: Error): Promise<AssetResult | null> {
    const generators = this.getGeneratorsForType(request.type)
      .filter(gen => gen.canGenerate(request))
      .sort((a, b) => a.priority - b.priority); // Lower priority = fallback

    for (const generator of generators) {
      try {
        this.emit('fallbackAttempt', request.id, generator.name);
        const result = await generator.generate(request);
        this.emit('fallbackSuccess', request.id, generator.name);
        return result;
      } catch (fallbackError) {
        this.emit('fallbackFailed', request.id, generator.name, fallbackError);
        continue;
      }
    }

    return null;
  }

  // Asset enhancement and processing
  async enhanceCardWithAssets(card: CardContent, assetTypes: string[] = []): Promise<{
    enhancedCard: CardContent;
    generatedAssets: AssetResult[];
  }> {
    const generatedAssets: AssetResult[] = [];
    const enhancedCard = { ...card };

    // Generate card-level assets (e.g., header image)
    if (assetTypes.includes('header-image')) {
      try {
        const headerAsset = await this.generateAsset(
          'image',
          `Create a header image for: ${card.title}`,
          { preset: 'medium', aspectRatio: '16:9' },
          { cardId: card.id }
        );
        generatedAssets.push(headerAsset);
        
        // Add to card metadata
        enhancedCard.metadata.headerImage = headerAsset.url;
      } catch (error) {
        this.emit('cardEnhancementError', card.id, 'header-image', error);
      }
    }

    // Enhance sections with assets
    enhancedCard.sections = await Promise.all(
      card.sections.map(async (section, index) => {
        const enhancedSection = await this.enhanceSectionWithAssets(
          section,
          card.id,
          index,
          assetTypes
        );
        
        // Collect any generated assets
        if (enhancedSection.metadata?.generatedAssets) {
          generatedAssets.push(...enhancedSection.metadata.generatedAssets);
        }

        return enhancedSection;
      })
    );

    return { enhancedCard, generatedAssets };
  }

  async enhanceSectionWithAssets(
    section: CardSection,
    cardId: string,
    sectionIndex: number,
    assetTypes: string[]
  ): Promise<CardSection> {
    const enhancedSection = { ...section };
    const sectionAssets: AssetResult[] = [];

    // Generate section-specific assets based on content
    if (section.type === 'text' && assetTypes.includes('illustration')) {
      try {
        const illustration = await this.generateAsset(
          'image',
          `Create an illustration for: ${section.content}`,
          { preset: 'medium', style: 'illustration' },
          { cardId, sectionId: `${cardId}-section-${sectionIndex}` }
        );
        
        sectionAssets.push(illustration);
        enhancedSection.metadata = {
          ...enhancedSection.metadata,
          illustration: illustration.url
        };
      } catch (error) {
        this.emit('sectionEnhancementError', cardId, sectionIndex, error);
      }
    }

    // Add diagram generation for complex content
    if (assetTypes.includes('diagram') && this.shouldGenerateDiagram(section)) {
      try {
        const diagram = await this.generateAsset(
          'diagram',
          `Create a diagram explaining: ${section.content}`,
          { type: 'flowchart', style: 'clean' },
          { cardId, sectionId: `${cardId}-section-${sectionIndex}` }
        );
        
        sectionAssets.push(diagram);
        enhancedSection.metadata = {
          ...enhancedSection.metadata,
          diagram: diagram.url
        };
      } catch (error) {
        this.emit('sectionEnhancementError', cardId, sectionIndex, error);
      }
    }

    if (sectionAssets.length > 0) {
      enhancedSection.metadata = {
        ...enhancedSection.metadata,
        generatedAssets: sectionAssets
      };
    }

    return enhancedSection;
  }

  // Utility methods
  private findBestGenerator(request: AssetRequest): AssetGenerator | null {
    const candidates = this.getGeneratorsForType(request.type)
      .filter(gen => gen.canGenerate(request))
      .sort((a, b) => b.priority - a.priority); // Higher priority first

    return candidates[0] || null;
  }

  private getGeneratorsForType(type: string): AssetGenerator[] {
    return Array.from(this.generators.values())
      .filter(gen => gen.supportedTypes.includes(type));
  }

  private groupRequestsByGenerator(requests: AssetRequest[]): Map<string, AssetRequest[]> {
    const grouped = new Map<string, AssetRequest[]>();

    for (const request of requests) {
      const generator = this.findBestGenerator(request);
      if (!generator) continue;

      if (!grouped.has(generator.name)) {
        grouped.set(generator.name, []);
      }
      grouped.get(generator.name)!.push(request);
    }

    return grouped;
  }

  private generateCacheKey(request: AssetRequest): string {
    const keyData = {
      type: request.type,
      prompt: request.prompt,
      parameters: request.parameters
    };
    return `asset-${JSON.stringify(keyData).replace(/\s/g, '')}`;
  }

  private mergeWithPresets(parameters: Record<string, any>): Record<string, any> {
    const preset = parameters.preset;
    if (preset && this.config.qualityPresets[preset]) {
      return {
        ...this.config.qualityPresets[preset],
        ...parameters
      };
    }
    return parameters;
  }

  private checkCostLimits(request: AssetRequest): boolean {
    const generator = this.findBestGenerator(request);
    if (!generator?.estimateCost) return true;

    const estimatedCost = generator.estimateCost(request);
    const now = new Date();
    const currentHour = now.getHours();
    const currentDate = now.toDateString();

    // Check per-request limit
    if (estimatedCost > this.config.costLimits.perRequest) {
      return false;
    }

    // Check hourly limit
    const hourlySpent = this.costTracker.hourly.get(currentHour) || 0;
    if (hourlySpent + estimatedCost > this.config.costLimits.perHour) {
      return false;
    }

    // Check daily limit
    const dailySpent = this.costTracker.daily.get(currentDate) || 0;
    if (dailySpent + estimatedCost > this.config.costLimits.perDay) {
      return false;
    }

    return true;
  }

  private trackCost(request: AssetRequest, result: AssetResult): void {
    if (!result.metadata.cost) return;

    const now = new Date();
    const currentHour = now.getHours();
    const currentDate = now.toDateString();

    // Track hourly
    const hourlySpent = this.costTracker.hourly.get(currentHour) || 0;
    this.costTracker.hourly.set(currentHour, hourlySpent + result.metadata.cost);

    // Track daily
    const dailySpent = this.costTracker.daily.get(currentDate) || 0;
    this.costTracker.daily.set(currentDate, dailySpent + result.metadata.cost);

    this.emit('costTracked', request.id, result.metadata.cost);
  }

  private shouldGenerateDiagram(section: CardSection): boolean {
    // Heuristics to determine if content would benefit from a diagram
    const content = typeof section.content === 'string' ? section.content : '';
    const triggers = [
      'process', 'steps', 'flow', 'cycle', 'relationship',
      'structure', 'hierarchy', 'connection', 'workflow'
    ];
    
    return triggers.some(trigger => 
      content.toLowerCase().includes(trigger)
    );
  }

  // Public API
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size(),
      hitRate: 0 // Would need to track hits/misses
    };
  }

  getCostStats(): {
    hourly: Record<number, number>;
    daily: Record<string, number>;
  } {
    return {
      hourly: Object.fromEntries(this.costTracker.hourly),
      daily: Object.fromEntries(this.costTracker.daily)
    };
  }

  getActiveRequests(): number {
    return this.activeRequests.size;
  }

  async clearCache(): Promise<void> {
    this.cache.clear();
    this.emit('cacheCleared');
  }

  destroy(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    this.removeAllListeners();
  }
}

// Simple in-memory cache implementation
class InMemoryAssetCache implements AssetCache {
  private cache = new Map<string, { asset: AssetResult; expires: number }>();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number, ttl: number) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: string): AssetResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.asset;
  }

  set(key: string, asset: AssetResult, customTTL?: number): void {
    // Remove oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    const expires = Date.now() + (customTTL || this.ttl);
    this.cache.set(key, { asset, expires });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export default GenericAssetGenerationService;