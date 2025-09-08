// Generic Caching Service
// Multi-level caching system for content, assets, and metadata

import { EventEmitter } from 'events';

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  metadata: {
    createdAt: Date;
    accessedAt: Date;
    accessCount: number;
    ttl?: number;
    expires?: Date;
    size?: number;
    tags?: string[];
    priority?: number;
    dependencies?: string[];
  };
}

export interface CacheStore<T = any> {
  name: string;
  get(key: string): Promise<CacheEntry<T> | null>;
  set(key: string, value: T, options?: CacheSetOptions): Promise<void>;
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
  size(): Promise<number>;
  stats(): Promise<CacheStoreStats>;
}

export interface CacheSetOptions {
  ttl?: number;
  tags?: string[];
  priority?: number;
  dependencies?: string[];
  size?: number;
}

export interface CacheStoreStats {
  size: number;
  hitCount: number;
  missCount: number;
  evictionCount: number;
  memoryUsage?: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}

export interface CachingConfiguration {
  stores: {
    memory: {
      maxSize: number;
      maxMemoryMB: number;
      defaultTTL: number;
      evictionPolicy: 'lru' | 'lfu' | 'ttl' | 'priority';
    };
    persistent: {
      enabled: boolean;
      storageKey: string;
      maxSize: number;
      compression: boolean;
    };
    indexedDB: {
      enabled: boolean;
      dbName: string;
      version: number;
      maxSize: number;
    };
  };
  enableStatistics: boolean;
  enableCompression: boolean;
  enableEncryption: boolean;
  encryptionKey?: string;
}

const DEFAULT_CONFIG: CachingConfiguration = {
  stores: {
    memory: {
      maxSize: 1000,
      maxMemoryMB: 100,
      defaultTTL: 60 * 60 * 1000, // 1 hour
      evictionPolicy: 'lru'
    },
    persistent: {
      enabled: true,
      storageKey: 'generic-cache',
      maxSize: 500,
      compression: true
    },
    indexedDB: {
      enabled: false,
      dbName: 'GenericCache',
      version: 1,
      maxSize: 10000
    }
  },
  enableStatistics: true,
  enableCompression: false,
  enableEncryption: false
};

export class GenericCachingService extends EventEmitter {
  private config: CachingConfiguration;
  private stores: Map<string, CacheStore> = new Map();
  private statistics = {
    totalHits: 0,
    totalMisses: 0,
    totalSets: 0,
    totalDeletes: 0,
    totalEvictions: 0,
    startTime: new Date()
  };

  // Cache invalidation tracking
  private dependencyGraph = new Map<string, Set<string>>();
  private tagIndex = new Map<string, Set<string>>();

  constructor(config: Partial<CachingConfiguration> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeStores();
  }

  private async initializeStores(): Promise<void> {
    // Initialize memory store
    const memoryStore = new MemoryCacheStore(this.config.stores.memory);
    this.stores.set('memory', memoryStore);

    // Initialize persistent store if enabled
    if (this.config.stores.persistent.enabled) {
      const persistentStore = new PersistentCacheStore(this.config.stores.persistent);
      this.stores.set('persistent', persistentStore);
    }

    // Initialize IndexedDB store if enabled
    if (this.config.stores.indexedDB.enabled) {
      try {
        const indexedDBStore = new IndexedDBCacheStore(this.config.stores.indexedDB);
        await indexedDBStore.initialize();
        this.stores.set('indexedDB', indexedDBStore);
      } catch (error) {
        this.emit('storeInitializationFailed', 'indexedDB', error);
      }
    }

    this.emit('storesInitialized', Array.from(this.stores.keys()));
  }

  // Multi-level cache operations
  async get<T>(key: string, options: {
    preferredStore?: string;
    fallbackToOtherStores?: boolean;
  } = {}): Promise<T | null> {
    const { preferredStore = 'memory', fallbackToOtherStores = true } = options;

    // Try preferred store first
    let result = await this.getFromStore<T>(key, preferredStore);
    
    if (result) {
      this.recordHit(preferredStore);
      this.updateDependencyAccess(key);
      return result;
    }

    // Try other stores if fallback is enabled
    if (fallbackToOtherStores) {
      for (const [storeName, store] of this.stores) {
        if (storeName === preferredStore) continue;
        
        result = await this.getFromStore<T>(key, storeName);
        if (result) {
          this.recordHit(storeName);
          this.updateDependencyAccess(key);
          
          // Promote to preferred store if it's memory
          if (preferredStore === 'memory') {
            await this.set(key, result, { preferredStore: 'memory' });
          }
          
          return result;
        }
      }
    }

    this.recordMiss();
    return null;
  }

