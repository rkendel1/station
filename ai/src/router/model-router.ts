/**
 * Model router - selects the cheapest qualified model for a task
 */

import {
  TaskClassification,
  TaskComplexity,
  RoutingDecision,
  Model,
} from "../types/index.js";
import { ModelProviderRegistry } from "../providers/model-provider.js";

export class ModelRouter {
  constructor(private providerRegistry: ModelProviderRegistry) {}

  /**
   * Route a task to the best model
   * Uses the principle: "Use the cheapest qualified model that can reliably complete the task"
   */
  async route(
    classification: TaskClassification,
    maxBudget?: number
  ): Promise<RoutingDecision> {
    const allModels = await this.providerRegistry.getAllModels();
    const availableModels = allModels.filter((m) => m.available);

    if (availableModels.length === 0) {
      throw new Error("No available models");
    }

    // Filter models that can handle the task complexity
    const qualifiedModels = this.filterByComplexity(
      availableModels,
      classification.complexity
    );

    // Filter by budget if specified
    const budgetModels =
      maxBudget !== undefined
        ? qualifiedModels.filter((m) => m.costPer1kTokens <= maxBudget)
        : qualifiedModels;

    if (budgetModels.length === 0) {
      throw new Error(
        `No models available within budget ${maxBudget} for complexity ${classification.complexity}`
      );
    }

    // Sort by cost (cheapest first)
    budgetModels.sort((a, b) => a.costPer1kTokens - b.costPer1kTokens);

    const selectedModel = budgetModels[0];
    const alternativeModels = budgetModels.slice(1);

    // Estimate cost
    const estimatedCost =
      (classification.estimatedTokens / 1000) * selectedModel.costPer1kTokens;

    // Determine if escalation is needed
    const shouldEscalate =
      classification.complexity === TaskComplexity.FRONTIER ||
      (classification.complexity === TaskComplexity.COMPLEX &&
        classification.confidence < 0.6);

    return {
      selectedModel,
      alternativeModels,
      estimatedCost,
      confidence: classification.confidence,
      reasoning: `Selected ${selectedModel.name} for ${classification.category} (${classification.complexity}). Cost: $${estimatedCost.toFixed(4)}. Escalation: ${shouldEscalate ? "enabled" : "disabled"}.`,
      shouldEscalate,
    };
  }

  private filterByComplexity(
    models: Model[],
    complexity: TaskComplexity
  ): Model[] {
    return models.filter((m) =>
      m.recommendedForComplexity.includes(complexity)
    );
  }
}
