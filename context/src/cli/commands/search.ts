/**
 * Context search command - Search for symbols, files, etc.
 */

import { Command } from "commander";
import chalk from "chalk";
import { getDatabase, closeDatabase } from "../../db/client.js";
import { ContextRetriever } from "../../retrieval/searcher.js";

export const searchCommand = new Command()
  .command("context:search <query>")
  .alias("context search")
  .description("Search for symbols, files, and repositories")
  .option("-t, --type <type>", "Search type: symbols, files, repositories", "all")
  .action(async (query: string, options?: { type?: string }) => {
    try {
      const db = await getDatabase();
      const retriever = new ContextRetriever(db);

      console.log(chalk.blue(`Searching for: "${query}"`));
      console.log("");

      const type = options?.type?.toLowerCase() || "all";

      if (type === "all" || type === "repositories") {
        const repos = await retriever.searchRepositories(query, 5);
        if (repos.length > 0) {
          console.log(chalk.bold("Repositories:"));
          for (const repo of repos) {
            console.log(`  • ${chalk.cyan(repo.name)} (${repo.language || "unknown"})`);
            if (repo.remote_url) {
              console.log(`    ${chalk.gray(repo.remote_url)}`);
            }
          }
          console.log("");
        }
      }

      if (type === "all" || type === "files") {
        const files = await retriever.searchFiles(query, 10);
        if (files.length > 0) {
          console.log(chalk.bold("Files:"));
          for (const file of files) {
            console.log(`  • ${chalk.cyan(file.path)}`);
            if (file.language) {
              console.log(`    ${chalk.gray(`Language: ${file.language}`)}`);
            }
          }
          console.log("");
        }
      }

      if (type === "all" || type === "symbols") {
        const symbols = await retriever.searchSymbols(query, 10);
        if (symbols.length > 0) {
          console.log(chalk.bold("Symbols:"));
          for (const symbol of symbols) {
            const kind = chalk.yellow(symbol.kind);
            console.log(`  • ${symbol.name} (${kind})`);
            if (symbol.signature) {
              console.log(`    ${chalk.gray(symbol.signature)}`);
            }
          }
          console.log("");
        }
      }

      if (
        (type === "all" || type === "symbols" || type === "files" || type === "repositories") &&
        !((type === "repositories" &&
          (await retriever.searchRepositories(query, 1)).length > 0) ||
          (type === "files" &&
            (await retriever.searchFiles(query, 1)).length > 0) ||
          (type === "symbols" &&
            (await retriever.searchSymbols(query, 1)).length > 0))
      ) {
        console.log(chalk.yellow("○ No results found"));
      }

      await db.close();
    } catch (error) {
      console.error(
        chalk.red(
          `✗ Search failed: ${error instanceof Error ? error.message : String(error)}`
        )
      );
      process.exit(1);
    }
  });