  async set<T>(
    key: string, 
    value: T, 
    options: CacheSetOptions & {
      preferredStore?: string;
      writeThrough?: boolean;
      stores?: string[];
    } = {}
  ): Promise<void> {
    const { 
      preferredStore = 'memory', 
      writeThrough = false,
      stores = [preferredStore],
      ...setOptions 
    } = options;

    // Write to specified stores
    const targetStores = writeThrough ? Array.from(this.stores.keys()) : stores;
    
    for (const storeName of targetStores) {
      await this.setInStore(key, value, storeName, setOptions);
    }

    // Update indexes
    this.updateTagIndex(key, setOptions.tags);
    this.updateDependencyGraph(key, setOptions.dependencies);

    this.recordSet();
    this.emit('cacheSet', key, targetStores);
  }

  async has(key: string, storeName?: string): Promise<boolean> {
    if (storeName) {
      return this.hasInStore(key, storeName);
    }

    // Check all stores
    for (const store of this.stores.values()) {
      if (await store.has(key)) {
        return true;
      }
    }

    return false;
  }

  async delete(key: string, options: {
    stores?: string[];
    deleteDependencies?: boolean;
  } = {}): Promise<boolean> {
    const { stores = Array.from(this.stores.keys()), deleteDependencies = false } = options;
    
    let deleted = false;
    
    // Delete from specified stores
    for (const storeName of stores) {
      if (await this.deleteFromStore(key, storeName)) {
        deleted = true;
      }
    }

    // Handle dependency deletion
    if (deleteDependencies) {
      await this.deleteDependencies(key);
    }

    // Update indexes
    this.removeFromTagIndex(key);
    this.removeFromDependencyGraph(key);

    if (deleted) {
      this.recordDelete();
      this.emit('cacheDeleted', key, stores);
    }

    return deleted;
  }

  async clear(storeName?: string): Promise<void> {
    if (storeName) {
      const store = this.stores.get(storeName);
      if (store) {
        await store.clear();
        this.emit('storeCleared', storeName);
      }
    } else {
      // Clear all stores
      for (const [name, store] of this.stores) {
        await store.clear();
        this.emit('storeCleared', name);
      }
      
      // Clear indexes
      this.dependencyGraph.clear();
      this.tagIndex.clear();
    }
  }

  // Tag-based operations
  async getByTag(tag: string): Promise<Array<{ key: string; value: any }>> {
    const keys = this.tagIndex.get(tag) || new Set();
    const results: Array<{ key: string; value: any }> = [];

    for (const key of keys) {
      const value = await this.get(key);
      if (value !== null) {
        results.push({ key, value });
      }
    }

    return results;
  }

  async deleteByTag(tag: string): Promise<number> {
    const keys = this.tagIndex.get(tag) || new Set();
    let deletedCount = 0;

    for (const key of keys) {
      if (await this.delete(key)) {
        deletedCount++;
      }
    }

    return deletedCount;
  }

  async invalidateByTag(tag: string): Promise<void> {
    const deletedCount = await this.deleteByTag(tag);
    this.emit('tagInvalidated', tag, deletedCount);
  }

  // Pattern-based operations
  async getByPattern(pattern: RegExp | string): Promise<Array<{ key: string; value: any }>> {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    const results: Array<{ key: string; value: any }> = [];

    for (const store of this.stores.values()) {
      const keys = await store.keys();
      
      for (const key of keys) {
        if (regex.test(key)) {
          const value = await this.get(key);
          if (value !== null) {
            results.push({ key, value });
          }
        }
      }
    }

    return results;
  }

  async deleteByPattern(pattern: RegExp | string): Promise<number> {
    const matches = await this.getByPattern(pattern);
    let deletedCount = 0;

    for (const { key } of matches) {
      if (await this.delete(key)) {
        deletedCount++;
      }
    }

    return deletedCount;
  }

