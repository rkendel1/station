/**
 * PR7: Enhanced context CLI commands
 */

import { Command } from "commander";
import chalk from "chalk";
import path from "path";
import { getDatabase } from "../../db/client.js";
import { createWorkspaceManager } from "../../workspace/workspace-manager.js";
import { getGitState, getChangedFilesSinceCommit, getDiff } from "../../workspace/git-tracker.js";
import { classifyChange, groupChangesByType, createFileChange } from "../../workspace/change-classifier.js";
import { createEngineeringGraph } from "../../workspace/engineering-graph.js";
import { createFreshnessTracker } from "../../workspace/freshness-tracker.js";
import { createSnapshotManager } from "../../workspace/snapshot-manager.js";
import type { FileChange } from "../../types/index.js";

/**
 * Enhanced context status command
 */
export const contextStatusEnhancedCommand = new Command()
  .command("context:live-status")
  .alias("context live-status")
  .description("Show live context status with freshness information")
  .option("-r, --repository <id>", "Repository ID")
  .action(async (options?: { repository?: string }) => {
    try {
      const db = await getDatabase();
      const freshnessTracker = createFreshnessTracker(db);
      const graph = createEngineeringGraph(db);

      // Get freshness statistics
      const freshnessStats = await freshnessTracker.getStatistics();
      const graphStats = await graph.getStatistics();

      console.log(chalk.bold("Context Status\n"));

      // Freshness overview
      const currentIcon = freshnessStats.CURRENT > 0 ? chalk.green("●") : chalk.gray("○");
      const staleIcon = freshnessStats.STALE > 0 ? chalk.yellow("●") : chalk.gray("○");
      const invalidIcon = freshnessStats.INVALID > 0 ? chalk.red("●") : chalk.gray("○");

      console.log("Freshness:");
      console.log(`  ${currentIcon} Current: ${freshnessStats.CURRENT}`);
      console.log(`  ${staleIcon} Stale: ${freshnessStats.STALE}`);
      console.log(`  ${invalidIcon} Invalid: ${freshnessStats.INVALID}`);
      console.log("");

      // Graph statistics
      console.log("Engineering Graph:");
      console.log(`  Repositories: ${graphStats.nodesByType.repository ?? 0}`);
      console.log(`  Files: ${graphStats.nodesByType.file ?? 0}`);
      console.log(`  Symbols: ${graphStats.nodesByType.symbol ?? 0}`);
      console.log(`  Capabilities: ${graphStats.nodesByType.capability ?? 0}`);
      console.log(`  Tests: ${graphStats.nodesByType.test ?? 0}`);
      console.log(`  Relationships: ${graphStats.relationshipCount}`);
      console.log("");

      // If repository specified, show detailed status
      if (options?.repository) {
        const repo = await db.query<{ local_path: string; name: string }>(
          "SELECT local_path, name FROM repositories WHERE id = ?",
          [options.repository]
        );

        if (repo.length > 0) {
          const gitState = await getGitState(repo[0].local_path);

          console.log(chalk.bold(`Repository: ${repo[0].name}\n`));

          if (gitState) {
            console.log(`Branch: ${gitState.branch}`);
            console.log(`HEAD: ${gitState.commitSha}`);
            console.log(`State: ${gitState.isDirty ? chalk.yellow("DIRTY") : chalk.green("CLEAN")}`);

            if (gitState.isDirty) {
              console.log(`Uncommitted files: ${gitState.changedFiles.length}`);
            }
          }
        }
      }

      await db.close();
    } catch (error) {
      console.error(
        chalk.red(
          `✗ Failed to get status: ${error instanceof Error ? error.message : String(error)}`
        )
      );
      process.exit(1);
    }
  });

/**
 * Context diff command
 */
