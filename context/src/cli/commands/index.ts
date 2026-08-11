/**
 * Context index command - Index repositories
 */

import { Command } from "commander";
import chalk from "chalk";
import { getDatabase, closeDatabase } from "../../db/client.js";
import { RepositoryIndexer } from "../../indexer/service.js";
import { findRepositories } from "../../indexer/repository.js";
import path from "path";

export const indexCommand = new Command()
  .command("context:index [path]")
  .alias("context index")
  .description("Index repositories and update the context database")
  .option("-f, --force", "Force full re-indexing")
  .option("-w, --watch", "Watch for changes and re-index")
  .option("--symbols", "Include symbol extraction", true)
  .option("--tests", "Include test discovery", true)
  .action(async (
    searchPath?: string,
    options?: { force?: boolean; watch?: boolean; symbols?: boolean; tests?: boolean }
  ) => {
    try {
      const db = await getDatabase();
      const indexer = new RepositoryIndexer(db);

      const targetPath = searchPath || process.cwd();
      const resolvedPath = path.resolve(targetPath);

      console.log(
        chalk.blue(`Discovering repositories in ${resolvedPath}...`)
      );

      // Find repositories
      const repos = await findRepositories(resolvedPath, 2);

      if (repos.length === 0) {
        console.log(chalk.yellow("○ No git repositories found"));
        await db.close();
        return;
      }

      console.log(chalk.green(`Found ${repos.length} repository(ies)`));
      console.log("");

      // Index each repository
      for (const repo of repos) {
        console.log(chalk.blue(`Indexing ${repo.name} at ${repo.path}...`));

        const result = await indexer.indexRepository(repo.path, {
          force: options?.force,
          includeSymbols: options?.symbols !== false,
          includeTests: options?.tests !== false,
        });

        console.log(
          chalk.green(`✓ Indexed ${result.indexed} items in ${repo.name}`)
        );
      }

      console.log("");
      console.log(chalk.green("✓ Indexing complete"));

      // Show summary
      const allRepos = await indexer.getRepositories();
      console.log(chalk.gray(`Total repositories indexed: ${allRepos.length}`));

      await db.close();
    } catch (error) {
      console.error(
        chalk.red(
          `✗ Failed to index: ${error instanceof Error ? error.message : String(error)}`
        )
      );
      process.exit(1);
    }
  });
