/**
 * Context status command - Show database and indexing status
 */

import { Command } from "commander";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import { getDBPath } from "../../db/client.js";

export const statusCommand = new Command()
  .command("context:status")
  .alias("context status")
  .description("Show engineering context database status")
  .action(async () => {
    try {
      const dbPath = getDBPath();
      const exists = fs.existsSync(dbPath);

      console.log(chalk.bold("Engineering Context Status\n"));
      console.log(`Database location: ${dbPath}`);
      console.log(
        `Status: ${exists ? chalk.green("✓ Initialized") : chalk.yellow("○ Not initialized")}`
      );

      if (exists) {
        const stats = fs.statSync(dbPath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`Size: ${sizeMB} MB`);
        console.log(
          `Last modified: ${stats.mtime.toLocaleString()}`
        );
      } else {
        console.log(
          chalk.gray(
            "\nRun 'dev context init' to initialize the database"
          )
        );
      }

      console.log(
        chalk.gray(
          "\nNext: Run 'dev context index' to start indexing repositories"
        )
      );
    } catch (error) {
      console.error(
        chalk.red(
          `✗ Failed to get status: ${error instanceof Error ? error.message : String(error)}`
        )
      );
      process.exit(1);
    }
  });
