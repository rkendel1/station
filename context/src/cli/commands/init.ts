/**
 * Context init command - Initialize the database
 */

import { Command } from "commander";
import chalk from "chalk";
import { getDatabase, closeDatabase, getDBPath } from "../../db/client.js";

export const initCommand = new Command()
  .command("context:init")
  .alias("context init")
  .description("Initialize the engineering context database")
  .action(async () => {
    try {
      console.log(
        chalk.blue("Initializing engineering context database...")
      );

      const dbPath = getDBPath();
      console.log(chalk.gray(`Database location: ${dbPath}`));

      const db = await getDatabase();
      await db.close();

      console.log(
        chalk.green("✓ Database initialized successfully")
      );
      console.log(
        chalk.gray(
          "Run 'dev context index' to start indexing your repositories"
        )
      );
    } catch (error) {
      console.error(
        chalk.red(
          `✗ Failed to initialize database: ${error instanceof Error ? error.message : String(error)}`
        )
      );
      process.exit(1);
    }
  });
