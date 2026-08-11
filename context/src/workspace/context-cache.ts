/**
 * PR7: Context cache - in-memory cache for frequently accessed context
 */

import { createHash } from "crypto";
import type { ContextPacket } from "../types/index.js";
import { ContextEventEmitter, getGlobalEventEmitter } from "./events.js";

/**
 * Cache entry
 */
interface CacheEntry<T> {
  value: T;
  createdAt: Date;
  accessedAt: Date;
  accessCount: number;
  repositoryId?: string;
  commitSha?: string;
}

/**
 * Cache options
 */
export interface ContextCacheOptions {
  maxSize?: number;
  ttlMs?: number;
  eventEmitter?: ContextEventEmitter;
}

const DEFAULT_OPTIONS: ContextCacheOptions = {
  maxSize: 100,
  ttlMs: 5 * 60 * 1000, // 5 minutes
};

/**
 * Context cache - LRU cache with invalidation support
 */
export class ContextCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private options: Required<ContextCacheOptions>;
  private eventEmitter: ContextEventEmitter;

  constructor(options: ContextCacheOptions = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      eventEmitter: options.eventEmitter ?? getGlobalEventEmitter(),
    } as Required<ContextCacheOptions>;
    this.eventEmitter = this.options.eventEmitter;

    // Subscribe to invalidation events
    this.eventEmitter.on("CONTEXT_INVALIDATED", (event) => {
      if (event.repositoryId) {
        this.invalidateByRepository(event.repositoryId);
      }
    });

    this.eventEmitter.on("FILE_CHANGED", (event) => {
      if (event.repositoryId) {
        this.invalidateByRepository(event.repositoryId);
      }
    });

    this.eventEmitter.on("COMMIT_CHANGED", (event) => {
      if (event.repositoryId) {
        this.invalidateByRepository(event.repositoryId);
      }
    });
  }

  /**
   * Generate a cache key
   */
  private generateKey(
    task: string,
    repositoryId?: string,
    branch?: string,
    budget?: number
  ): string {
    const data = `${task}:${repositoryId ?? ""}:${branch ?? ""}:${budget ?? ""}`;
    return createHash("md5").update(data).digest("hex");
  }

  /**
   * Get a value from cache
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    // Check TTL
    const now = Date.now();
    if (now - entry.createdAt.getTime() > this.options.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    // Update access time and count
    entry.accessedAt = new Date();
    entry.accessCount++;

    return entry.value as T;
  }

  /**
   * Set a value in cache
   */
  set<T>(
    key: string,
    value: T,
    options?: { repositoryId?: string; commitSha?: string }
  ): void {
    // Evict if at capacity
    if (this.cache.size >= this.options.maxSize) {
      this.evictLRU();
    }

    const now = new Date();
    this.cache.set(key, {
      value,
      createdAt: now,
      accessedAt: now,
      accessCount: 1,
      repositoryId: options?.repositoryId,
      commitSha: options?.commitSha,
    });
  }

  /**
   * Get context packet from cache
   */
  getContextPacket(
    task: string,
    repositoryId?: string,
    branch?: string,
    budget?: number
  ): ContextPacket | undefined {
    const key = this.generateKey(task, repositoryId, branch, budget);
    return this.get<ContextPacket>(key);
  }

  /**
   * Set context packet in cache
   */
  setContextPacket(
    task: string,
    packet: ContextPacket,
    repositoryId?: string,
    branch?: string,
    budget?: number
  ): void {
    const key = this.generateKey(task, repositoryId, branch, budget);
    this.set(key, packet, { repositoryId });
  }

  /**
   * Invalidate cache entries by repository
   */
  invalidateByRepository(repositoryId: string): void {
    for (const [key, entry] of this.cache) {
      if (entry.repositoryId === repositoryId) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Invalidate cache entries by commit
   */
  invalidateByCommit(commitSha: string): void {
    for (const [key, entry] of this.cache) {
      if (entry.commitSha === commitSha) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Invalidate all cache entries
   */
  invalidateAll(): void {
    this.cache.clear();
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Evict least recently used entries
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.accessedAt.getTime() < oldestTime) {
        oldestTime = entry.accessedAt.getTime();
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    totalAccesses: number;
  } {
    let totalAccesses = 0;
    for (const entry of this.cache.values()) {
      totalAccesses += entry.accessCount;
    }

    return {
      size: this.cache.size,
      maxSize: this.options.maxSize,
      hitRate: this.cache.size > 0 ? totalAccesses / this.cache.size : 0,
      totalAccesses,
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache) {
      if (now - entry.createdAt.getTime() > this.options.ttlMs) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }
}

// Global cache singleton
let globalCache: ContextCache | null = null;

/**
 * Get the global context cache
 */
export function getGlobalCache(): ContextCache {
  if (!globalCache) {
    globalCache = new ContextCache();
  }
  return globalCache;
}

/**
 * Reset the global cache (useful for testing)
 */
export function resetGlobalCache(): void {
  if (globalCache) {
    globalCache.invalidateAll();
  }
  globalCache = null;
}
