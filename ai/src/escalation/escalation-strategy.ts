/**
 * Escalation strategy - handles retries and model escalation
 */

import {
  ExecutionContext,
  ExecutionResult,
  TaskComplexity,
} from "../types/index.js";
import { ModelRouter } from "../router/model-router.js";
import { ModelProviderRegistry } from "../providers/model-provider.js";

export interface EscalationDecision {
  shouldEscalate: boolean;
  reason: string;
  nextModel?: string;
}

export class EscalationStrategy {
  constructor(
    private router: ModelRouter,
    private providerRegistry: ModelProviderRegistry
  ) {}

  /**
   * Decide whether to escalate based on execution failures
   */
  async evaluate(
    context: ExecutionContext,
    result: ExecutionResult
  ): Promise<EscalationDecision> {
    // If successful, no escalation needed
    if (result.success && result.validationPassed) {
      return {
        shouldEscalate: false,
        reason: "Execution successful and validation passed",
      };
    }

    // Check if we've hit the retry limit
    if (context.currentRetry >= context.maxRetries) {
      return {
        shouldEscalate: false,
        reason: `Max retries (${context.maxRetries}) reached`,
      };
    }

    // If validation failed but execution succeeded, retry with same model
    if (result.success && !result.validationPassed) {
      return {
        shouldEscalate: true,
        reason: "Validation failed, will retry with same model",
        nextModel: result.model.id,
      };
    }

    // If execution failed, try to escalate to a more capable model
    if (!result.success) {
      const allModels = await this.providerRegistry.getAllModels();
      const betterModels = allModels.filter((m) => {
        // Find models with higher cost (more capable)
        return (
          m.costPer1kTokens > result.model.costPer1kTokens &&
          m.recommendedForComplexity.includes(TaskComplexity.FRONTIER)
        );
      });

      if (betterModels.length > 0) {
        betterModels.sort((a, b) => a.costPer1kTokens - b.costPer1kTokens);
        return {
          shouldEscalate: true,
          reason: `Execution failed, escalating to ${betterModels[0].name}`,
          nextModel: betterModels[0].id,
        };
      }

      return {
        shouldEscalate: false,
        reason: `Execution failed and no more capable models available`,
      };
    }

    return {
      shouldEscalate: false,
      reason: "No escalation needed",
    };
  }
}
