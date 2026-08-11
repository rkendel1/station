/**
 * Execution engine - executes tasks through selected models
 */

import {
  ExecutionContext,
  ExecutionResult,
  TaskCategory,
} from "../types/index.js";
import { ModelProvider, ChatMessage } from "../providers/model-provider.js";
import { ContextStore } from "@station/context";

export class ExecutionEngine {
  constructor(
    private modelProvider: ModelProvider,
    private contextStore: ContextStore
  ) {}

  /**
   * Execute a task using the selected model
   */
  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // Build the prompt with context
      const prompt = this.buildPrompt(context);

      // Execute the model
      const response = await this.modelProvider.completions({
        model: context.routing.selectedModel.id,
        messages: [
          {
            role: "system",
            content:
              "You are a professional software engineer. Provide precise, working code and explanations.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        maxTokens: Math.min(
          2048,
          context.routing.selectedModel.maxContextLength / 2
        ),
      });

      const duration = Date.now() - startTime;

      return {
        taskId: context.taskId,
        success: true,
        output: response.content,
        model: context.routing.selectedModel,
        tokensUsed: {
          input: response.inputTokens,
          output: response.outputTokens,
          total: response.inputTokens + response.outputTokens,
        },
        cost:
          (response.inputTokens + response.outputTokens) / 1000 *
          context.routing.selectedModel.costPer1kTokens,
        validationPassed: false,
        validationFeedback: "Pending validation",
        duration,
        escalated: false,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        taskId: context.taskId,
        success: false,
        output: `Error: ${error instanceof Error ? error.message : String(error)}`,
        model: context.routing.selectedModel,
        tokensUsed: {
          input: 0,
          output: 0,
          total: 0,
        },
        cost: 0,
        validationPassed: false,
        validationFeedback: `Execution failed: ${error instanceof Error ? error.message : String(error)}`,
        duration,
        escalated: false,
      };
    }
  }

  private buildPrompt(context: ExecutionContext): string {
    const categoryPrefix = this.getCategoryPrefix(context.classification.category);
    return `${categoryPrefix}

Task: ${context.task}

Estimated complexity: ${context.classification.complexity}
Required capabilities: ${context.classification.requiredCapabilities.join(", ")}

Please provide:
1. A clear solution or explanation
2. Working code if applicable
3. Any important considerations or edge cases`;
  }

  private getCategoryPrefix(category: TaskCategory): string {
    switch (category) {
      case TaskCategory.BUG_FIX:
        return "You are helping fix a bug in the code. Identify the root cause and provide a fix.";
      case TaskCategory.FEATURE:
        return "You are implementing a new feature. Provide complete, working code.";
      case TaskCategory.REFACTOR:
        return "You are refactoring code to improve quality. Maintain functionality while improving structure.";
      case TaskCategory.TEST:
        return "You are writing tests. Create comprehensive test cases with good coverage.";
      case TaskCategory.DOCUMENTATION:
        return "You are writing documentation. Be clear, concise, and comprehensive.";
      case TaskCategory.OPTIMIZATION:
        return "You are optimizing code for performance. Focus on algorithmic improvements.";
      case TaskCategory.INFRASTRUCTURE:
        return "You are working on infrastructure and configuration. Be precise and consider security.";
      default:
        return "You are helping with a coding task. Provide a thoughtful, complete solution.";
    }
  }
}
