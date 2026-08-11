/**
 * Context planner - plans context selection for tasks
 */

import type { Database } from "../db/client.js";
import type { ContextPacket, ContextSource } from "../types/index.js";
import { ContextRetriever } from "./searcher.js";

export interface PlanningOptions {
  budget?: number; // Token budget
  includeSymbols?: boolean;
  includeTests?: boolean;
  includeDecisions?: boolean;
  minConfidence?: number;
}

export interface ContextPlanResult {
  packet: ContextPacket;
  tokensUsed: number;
  tokensAvailable: number;
}

export class ContextPlanner {
  private retriever: ContextRetriever;

  constructor(private db: Database) {
    this.retriever = new ContextRetriever(db);
  }

  /**
   * Estimate tokens for a string (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Simple heuristic: approximately 1 token per 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Plan context for a task
   */
  async planContextForTask(
    task: string,
    options: PlanningOptions = {}
  ): Promise<ContextPlanResult> {
    const budget = options.budget || 8000; // Default 8K tokens
    let tokensUsed = 0;

    const packet: ContextPacket = {
      task,
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

    // Search for relevant context
    const searchResult = await this.retriever.retrieveContextForQuery(task, {
      limit: 50,
      includeSymbols: options.includeSymbols !== false,
      includeTests: options.includeTests !== false,
      includeDocuments: true,
      minConfidence: options.minConfidence || 0.5,
    });

    // Add repositories (highest priority)
    for (const repo of searchResult.repositories) {
      const repoTokens = this.estimateTokens(JSON.stringify(repo));
      if (tokensUsed + repoTokens <= budget) {
        packet.repositories.push(repo);
        packet.sources.push({
          source: `repository:${repo.name}`,
          type: "OBSERVED",
          reason: "Directly mentioned in task",
        });
        tokensUsed += repoTokens;
      }
    }

    // Add capabilities (high priority)
    for (const capability of searchResult.capabilities) {
      const capTokens = this.estimateTokens(
        capability.name + (capability.description || "")
      );
      if (tokensUsed + capTokens <= budget * 0.85) {
        packet.capabilities.push(capability);
        packet.sources.push({
          source: `capability:${capability.name}`,
          type: capability.source,
          reason: "Related to task context",
        });
        tokensUsed += capTokens;
      }
    }

    // Add relevant files
    for (const file of searchResult.files.slice(0, 10)) {
      const fileTokens = this.estimateTokens(file.path);
      if (tokensUsed + fileTokens <= budget * 0.75) {
        packet.files.push(file);
        packet.sources.push({
          source: file.path,
          type: "OBSERVED",
          reason: `File relevant to task "${task}"`,
        });
        tokensUsed += fileTokens;
      }
    }

    // Add symbols (if enabled and space available)
    if (options.includeSymbols !== false) {
      for (const symbol of searchResult.symbols.slice(0, 5)) {
        const symbolTokens = this.estimateTokens(
          symbol.name + (symbol.signature || "")
        );
        if (tokensUsed + symbolTokens <= budget * 0.7) {
          packet.symbols.push(symbol);
          packet.sources.push({
            source: `symbol:${symbol.name}`,
            type: "OBSERVED",
            reason: `Symbol definition relevant to "${task}"`,
          });
          tokensUsed += symbolTokens;
        }
      }
    }

    // Add decisions (if enabled and space available)
    if (options.includeDecisions !== false) {
      for (const decision of searchResult.decisions.slice(0, 3)) {
        const decisionTokens = this.estimateTokens(
          decision.title + (decision.decision || "")
        );
        if (tokensUsed + decisionTokens <= budget * 0.85) {
          packet.decisions.push(decision);
          packet.sources.push({
            source: `decision:${decision.title}`,
            type: decision.source,
            reason: `Architectural decision relevant to "${task}"`,
          });
          tokensUsed += decisionTokens;
        }
      }
    }

    // Add tests (if enabled and space available)
    if (options.includeTests !== false) {
      for (const test of searchResult.tests.slice(0, 5)) {
        const testTokens = this.estimateTokens(test.name);
        if (tokensUsed + testTokens <= budget * 0.8) {
          packet.tests.push(test);
          packet.sources.push({
            source: `test:${test.name}`,
            type: "OBSERVED",
            reason: `Test relevant to "${task}"`,
          });
          tokensUsed += testTokens;
        }
      }
    }

    return {
      packet,
      tokensUsed,
      tokensAvailable: budget,
    };
  }

  /**
   * Create context packet with explicit limits
   */
  async buildContextPacket(
    task: string,
    repositoryId?: string,
    options: PlanningOptions = {}
  ): Promise<ContextPacket> {
    const result = await this.planContextForTask(task, options);
    return result.packet;
  }
}
