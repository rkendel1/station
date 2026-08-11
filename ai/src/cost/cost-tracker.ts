/**
 * Cost tracking - monitors task execution costs
 */

import { CostRecord, ExecutionResult } from "../types/index.js";
import { randomUUID } from "crypto";

export class CostTracker {
  private records: CostRecord[] = [];

  /**
   * Record the cost of a task execution
   */
  recordExecution(result: ExecutionResult): CostRecord {
    const record: CostRecord = {
      id: randomUUID(),
      taskId: result.taskId,
      modelUsed: result.model.name,
      inputTokens: result.tokensUsed.input,
      outputTokens: result.tokensUsed.output,
      costPerToken: result.model.costPer1kTokens / 1000,
      totalCost: result.cost,
      timestamp: new Date(),
    };

    this.records.push(record);
    return record;
  }

  /**
   * Get all cost records
   */
  getRecords(): CostRecord[] {
    return [...this.records];
  }

  /**
   * Get total cost
   */
  getTotalCost(): number {
    return this.records.reduce((sum, record) => sum + record.totalCost, 0);
  }

  /**
   * Get average cost per task
   */
  getAverageCostPerTask(): number {
    if (this.records.length === 0) return 0;
    return this.getTotalCost() / this.records.length;
  }

  /**
   * Get cost by model
   */
  getCostByModel(modelName: string): number {
    return this.records
      .filter((r) => r.modelUsed === modelName)
      .reduce((sum, r) => sum + r.totalCost, 0);
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    return {
      totalTasks: this.records.length,
      totalCost: this.getTotalCost(),
      averageCostPerTask: this.getAverageCostPerTask(),
      totalInputTokens: this.records.reduce((sum, r) => sum + r.inputTokens, 0),
      totalOutputTokens: this.records.reduce((sum, r) => sum + r.outputTokens, 0),
      modelCosts: this.getModelCostBreakdown(),
    };
  }

  private getModelCostBreakdown(): Record<string, number> {
    const breakdown: Record<string, number> = {};
    for (const record of this.records) {
      breakdown[record.modelUsed] = (breakdown[record.modelUsed] || 0) + record.totalCost;
    }
    return breakdown;
  }
}
