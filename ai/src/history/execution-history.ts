/**
 * Execution history and audit logging
 */

import { HistoryEntry, ExecutionResult } from "../types/index.js";
import { randomUUID } from "crypto";

export class ExecutionHistory {
  private entries: HistoryEntry[] = [];

  /**
   * Record an execution result to history
   */
  recordResult(result: ExecutionResult): HistoryEntry {
    const entry: HistoryEntry = {
      id: randomUUID(),
      taskId: result.taskId,
      timestamp: new Date(),
      action: result.success ? "EXECUTE_SUCCESS" : "EXECUTE_FAILURE",
      result: result.success
        ? `Model: ${result.model.name}, Tokens: ${result.tokensUsed.total}, Cost: $${result.cost.toFixed(4)}`
        : `Error: ${result.output}`,
      metadata: {
        model: result.model.name,
        tokensUsed: result.tokensUsed,
        cost: result.cost,
        validationPassed: result.validationPassed,
        duration: result.duration,
        escalated: result.escalated,
      },
    };

    this.entries.push(entry);
    return entry;
  }

  /**
   * Record an event to history
   */
  recordEvent(taskId: string, action: string, result: string, metadata?: Record<string, unknown>): HistoryEntry {
    const entry: HistoryEntry = {
      id: randomUUID(),
      taskId,
      timestamp: new Date(),
      action,
      result,
      metadata: metadata || {},
    };

    this.entries.push(entry);
    return entry;
  }

  /**
   * Get all history entries
   */
  getAll(): HistoryEntry[] {
    return [...this.entries];
  }

  /**
   * Get history for a specific task
   */
  getByTask(taskId: string): HistoryEntry[] {
    return this.entries.filter((e) => e.taskId === taskId);
  }

  /**
   * Get history by action type
   */
  getByAction(action: string): HistoryEntry[] {
    return this.entries.filter((e) => e.action === action);
  }

  /**
   * Get recent history
   */
  getRecent(limit: number = 10): HistoryEntry[] {
    return this.entries.slice(-limit);
  }

  /**
   * Clear old history entries (older than specified days)
   */
  clearOlderThan(days: number): number {
    const cutoffTime = new Date();
    cutoffTime.setDate(cutoffTime.getDate() - days);

    const beforeLength = this.entries.length;
    this.entries = this.entries.filter((e) => e.timestamp > cutoffTime);
    return beforeLength - this.entries.length;
  }
}