  // Dependency management
  private async deleteDependencies(key: string): Promise<void> {
    const dependents = this.dependencyGraph.get(key);
    if (!dependents) return;

    for (const dependent of dependents) {
      await this.delete(dependent, { deleteDependencies: true });
    }
  }

  private updateDependencyGraph(key: string, dependencies?: string[]): void {
    if (!dependencies || dependencies.length === 0) return;

    for (const dep of dependencies) {
      if (!this.dependencyGraph.has(dep)) {
        this.dependencyGraph.set(dep, new Set());
      }
      this.dependencyGraph.get(dep)!.add(key);
    }
  }

  private removeFromDependencyGraph(key: string): void {
    // Remove as dependent
    for (const [, dependents] of this.dependencyGraph) {
      dependents.delete(key);
    }

    // Remove as dependency
    this.dependencyGraph.delete(key);
  }

  private updateDependencyAccess(key: string): void {
    // Could be used for LRU-style dependency management
  }

  // Tag index management
  private updateTagIndex(key: string, tags?: string[]): void {
    if (!tags || tags.length === 0) return;

    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }
  }

  private removeFromTagIndex(key: string): void {
    for (const [, keys] of this.tagIndex) {
      keys.delete(key);
    }
  }

  // Store operations
  private async getFromStore<T>(key: string, storeName: string): Promise<T | null> {
    const store = this.stores.get(storeName);
    if (!store) return null;

    const entry = await store.get(key);
    if (!entry) return null;

    // Check expiration
    if (entry.metadata.expires && entry.metadata.expires < new Date()) {
      await store.delete(key);
      return null;
    }

    // Update access metadata
    entry.metadata.accessedAt = new Date();
    entry.metadata.accessCount++;
    
    return entry.value;
  }

  private async setInStore<T>(
    key: string, 
    value: T, 
    storeName: string, 
    options: CacheSetOptions
  ): Promise<void> {
    const store = this.stores.get(storeName);
    if (!store) return;

    await store.set(key, value, options);
  }

  private async hasInStore(key: string, storeName: string): Promise<boolean> {
    const store = this.stores.get(storeName);
    if (!store) return false;

    return store.has(key);
  }

  private async deleteFromStore(key: string, storeName: string): Promise<boolean> {
    const store = this.stores.get(storeName);
    if (!store) return false;

    return store.delete(key);
  }

  // Statistics
  private recordHit(storeName: string): void {
    if (!this.config.enableStatistics) return;
    
    this.statistics.totalHits++;
    this.emit('cacheHit', storeName);
  }

  private recordMiss(): void {
    if (!this.config.enableStatistics) return;
    
    this.statistics.totalMisses++;
    this.emit('cacheMiss');
  }

  private recordSet(): void {
    if (!this.config.enableStatistics) return;
    
    this.statistics.totalSets++;
  }

  private recordDelete(): void {
    if (!this.config.enableStatistics) return;
    
    this.statistics.totalDeletes++;
  }

  private recordEviction(): void {
    if (!this.config.enableStatistics) return;
    
    this.statistics.totalEvictions++;
    this.emit('cacheEviction');
  }

  // Public API
  async getStats(): Promise<{
    global: typeof this.statistics & {
      hitRate: number;
      uptime: number;
    };
    stores: Record<string, CacheStoreStats>;
  }> {
    const global = {
      ...this.statistics,
      hitRate: this.statistics.totalHits / (this.statistics.totalHits + this.statistics.totalMisses) || 0,
      uptime: Date.now() - this.statistics.startTime.getTime()
    };

    const stores: Record<string, CacheStoreStats> = {};
    for (const [name, store] of this.stores) {
      stores[name] = await store.stats();
    }

    return { global, stores };
  }

  getStoreNames(): string[] {
    return Array.from(this.stores.keys());
  }

  async optimize(): Promise<void> {
    // Run optimization on all stores
    for (const [name, store] of this.stores) {
      if ('optimize' in store && typeof store.optimize === 'function') {
        await (store as any).optimize();
        this.emit('storeOptimized', name);
      }
    }
  }

  destroy(): void {
    this.removeAllListeners();
    this.dependencyGraph.clear();
    this.tagIndex.clear();
  }
}

