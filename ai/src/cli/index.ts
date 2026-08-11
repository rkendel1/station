#!/usr/bin/env node

/**
 * AI Control Plane CLI
 */

import { Command } from "commander";
import chalk from "chalk";
import { getContextStore, closeContextStore } from "@station/context";
import { ControlPlane, defaultProviderRegistry, ModelProvider, ModelProviderType, TaskComplexity } from "../index.js";

const program = new Command();

// Mock model provider for demonstration
const mockProvider: ModelProvider = {
  async health() {
    return { healthy: true, message: "Mock provider is healthy" };
  },

  async models() {
    return [
      {
        id: "qwen-coder-30b",
        name: "Qwen3-Coder-30B",
        provider: ModelProviderType.QWEN_CODER,
        costPer1kTokens: 0.001,
        maxContextLength: 32768,
        capabilities: ["code-generation", "testing", "bug-fixing"],
        available: true,
        recommendedForComplexity: [TaskComplexity.SIMPLE, TaskComplexity.MODERATE],
      },
    ];
  },

  async completions(request) {
    return {
      model: request.model,
      content: "Mock response: " + request.messages[request.messages.length - 1].content,
      inputTokens: 100,
      outputTokens: 50,
      finishReason: "stop",
    };
  },

  async getCostPer1kTokens(modelId: string) {
    return 0.001;
  },

  async isModelAvailable(modelId: string) {
    return true;
  },
};

defaultProviderRegistry.register("mock", mockProvider);

program
  .name("codex-ai")
  .description("AI Execution Control Plane for Personal Cloud Development")
  .version("0.1.0");

program
  .command("execute <task>")
  .description("Execute a coding task through the AI control plane")
  .option("-r, --retries <number>", "Maximum retries", "3")
  .action(async (task, options) => {
    try {
      const contextStore = await getContextStore();
      const plane = new ControlPlane(contextStore, mockProvider, defaultProviderRegistry);

      console.log(chalk.blue("🚀 Starting task execution..."));
      console.log(chalk.gray(`Task: ${task}`));
      console.log("");

      const result = await plane.execute(task, parseInt(options.retries));

      console.log(chalk.green("✅ Task completed"));
      console.log(chalk.gray(`Model: ${result.model.name}`));
      console.log(chalk.gray(`Tokens: ${result.tokensUsed.total}`));
      console.log(chalk.gray(`Cost: $${result.cost.toFixed(4)}`));
      console.log(chalk.gray(`Validation: ${result.validationPassed ? "PASSED" : "FAILED"}`));
      console.log("");
      console.log(chalk.yellow("Output:"));
      console.log(result.output);

      const stats = plane.getStats();
      console.log("");
      console.log(chalk.blue("📊 Statistics:"));
      console.log(chalk.gray(`Total Cost: $${stats.costTracking.totalCost.toFixed(4)}`));
      console.log(chalk.gray(`Average Cost: $${stats.costTracking.averageCostPerTask.toFixed(4)}`));

      await closeContextStore();
    } catch (error) {
      console.error(chalk.red("❌ Error:"), error);
      process.exit(1);
    }
  });

program
  .command("status")
  .description("Check the status of the AI control plane")
  .action(async () => {
    try {
      const health = await mockProvider.health();
      const models = await mockProvider.models();

      console.log(chalk.blue("🔍 AI Control Plane Status"));
      console.log("");
      console.log(chalk.gray(`Provider Health: ${health.healthy ? chalk.green("✅") : chalk.red("❌")}`));
      console.log(chalk.gray(`Available Models: ${models.length}`));

      models.forEach((model) => {
        console.log(chalk.gray(`  - ${model.name}: $${model.costPer1kTokens}/1k tokens`));
      });

      await closeContextStore();
    } catch (error) {
      console.error(chalk.red("❌ Error:"), error);
      process.exit(1);
    }
  });

program.parse(process.argv);
