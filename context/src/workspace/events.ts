/**
 * PR7: Context event system - internal event bus for change notifications
 */

import { randomUUID } from "crypto";
import type { ContextEvent, ContextEventType } from "../types/index.js";

/**
 * Event listener callback type
 */
export type EventListener = (event: ContextEvent) => void | Promise<void>;

/**
 * Event subscription handle
 */
export interface EventSubscription {
  unsubscribe: () => void;
}

/**
 * Context event emitter - manages event subscriptions and dispatching
 */
export class ContextEventEmitter {
  private listeners: Map<ContextEventType | "*", Set<EventListener>> = new Map();
  private eventHistory: ContextEvent[] = [];
  private maxHistorySize: number;

  constructor(options: { maxHistorySize?: number } = {}) {
    this.maxHistorySize = options.maxHistorySize ?? 1000;
  }

  /**
   * Subscribe to a specific event type
   */
  on(eventType: ContextEventType | "*", listener: EventListener): EventSubscription {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);

    return {
      unsubscribe: () => {
        this.listeners.get(eventType)?.delete(listener);
      },
    };
  }

  /**
   * Subscribe to an event type once
   */
  once(eventType: ContextEventType | "*", listener: EventListener): EventSubscription {
    const wrappedListener: EventListener = async (event) => {
      subscription.unsubscribe();
      await listener(event);
    };
    const subscription = this.on(eventType, wrappedListener);
    return subscription;
  }

  /**
   * Emit an event
   */
  async emit(
    eventType: ContextEventType,
    data?: Partial<Omit<ContextEvent, "id" | "eventType" | "timestamp">>
  ): Promise<ContextEvent> {
    const event: ContextEvent = {
      id: randomUUID(),
      eventType,
      repositoryId: data?.repositoryId,
      entityType: data?.entityType,
      entityId: data?.entityId,
      data: data?.data,
      timestamp: new Date(),
    };

    // Store in history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Notify listeners
    const promises: Promise<void>[] = [];

    // Specific event type listeners
    const typeListeners = this.listeners.get(eventType);
    if (typeListeners) {
      for (const listener of typeListeners) {
        const result = listener(event);
        if (result instanceof Promise) {
          promises.push(result);
        }
      }
    }

    // Wildcard listeners
    const wildcardListeners = this.listeners.get("*");
    if (wildcardListeners) {
      for (const listener of wildcardListeners) {
        const result = listener(event);
        if (result instanceof Promise) {
          promises.push(result);
        }
      }
    }

    // Wait for all async listeners
    await Promise.all(promises);

    return event;
  }

  /**
   * Get recent events
   */
  getRecentEvents(count?: number): ContextEvent[] {
    const limit = count ?? 100;
    return this.eventHistory.slice(-limit);
  }

  /**
   * Get events by type
   */
  getEventsByType(eventType: ContextEventType, count?: number): ContextEvent[] {
    const limit = count ?? 100;
    return this.eventHistory
      .filter((e) => e.eventType === eventType)
      .slice(-limit);
  }

  /**
   * Get events for a repository
   */
  getEventsForRepository(repositoryId: string, count?: number): ContextEvent[] {
    const limit = count ?? 100;
    return this.eventHistory
      .filter((e) => e.repositoryId === repositoryId)
      .slice(-limit);
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.listeners.clear();
  }

  /**
   * Get listener count for a specific event type
   */
  listenerCount(eventType?: ContextEventType | "*"): number {
    if (eventType) {
      return this.listeners.get(eventType)?.size ?? 0;
    }
    let count = 0;
    for (const listeners of this.listeners.values()) {
      count += listeners.size;
    }
    return count;
  }
}

/**
 * Convenience functions for creating common events
 */
export const ContextEvents = {
  fileChanged(
    repositoryId: string,
    filePath: string,
    changeType: string
  ): Partial<ContextEvent> {
    return {
      repositoryId,
      entityType: "file",
      entityId: filePath,
      data: { changeType },
    };
  },

  fileAdded(
    repositoryId: string,
    filePath: string,
    changeType: string
  ): Partial<ContextEvent> {
    return {
      repositoryId,
      entityType: "file",
      entityId: filePath,
      data: { changeType },
    };
  },

  fileDeleted(repositoryId: string, filePath: string): Partial<ContextEvent> {
    return {
      repositoryId,
      entityType: "file",
      entityId: filePath,
    };
  },

  commitChanged(
    repositoryId: string,
    oldCommit: string,
    newCommit: string
  ): Partial<ContextEvent> {
    return {
      repositoryId,
      data: { oldCommit, newCommit },
    };
  },

  branchChanged(
    repositoryId: string,
    oldBranch: string,
    newBranch: string
  ): Partial<ContextEvent> {
    return {
      repositoryId,
      data: { oldBranch, newBranch },
    };
  },

  dependencyChanged(
    repositoryId: string,
    manifestFile: string
  ): Partial<ContextEvent> {
    return {
      repositoryId,
      entityType: "dependency",
      entityId: manifestFile,
    };
  },

  symbolChanged(
    repositoryId: string,
    symbolId: string,
    symbolName: string
  ): Partial<ContextEvent> {
    return {
      repositoryId,
      entityType: "symbol",
      entityId: symbolId,
      data: { symbolName },
    };
  },

  capabilityChanged(
    repositoryId: string,
    capabilityId: string,
    capabilityName: string
  ): Partial<ContextEvent> {
    return {
      repositoryId,
      entityType: "capability",
      entityId: capabilityId,
      data: { capabilityName },
    };
  },

  indexCompleted(
    repositoryId: string,
    stats: { files: number; symbols: number; duration: number }
  ): Partial<ContextEvent> {
    return {
      repositoryId,
      data: stats,
    };
  },

  contextInvalidated(
    repositoryId: string,
    reason: string,
    affectedEntities: string[]
  ): Partial<ContextEvent> {
    return {
      repositoryId,
      data: { reason, affectedEntities },
    };
  },
};

// Global event emitter singleton
let globalEmitter: ContextEventEmitter | null = null;

/**
 * Get the global context event emitter
 */
export function getGlobalEventEmitter(): ContextEventEmitter {
  if (!globalEmitter) {
    globalEmitter = new ContextEventEmitter();
  }
  return globalEmitter;
}

/**
 * Reset the global event emitter (useful for testing)
 */
export function resetGlobalEventEmitter(): void {
  if (globalEmitter) {
    globalEmitter.removeAllListeners();
    globalEmitter.clearHistory();
  }
  globalEmitter = null;
}