// Memory Cache Store Implementation
class MemoryCacheStore implements CacheStore {
  name = 'memory';
  private cache = new Map<string, CacheEntry>();
  private accessOrder: string[] = [];
  private stats: CacheStoreStats = {
    size: 0,
    hitCount: 0,
    missCount: 0,
    evictionCount: 0
  };

  constructor(private config: CachingConfiguration['stores']['memory']) {}

  async get(key: string): Promise<CacheEntry | null> {
    const entry = this.cache.get(key);
    if (entry) {
      this.updateAccessOrder(key);
      this.stats.hitCount++;
      return entry;
    }
    
    this.stats.missCount++;
    return null;
  }

  async set(key: string, value: any, options: CacheSetOptions = {}): Promise<void> {
    // Check if eviction is needed
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evict();
    }

    const entry: CacheEntry = {
      key,
      value,
      metadata: {
        createdAt: new Date(),
        accessedAt: new Date(),
        accessCount: 0,
        ttl: options.ttl || this.config.defaultTTL,
        expires: options.ttl ? new Date(Date.now() + options.ttl) : undefined,
        size: options.size,
        tags: options.tags,
        priority: options.priority,
        dependencies: options.dependencies
      }
    };

    this.cache.set(key, entry);
    this.updateAccessOrder(key);
    this.stats.size = this.cache.size;
  }

  async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.removeFromAccessOrder(key);
      this.stats.size = this.cache.size;
    }
    return deleted;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.accessOrder = [];
    this.stats.size = 0;
  }

  async keys(): Promise<string[]> {
    return Array.from(this.cache.keys());
  }

  async size(): Promise<number> {
    return this.cache.size;
  }

  async stats(): Promise<CacheStoreStats> {
    return { ...this.stats };
  }

  private evict(): void {
    switch (this.config.evictionPolicy) {
      case 'lru':
        this.evictLRU();
        break;
      case 'lfu':
        this.evictLFU();
        break;
      case 'ttl':
        this.evictByTTL();
        break;
      case 'priority':
        this.evictByPriority();
        break;
    }
  }

  private evictLRU(): void {
    if (this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder[0];
      this.cache.delete(oldestKey);
      this.accessOrder.shift();
      this.stats.evictionCount++;
    }
  }

  private evictLFU(): void {
    let minAccess = Infinity;
    let targetKey = '';

    for (const [key, entry] of this.cache) {
      if (entry.metadata.accessCount < minAccess) {
        minAccess = entry.metadata.accessCount;
        targetKey = key;
      }
    }

    if (targetKey) {
      this.cache.delete(targetKey);
      this.removeFromAccessOrder(targetKey);
      this.stats.evictionCount++;
    }
  }

  private evictByTTL(): void {
    const now = new Date();
    
    for (const [key, entry] of this.cache) {
      if (entry.metadata.expires && entry.metadata.expires < now) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        this.stats.evictionCount++;
        return;
      }
    }
    
    // If no expired entries, fall back to LRU
    this.evictLRU();
  }

  private evictByPriority(): void {
    let minPriority = Infinity;
    let targetKey = '';

    for (const [key, entry] of this.cache) {
      const priority = entry.metadata.priority || 0;
      if (priority < minPriority) {
        minPriority = priority;
        targetKey = key;
      }
    }

    if (targetKey) {
      this.cache.delete(targetKey);
      this.removeFromAccessOrder(targetKey);
      this.stats.evictionCount++;
    }
  }

  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }
}

// Persistent Cache Store (localStorage-based)
class PersistentCacheStore implements CacheStore {
  name = 'persistent';
  private stats: CacheStoreStats = {
    size: 0,
    hitCount: 0,
    missCount: 0,
    evictionCount: 0
  };

  constructor(private config: CachingConfiguration['stores']['persistent']) {}

  async get(key: string): Promise<CacheEntry | null> {
    try {
      const data = localStorage.getItem(`${this.config.storageKey}:${key}`);
      if (!data) {
        this.stats.missCount++;
        return null;
      }

      const entry = JSON.parse(data);
      entry.metadata.createdAt = new Date(entry.metadata.createdAt);
      entry.metadata.accessedAt = new Date(entry.metadata.accessedAt);
      if (entry.metadata.expires) {
        entry.metadata.expires = new Date(entry.metadata.expires);
      }

      this.stats.hitCount++;
      return entry;
    } catch (error) {
      this.stats.missCount++;
      return null;
    }
  }

