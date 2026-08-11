/**
 * Tests for context event system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ContextEventEmitter,
  ContextEvents,
  getGlobalEventEmitter,
  resetGlobalEventEmitter,
} from "../workspace/events.js";

describe("Context Event System", () => {
  let emitter: ContextEventEmitter;

  beforeEach(() => {
    emitter = new ContextEventEmitter();
  });

  afterEach(() => {
    emitter.removeAllListeners();
    resetGlobalEventEmitter();
  });

  describe("ContextEventEmitter", () => {
    it("should emit and receive events", async () => {
      const listener = vi.fn();
      emitter.on("FILE_CHANGED", listener);

      await emitter.emit("FILE_CHANGED", {
        repositoryId: "repo-1",
        entityType: "file",
        entityId: "src/index.ts",
      });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].eventType).toBe("FILE_CHANGED");
      expect(listener.mock.calls[0][0].repositoryId).toBe("repo-1");
    });

    it("should support wildcard listeners", async () => {
      const listener = vi.fn();
      emitter.on("*", listener);

      await emitter.emit("FILE_CHANGED", { repositoryId: "repo-1" });
      await emitter.emit("COMMIT_CHANGED", { repositoryId: "repo-1" });

      expect(listener).toHaveBeenCalledTimes(2);
    });

    it("should support once listeners", async () => {
      const listener = vi.fn();
      emitter.once("FILE_CHANGED", listener);

      await emitter.emit("FILE_CHANGED", { repositoryId: "repo-1" });
      await emitter.emit("FILE_CHANGED", { repositoryId: "repo-1" });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should support unsubscribe", async () => {
      const listener = vi.fn();
      const subscription = emitter.on("FILE_CHANGED", listener);

      await emitter.emit("FILE_CHANGED", { repositoryId: "repo-1" });
      subscription.unsubscribe();
      await emitter.emit("FILE_CHANGED", { repositoryId: "repo-1" });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should store event history", async () => {
      await emitter.emit("FILE_CHANGED", { repositoryId: "repo-1" });
      await emitter.emit("FILE_ADDED", { repositoryId: "repo-1" });

      const history = emitter.getRecentEvents();
      expect(history.length).toBe(2);
      expect(history[0].eventType).toBe("FILE_CHANGED");
      expect(history[1].eventType).toBe("FILE_ADDED");
    });

    it("should filter events by type", async () => {
      await emitter.emit("FILE_CHANGED", { repositoryId: "repo-1" });
      await emitter.emit("FILE_ADDED", { repositoryId: "repo-1" });
      await emitter.emit("FILE_CHANGED", { repositoryId: "repo-1" });

      const events = emitter.getEventsByType("FILE_CHANGED");
      expect(events.length).toBe(2);
    });

    it("should filter events by repository", async () => {
      await emitter.emit("FILE_CHANGED", { repositoryId: "repo-1" });
      await emitter.emit("FILE_CHANGED", { repositoryId: "repo-2" });

      const events = emitter.getEventsForRepository("repo-1");
      expect(events.length).toBe(1);
    });

    it("should report listener count", () => {
      emitter.on("FILE_CHANGED", () => {});
      emitter.on("FILE_CHANGED", () => {});
      emitter.on("COMMIT_CHANGED", () => {});

      expect(emitter.listenerCount("FILE_CHANGED")).toBe(2);
      expect(emitter.listenerCount("COMMIT_CHANGED")).toBe(1);
      expect(emitter.listenerCount()).toBe(3);
    });
  });

  describe("ContextEvents helpers", () => {
    it("should create fileChanged event", () => {
      const event = ContextEvents.fileChanged("repo-1", "src/index.ts", "SOURCE");
      
      expect(event.repositoryId).toBe("repo-1");
      expect(event.entityType).toBe("file");
      expect(event.entityId).toBe("src/index.ts");
      expect(event.data?.changeType).toBe("SOURCE");
    });

    it("should create commitChanged event", () => {
      const event = ContextEvents.commitChanged("repo-1", "abc123", "def456");
      
      expect(event.repositoryId).toBe("repo-1");
      expect(event.data?.oldCommit).toBe("abc123");
      expect(event.data?.newCommit).toBe("def456");
    });

    it("should create branchChanged event", () => {
      const event = ContextEvents.branchChanged("repo-1", "main", "feature/test");
      
      expect(event.repositoryId).toBe("repo-1");
      expect(event.data?.oldBranch).toBe("main");
      expect(event.data?.newBranch).toBe("feature/test");
    });

    it("should create indexCompleted event", () => {
      const event = ContextEvents.indexCompleted("repo-1", {
        files: 100,
        symbols: 500,
        duration: 1234,
      });
      
      expect(event.repositoryId).toBe("repo-1");
      expect(event.data?.files).toBe(100);
      expect(event.data?.symbols).toBe(500);
    });
  });

  describe("Global event emitter", () => {
    it("should return the same instance", () => {
      const emitter1 = getGlobalEventEmitter();
      const emitter2 = getGlobalEventEmitter();
      
      expect(emitter1).toBe(emitter2);
    });

    it("should reset properly", () => {
      const emitter1 = getGlobalEventEmitter();
      resetGlobalEventEmitter();
      const emitter2 = getGlobalEventEmitter();
      
      expect(emitter1).not.toBe(emitter2);
    });
  });
});
