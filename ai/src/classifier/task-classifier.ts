/**
 * Task classifier - understands coding requests and classifies them
 */

import { TaskClassification, TaskCategory, TaskComplexity } from "../types/index.js";
import { ContextStore } from "@station/context";

export interface ClassifierInput {
  task: string;
  repositoryContext?: string;
  additionalContext?: string;
}

export class TaskClassifier {
  constructor(private contextStore: ContextStore) {}

  /**
   * Classify a coding task
   */
  async classify(input: ClassifierInput): Promise<TaskClassification> {
    // Analyze the task description
    const category = this.categorizeTask(input.task);
    const complexity = this.assessComplexity(input.task, category);
    const requiredCapabilities = this.identifyCapabilities(input.task, category);

    // Estimate tokens needed
    const estimatedTokens = this.estimateTokens(
      input.task,
      input.repositoryContext,
      complexity
    );

    return {
      category,
      complexity,
      confidence: 0.85,
      reasoning: `Task classified as ${category} with ${complexity} complexity based on keyword analysis and context.`,
      estimatedTokens,
      requiredCapabilities,
    };
  }

  private categorizeTask(task: string): TaskCategory {
    const lowerTask = task.toLowerCase();

    if (
      lowerTask.includes("bug") ||
      lowerTask.includes("fix") ||
      lowerTask.includes("error")
    ) {
      return TaskCategory.BUG_FIX;
    }
    if (
      lowerTask.includes("add") ||
      lowerTask.includes("feature") ||
      lowerTask.includes("implement")
    ) {
      return TaskCategory.FEATURE;
    }
    if (
      lowerTask.includes("refactor") ||
      lowerTask.includes("restructure") ||
      lowerTask.includes("reorganize")
    ) {
      return TaskCategory.REFACTOR;
    }
    if (
      lowerTask.includes("test") ||
      lowerTask.includes("spec") ||
      lowerTask.includes("coverage")
    ) {
      return TaskCategory.TEST;
    }
    if (
      lowerTask.includes("doc") ||
      lowerTask.includes("readme") ||
      lowerTask.includes("comment")
    ) {
      return TaskCategory.DOCUMENTATION;
    }
    if (
      lowerTask.includes("performance") ||
      lowerTask.includes("optimize") ||
      lowerTask.includes("speed")
    ) {
      return TaskCategory.OPTIMIZATION;
    }
    if (
      lowerTask.includes("infrastructure") ||
      lowerTask.includes("deploy") ||
      lowerTask.includes("config")
    ) {
      return TaskCategory.INFRASTRUCTURE;
    }
    return TaskCategory.UNKNOWN;
  }

  private assessComplexity(task: string, category: TaskCategory): TaskComplexity {
    const lowerTask = task.toLowerCase();
    const words = lowerTask.split(/\s+/);
    const wordCount = words.length;

    // Simple heuristics for complexity assessment
    if (wordCount < 10 && !lowerTask.includes("multiple")) {
      return TaskComplexity.SIMPLE;
    }
    if (
      category === TaskCategory.REFACTOR ||
      category === TaskCategory.INFRASTRUCTURE
    ) {
      return TaskComplexity.COMPLEX;
    }
    if (wordCount > 50 || lowerTask.includes("complex")) {
      return TaskComplexity.COMPLEX;
    }
    return TaskComplexity.MODERATE;
  }

  private identifyCapabilities(task: string, category: TaskCategory): string[] {
    const capabilities: Set<string> = new Set();

    const lowerTask = task.toLowerCase();

    if (lowerTask.includes("test") || category === TaskCategory.TEST) {
      capabilities.add("testing");
      capabilities.add("framework-knowledge");
    }

    if (
      lowerTask.includes("database") ||
      lowerTask.includes("query") ||
      lowerTask.includes("sql")
    ) {
      capabilities.add("database");
    }

    if (
      lowerTask.includes("api") ||
      lowerTask.includes("rest") ||
      lowerTask.includes("http")
    ) {
      capabilities.add("api-design");
    }

    if (
      lowerTask.includes("security") ||
      lowerTask.includes("auth") ||
      lowerTask.includes("encrypt")
    ) {
      capabilities.add("security");
    }

    if (lowerTask.includes("performance")) {
      capabilities.add("performance-optimization");
    }

    capabilities.add("code-generation");
    capabilities.add("error-analysis");

    return Array.from(capabilities);
  }

  private estimateTokens(
    task: string,
    repositoryContext: string | undefined,
    complexity: TaskComplexity
  ): number {
    // Rough estimation: 1 word ≈ 1.3 tokens
    const taskTokens = Math.ceil(task.length / 4);
    const contextTokens = repositoryContext ? Math.ceil(repositoryContext.length / 4) : 0;
    const complexityMultiplier =
      complexity === TaskComplexity.SIMPLE
        ? 1
        : complexity === TaskComplexity.MODERATE
          ? 2
          : 4;

    return (taskTokens + contextTokens) * complexityMultiplier;
  }
}