export const contextDiffCommand = new Command()
  .command("context:diff")
  .alias("context diff")
  .description("Show context diff for working tree changes")
  .option("-r, --repository <id>", "Repository ID")
  .action(async (options?: { repository?: string }) => {
    try {
      const db = await getDatabase();
      const graph = createEngineeringGraph(db);

      // Get repository
      let repoId = options?.repository;
      let repoPath: string;

      if (!repoId) {
        const repos = await db.query<{ id: string; local_path: string }>(
          "SELECT id, local_path FROM repositories ORDER BY updated_at DESC LIMIT 1"
        );
        if (repos.length === 0) {
          console.log(chalk.yellow("No repositories indexed."));
          await db.close();
          return;
        }
        repoId = repos[0].id;
        repoPath = repos[0].local_path;
      } else {
        const repo = await db.query<{ local_path: string }>(
          "SELECT local_path FROM repositories WHERE id = ?",
          [repoId]
        );
        if (repo.length === 0) {
          console.log(chalk.yellow("Repository not found."));
          await db.close();
          return;
        }
        repoPath = repo[0].local_path;
      }

      // Get git state
      const gitState = await getGitState(repoPath);
      if (!gitState) {
        console.log(chalk.yellow("Not a git repository."));
        await db.close();
        return;
      }

      if (!gitState.isDirty) {
        console.log(chalk.green("No uncommitted changes."));
        await db.close();
        return;
      }

      console.log(chalk.bold("Context Diff\n"));

      // Classify changes
      const changes = gitState.changedFiles.map((f) => createFileChange(f, "change"));
      const grouped = groupChangesByType(changes);

      // Show changes by category
      for (const [changeType, files] of Object.entries(grouped)) {
        if (files.length > 0) {
          console.log(chalk.blue(`${changeType}:`));
          for (const file of files) {
            console.log(chalk.gray(`  ${file.path}`));
          }
          console.log("");
        }
      }

      // Assess impact
      const impact = await graph.assessImpact(repoId, gitState.changedFiles);

      console.log(chalk.bold("Impact Assessment:"));
      console.log(`  Symbols affected: ${impact.symbolCount}`);
      console.log(`  Tests affected: ${impact.testCount}`);
      console.log(`  Capabilities affected: ${impact.capabilityCount}`);
      console.log(`  Modules affected: ${impact.moduleCount}`);
      console.log(`  Complexity: ${impact.workingTreeComplexity}`);

      await db.close();
    } catch (error) {
      console.error(
        chalk.red(
          `✗ Failed to get diff: ${error instanceof Error ? error.message : String(error)}`
        )
      );
      process.exit(1);
    }
  });

/**
 * Context compare command
 */
export const contextCompareCommand = new Command()
  .command("context:compare <from> <to>")
  .alias("context compare")
  .description("Compare context between two commits")
  .option("-r, --repository <id>", "Repository ID")
  .action(async (
    fromCommit: string,
    toCommit: string,
    options?: { repository?: string }
  ) => {
    try {
      const db = await getDatabase();
      const snapshotManager = createSnapshotManager(db);

      // Get repository
      let repoId = options?.repository;

      if (!repoId) {
        const repos = await db.query<{ id: string }>(
          "SELECT id FROM repositories ORDER BY updated_at DESC LIMIT 1"
        );
        if (repos.length === 0) {
          console.log(chalk.yellow("No repositories indexed."));
          await db.close();
          return;
        }
        repoId = repos[0].id;
      }

      console.log(chalk.bold(`Comparing ${fromCommit}...${toCommit}\n`));

      const diff = await snapshotManager.compareSnapshots(repoId, fromCommit, toCommit);

      if (diff.addedSymbols.length > 0) {
        console.log(chalk.green(`Added symbols: ${diff.addedSymbols.length}`));
      }
      if (diff.removedSymbols.length > 0) {
        console.log(chalk.red(`Removed symbols: ${diff.removedSymbols.length}`));
      }
      if (diff.changedSymbols.length > 0) {
        console.log(chalk.yellow(`Changed symbols: ${diff.changedSymbols.length}`));
      }

      if (diff.addedFiles.length > 0) {
        console.log(chalk.green(`Added files: ${diff.addedFiles.length}`));
      }
      if (diff.removedFiles.length > 0) {
        console.log(chalk.red(`Removed files: ${diff.removedFiles.length}`));
      }

      if (diff.addedCapabilities.length > 0) {
        console.log(chalk.green(`Added capabilities: ${diff.addedCapabilities.length}`));
      }
      if (diff.removedCapabilities.length > 0) {
        console.log(chalk.red(`Removed capabilities: ${diff.removedCapabilities.length}`));
      }

      await db.close();
    } catch (error) {
      console.error(
        chalk.red(
          `✗ Failed to compare: ${error instanceof Error ? error.message : String(error)}`
        )
      );
      process.exit(1);
    }
  });

/**
 * Export all enhanced context commands
 */
export const enhancedContextCommands = [
  contextStatusEnhancedCommand,
  contextDiffCommand,
  contextCompareCommand,
];