  async set(key: string, value: any, options: CacheSetOptions = {}): Promise<void> {
    const entry: CacheEntry = {
      key,
      value,
      metadata: {
        createdAt: new Date(),
        accessedAt: new Date(),
        accessCount: 0,
        ttl: options.ttl,
        expires: options.ttl ? new Date(Date.now() + options.ttl) : undefined,
        size: options.size,
        tags: options.tags,
        priority: options.priority,
        dependencies: options.dependencies
      }
    };

    try {
      const serialized = JSON.stringify(entry);
      localStorage.setItem(`${this.config.storageKey}:${key}`, serialized);
    } catch (error) {
      // Handle storage quota exceeded
      console.warn('LocalStorage quota exceeded, clearing old entries');
      await this.clearOldEntries();
      
      try {
        const serialized = JSON.stringify(entry);
        localStorage.setItem(`${this.config.storageKey}:${key}`, serialized);
      } catch (retryError) {
        throw new Error('Unable to store entry even after cleanup');
      }
    }
  }

  async has(key: string): Promise<boolean> {
    return localStorage.getItem(`${this.config.storageKey}:${key}`) !== null;
  }

  async delete(key: string): Promise<boolean> {
    const storageKey = `${this.config.storageKey}:${key}`;
    const existed = localStorage.getItem(storageKey) !== null;
    localStorage.removeItem(storageKey);
    return existed;
  }

  async clear(): Promise<void> {
    const keys = await this.keys();
    for (const key of keys) {
      localStorage.removeItem(`${this.config.storageKey}:${key}`);
    }
  }

  async keys(): Promise<string[]> {
    const keys: string[] = [];
    const prefix = `${this.config.storageKey}:`;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keys.push(key.slice(prefix.length));
      }
    }
    
    return keys;
  }

  async size(): Promise<number> {
    return (await this.keys()).length;
  }

  async stats(): Promise<CacheStoreStats> {
    return { ...this.stats };
  }

  private async clearOldEntries(): Promise<void> {
    const keys = await this.keys();
    const entries: Array<{ key: string; entry: CacheEntry }> = [];

    // Load all entries to sort by age
    for (const key of keys) {
      const entry = await this.get(key);
      if (entry) {
        entries.push({ key, entry });
      }
    }

    // Sort by creation date (oldest first)
    entries.sort((a, b) => 
      a.entry.metadata.createdAt.getTime() - b.entry.metadata.createdAt.getTime()
    );

    // Remove oldest 25% of entries
    const toRemove = Math.ceil(entries.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      await this.delete(entries[i].key);
      this.stats.evictionCount++;
    }
  }
}

// IndexedDB Cache Store (placeholder - would need full implementation)
class IndexedDBCacheStore implements CacheStore {
  name = 'indexedDB';
  private db: IDBDatabase | null = null;
  private stats: CacheStoreStats = {
    size: 0,
    hitCount: 0,
    missCount: 0,
    evictionCount: 0
  };

  constructor(private config: CachingConfiguration['stores']['indexedDB']) {}

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, this.config.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' });
        }
      };
    });
  }

  async get(key: string): Promise<CacheEntry | null> {
    // IndexedDB implementation would go here
    return null;
  }

  async set(key: string, value: any, options: CacheSetOptions = {}): Promise<void> {
    // IndexedDB implementation would go here
  }

  async has(key: string): Promise<boolean> {
    // IndexedDB implementation would go here
    return false;
  }

  async delete(key: string): Promise<boolean> {
    // IndexedDB implementation would go here
    return false;
  }

  async clear(): Promise<void> {
    // IndexedDB implementation would go here
  }

  async keys(): Promise<string[]> {
    // IndexedDB implementation would go here
    return [];
  }

  async size(): Promise<number> {
    // IndexedDB implementation would go here
    return 0;
  }

  async stats(): Promise<CacheStoreStats> {
    return { ...this.stats };
  }
}

export default GenericCachingService;