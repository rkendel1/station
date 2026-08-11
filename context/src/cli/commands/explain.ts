/**
 * Context explain command - Explain context selection for a task
 */

import { Command } from "commander";
import chalk from "chalk";

export const explainCommand = new Command()
  .command("context:explain <task>")
  .alias("context explain")
  .description("Explain what context would be selected for a task")
  .action(async (task: string) => {
    try {
      console.log(chalk.blue(`Explaining context for task: ${task}`));
      console.log(chalk.yellow("○ This feature is coming soon"));
    } catch (error) {
      console.error(
        chalk.red(
          `✗ Failed to explain: ${error instanceof Error ? error.message : String(error)}`
        )
      );
      process.exit(1);
    }
  });
