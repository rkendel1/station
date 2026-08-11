/**
 * Context explain command - Explain context selection for a task
 */

import { Command } from "commander";
import chalk from "chalk";
import { getDatabase, closeDatabase } from "../../db/client.js";
import { ContextPlanner } from "../../retrieval/planner.js";

export const explainCommand = new Command()
  .command("context:explain <task>")
  .alias("context explain")
  .description("Explain what context would be selected for a task")
  .option("-b, --budget <budget>", "Token budget (default 8000)", "8000")
  .action(async (task: string, options?: { budget?: string }) => {
    try {
      const db = await getDatabase();
      const planner = new ContextPlanner(db);

      const budget = parseInt(options?.budget || "8000", 10);

      console.log(chalk.bold("Context Plan for Task:"));
      console.log(chalk.cyan(`"${task}"`));
      console.log("");
      console.log(chalk.gray(`Token budget: ${budget}`));
      console.log("");

      const result = await planner.planContextForTask(task, {
        budget,
        includeSymbols: true,
        includeTests: true,
        includeDecisions: true,
      });

      const packet = result.packet;

      if (packet.repositories.length > 0) {
        console.log(chalk.bold("Repositories:"));
        for (const repo of packet.repositories) {
          console.log(`  • ${chalk.cyan(repo.name)}`);
        }
        console.log("");
      }

      if (packet.capabilities.length > 0) {
        console.log(chalk.bold("Capabilities:"));
        for (const cap of packet.capabilities) {
          console.log(`  • ${chalk.cyan(cap.name)}`);
          if (cap.description) {
            console.log(`    ${chalk.gray(cap.description)}`);
          }
        }
        console.log("");
      }

      if (packet.files.length > 0) {
        console.log(chalk.bold("Relevant Files:"));
        for (const file of packet.files.slice(0, 5)) {
          console.log(`  • ${chalk.cyan(file.path)}`);
        }
        if (packet.files.length > 5) {
          console.log(`  ... and ${packet.files.length - 5} more`);
        }
        console.log("");
      }

      if (packet.symbols.length > 0) {
        console.log(chalk.bold("Symbols:"));
        for (const symbol of packet.symbols.slice(0, 5)) {
          console.log(`  • ${chalk.cyan(symbol.name)} (${symbol.kind})`);
        }
        if (packet.symbols.length > 5) {
          console.log(`  ... and ${packet.symbols.length - 5} more`);
        }
        console.log("");
      }

      if (packet.decisions.length > 0) {
        console.log(chalk.bold("Architectural Decisions:"));
        for (const decision of packet.decisions) {
          console.log(`  • ${chalk.cyan(decision.title)}`);
        }
        console.log("");
      }

      if (packet.tests.length > 0) {
        console.log(chalk.bold("Tests:"));
        for (const test of packet.tests.slice(0, 5)) {
          console.log(`  • ${chalk.cyan(test.name)}`);
        }
        if (packet.tests.length > 5) {
          console.log(`  ... and ${packet.tests.length - 5} more`);
        }
        console.log("");
      }

      console.log(chalk.bold("Context Usage:"));
      console.log(
        `  ${chalk.green(result.tokensUsed)} / ${result.tokensAvailable} tokens used`
      );
      const usage = ((result.tokensUsed / result.tokensAvailable) * 100).toFixed(1);
      console.log(`  ${usage}% of budget`);
      console.log("");

      console.log(chalk.gray("Sources:"));
      const uniqueSources = Array.from(
        new Set(packet.sources.map((s) => s.source))
      ).slice(0, 5);
      for (const source of uniqueSources) {
        console.log(`  • ${source}`);
      }
      if (packet.sources.length > 5) {
        console.log(`  ... and ${packet.sources.length - 5} more`);
      }

      await db.close();
    } catch (error) {
      console.error(
        chalk.red(
          `✗ Failed to explain: ${error instanceof Error ? error.message : String(error)}`
        )
      );
      process.exit(1);
    }
  });
