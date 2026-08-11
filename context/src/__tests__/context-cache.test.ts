/**
 * Tests for context cache
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ContextCache,
  getGlobalCache,
  resetGlobalCache,
} from "../workspace/context-cache.js";
import { resetGlobalEventEmitter } from "../workspace/events.js";
import type { ContextPacket } from "../types/index.js";

describe("Context Cache", () => {
  let cache: ContextCache;

  beforeEach(() => {
    resetGlobalEventEmitter();
    cache = new ContextCache({ maxSize: 10, ttlMs: 60000 });
  });

  afterEach(() => {
    resetGlobalCache();
    resetGlobalEventEmitter();
  });

  describe("basic operations", () => {
    it("should set and get values", () => {
      cache.set("key1", "value1");
      expect(cache.get("key1")).toBe("value1");
    });

    it("should return undefined for missing keys", () => {
      expect(cache.get("nonexistent")).toBeUndefined();
    });

    it("should delete keys", () => {
      cache.set("key1", "value1");
      cache.delete("key1");
      expect(cache.get("key1")).toBeUndefined();
    });

    it("should report size correctly", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      expect(cache.size).toBe(2);
    });
  });

  describe("context packet caching", () => {
    it("should cache context packets", () => {
      const packet: ContextPacket = {
        task: "test task",
        repositories: [],
        instructions: [],
        architecture: [],
        files: [],
        symbols: [],
        dependencies: [],
        capabilities: [],
        tests: [],
        decisions: [],
        history: [],
        sources: [],
      };

      cache.setContextPacket("test task", packet, "repo-1", "main", 1000);
      const cached = cache.getContextPacket("test task", "repo-1", "main", 1000);

      expect(cached).toEqual(packet);
    });

    it("should not return packets with different parameters", () => {
      const packet: ContextPacket = {
        task: "test task",
        repositories: [],
        instructions: [],
        architecture: [],
        files: [],
        symbols: [],
        dependencies: [],
        capabilities: [],
        tests: [],
        decisions: [],
        history: [],
        sources: [],
      };

      cache.setContextPacket("test task", packet, "repo-1", "main", 1000);
      
      // Different repository
      expect(cache.getContextPacket("test task", "repo-2", "main", 1000)).toBeUndefined();
      // Different branch
      expect(cache.getContextPacket("test task", "repo-1", "feature", 1000)).toBeUndefined();
      // Different budget
      expect(cache.getContextPacket("test task", "repo-1", "main", 2000)).toBeUndefined();
    });
  });

  describe("invalidation", () => {
    it("should invalidate by repository", () => {
      cache.set("key1", "value1", { repositoryId: "repo-1" });
      cache.set("key2", "value2", { repositoryId: "repo-1" });
      cache.set("key3", "value3", { repositoryId: "repo-2" });

      cache.invalidateByRepository("repo-1");

      expect(cache.get("key1")).toBeUndefined();
      expect(cache.get("key2")).toBeUndefined();
      expect(cache.get("key3")).toBe("value3");
    });

    it("should invalidate by commit", () => {
      cache.set("key1", "value1", { commitSha: "abc123" });
      cache.set("key2", "value2", { commitSha: "def456" });

      cache.invalidateByCommit("abc123");

      expect(cache.get("key1")).toBeUndefined();
      expect(cache.get("key2")).toBe("value2");
    });

    it("should invalidate all", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");

      cache.invalidateAll();

      expect(cache.size).toBe(0);
    });
  });

  describe("TTL expiration", () => {
    it("should expire entries after TTL", () => {
      const shortCache = new ContextCache({ maxSize: 10, ttlMs: 1 });
      shortCache.set("key1", "value1");

      // Wait for TTL to expire
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(shortCache.get("key1")).toBeUndefined();
          resolve();
        }, 10);
      });
    });
  });

  describe("LRU eviction", () => {
    it("should evict least recently used when at capacity", () => {
      const smallCache = new ContextCache({ maxSize: 3, ttlMs: 60000 });
      
      smallCache.set("key1", "value1");
      smallCache.set("key2", "value2");
      smallCache.set("key3", "value3");
      
      // Access key2 and key3 to make them more recent, key1 becomes LRU
      smallCache.get("key2");
      smallCache.get("key3");
      
      // Add key4, should evict key1 (least recently used)
      smallCache.set("key4", "value4");

      expect(smallCache.get("key1")).toBeUndefined();
      expect(smallCache.get("key2")).toBe("value2");
      expect(smallCache.get("key3")).toBe("value3");
      expect(smallCache.get("key4")).toBe("value4");
    });
  });

  describe("statistics", () => {
    it("should track cache statistics", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.get("key1");
      cache.get("key1");
      cache.get("key2");

      const stats = cache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(10);
      expect(stats.totalAccesses).toBe(5); // 2 sets + 3 gets that incremented
    });
  });

  describe("global cache", () => {
    it("should return the same instance", () => {
      const cache1 = getGlobalCache();
      const cache2 = getGlobalCache();
      
      expect(cache1).toBe(cache2);
    });

    it("should reset properly", () => {
      const cache1 = getGlobalCache();
      cache1.set("key1", "value1");
      
      resetGlobalCache();
      
      const cache2 = getGlobalCache();
      expect(cache2.get("key1")).toBeUndefined();
    });
  });
});
