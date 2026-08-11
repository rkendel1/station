/**
 * PR7: Workspace CLI commands
 */

import { Command } from "commander";
import chalk from "chalk";
import path from "path";
import { getDatabase } from "../../db/client.js";
import { createWorkspaceManager } from "../../workspace/workspace-manager.js";
import { getGitState, getChangedFilesSinceCommit } from "../../workspace/git-tracker.js";
import { classifyChange, groupChangesByType, createFileChange } from "../../workspace/change-classifier.js";
import type { FileChange } from "../../types/index.js";

/**
 * Workspace init command
 */
export const workspaceInitCommand = new Command()
  .command("workspace:init [path]")
  .alias("workspace init")
  .description("Initialize a new workspace")
  .option("-n, --name <name>", "Workspace name")
  .action(async (
    workspacePath?: string,
    options?: { name?: string }
  ) => {
    try {
      const db = await getDatabase();
      const manager = createWorkspaceManager(db, { autoWatch: false });

      const targetPath = workspacePath || process.cwd();
      const resolvedPath = path.resolve(targetPath);

      console.log(chalk.blue(`Initializing workspace at ${resolvedPath}...`));

      const workspaceId = await manager.initWorkspace(resolvedPath, options?.name);

      console.log(chalk.green("✓ Workspace initialized"));
      console.log(chalk.gray(`  ID: ${workspaceId}`));
      console.log(chalk.gray(`  Path: ${resolvedPath}`));
      console.log("");
      console.log(chalk.gray("Next: Run 'dev workspace add <path>' to add repositories"));

      await db.close();
    } catch (error) {
      console.error(
        chalk.red(
          `✗ Failed to initialize workspace: ${error instanceof Error ? error.message : String(error)}`
        )
      );
      process.exit(1);
    }
  });

/**
 * Workspace add command
 */
export const workspaceAddCommand = new Command()
  .command("workspace:add <path>")
  .alias("workspace add")
  .description("Add a repository to the workspace")
  .option("-w, --workspace <id>", "Workspace ID (uses current workspace if not specified)")
  .action(async (
    repoPath: string,
    options?: { workspace?: string }
  ) => {
    try {
      const db = await getDatabase();
      const manager = createWorkspaceManager(db, { autoWatch: false });

      const resolvedPath = path.resolve(repoPath);

      // Get workspace ID
      let workspaceId = options?.workspace;
      if (!workspaceId) {
        // Find workspace containing current directory
        const workspaces = await db.query<{ id: string; path: string }>(
          "SELECT id, path FROM workspaces ORDER BY created_at DESC LIMIT 1"
        );
        if (workspaces.length === 0) {
          console.log(chalk.yellow("No workspace found. Initialize one first:"));
          console.log(chalk.gray("  dev workspace init"));
          await db.close();
          return;
        }
        workspaceId = workspaces[0].id;
      }

      console.log(chalk.blue(`Adding repository ${resolvedPath}...`));

      const registration = await manager.addRepository(workspaceId, resolvedPath);

      console.log(chalk.green("✓ Repository added"));
      console.log(chalk.gray(`  ID: ${registration.repositoryId}`));
      console.log(chalk.gray(`  Path: ${registration.absolutePath}`));
      console.log(chalk.gray(`  Remote: ${registration.remoteUrl || "none"}`));
      console.log(chalk.gray(`  Branch: ${registration.currentBranch}`));
      console.log(chalk.gray(`  Commit: ${registration.commitSha.slice(0, 8)}`));
      if (registration.language) {
        console.log(chalk.gray(`  Language: ${registration.language}`));
      }
      if (registration.packageManager) {
        console.log(chalk.gray(`  Package Manager: ${registration.packageManager}`));
      }

      await db.close();
    } catch (error) {
      console.error(
        chalk.red(
          `✗ Failed to add repository: ${error instanceof Error ? error.message : String(error)}`
        )
      );
      process.exit(1);
    }
  });

/**
 * Workspace remove command
 */
export const workspaceRemoveCommand = new Command()
  .command("workspace:remove <repository-id>")
  .alias("workspace remove")
  .description("Remove a repository from the workspace")
  .option("-w, --workspace <id>", "Workspace ID")
  .action(async (
    repositoryId: string,
    options?: { workspace?: string }
  ) => {
    try {
      const db = await getDatabase();
      const manager = createWorkspaceManager(db, { autoWatch: false });

      // Get workspace ID
      let workspaceId = options?.workspace;
      if (!workspaceId) {
        const workspaces = await db.query<{ id: string }>(
          "SELECT id FROM workspaces ORDER BY created_at DESC LIMIT 1"
        );
        if (workspaces.length === 0) {
          console.log(chalk.yellow("No workspace found."));
          await db.close();
          return;
        }
        workspaceId = workspaces[0].id;
      }

      console.log(chalk.blue(`Removing repository ${repositoryId}...`));

      await manager.removeRepository(workspaceId, repositoryId);

      console.log(chalk.green("✓ Repository removed"));

      await db.close();
    } catch (error) {
      console.error(
        chalk.red(
          `✗ Failed to remove repository: ${error instanceof Error ? error.message : String(error)}`
        )
      );
      process.exit(1);
    }
  });

/**
 * Workspace list command
 */
export const workspaceListCommand = new Command()
  .command("workspace:list")
  .alias("workspace list")
  .description("List all workspaces and their repositories")
  .action(async () => {
    try {
      const db = await getDatabase();
      const manager = createWorkspaceManager(db, { autoWatch: false });

      const workspaces = await db.query<{ id: string; name: string; path: string }>(
        "SELECT id, name, path FROM workspaces ORDER BY created_at DESC"
      );

      if (workspaces.length === 0) {
        console.log(chalk.yellow("No workspaces found."));
        console.log(chalk.gray("Run 'dev workspace init' to create one."));
        await db.close();
        return;
      }

      console.log(chalk.bold("Workspaces\n"));

      for (const workspace of workspaces) {
        console.log(chalk.blue(`${workspace.name}`));
        console.log(chalk.gray(`  ID: ${workspace.id}`));
        console.log(chalk.gray(`  Path: ${workspace.path}`));

        const repos = await manager.listRepositories(workspace.id);
        if (repos.length > 0) {
          console.log(chalk.gray(`  Repositories:`));
          for (const repo of repos) {
            const status = repo.active ? chalk.green("●") : chalk.yellow("○");
            console.log(chalk.gray(`    ${status} ${repo.relativePath || repo.absolutePath}`));
            console.log(chalk.gray(`      Branch: ${repo.currentBranch} @ ${repo.commitSha.slice(0, 8)}`));
          }
        } else {
          console.log(chalk.gray(`  Repositories: none`));
        }
        console.log("");
      }

      await db.close();
    } catch (error) {
      console.error(
        chalk.red(
          `✗ Failed to list workspaces: ${error instanceof Error ? error.message : String(error)}`
        )
      );
      process.exit(1);
    }
  });

/**
 * Workspace status command
 */
export const workspaceStatusCommand = new Command()
  .command("workspace:status")
  .alias("workspace status")
  .description("Show workspace status")
  .option("-w, --workspace <id>", "Workspace ID")
  .action(async (options?: { workspace?: string }) => {
    try {
      const db = await getDatabase();
      const manager = createWorkspaceManager(db, { autoWatch: false });

      // Get workspace ID
      let workspaceId = options?.workspace;
      if (!workspaceId) {
        const workspaces = await db.query<{ id: string }>(
          "SELECT id FROM workspaces ORDER BY created_at DESC LIMIT 1"
        );
        if (workspaces.length === 0) {
          console.log(chalk.yellow("No workspace found."));
          await db.close();
          return;
        }
        workspaceId = workspaces[0].id;
      }

      const status = await manager.getWorkspaceStatus(workspaceId);
      if (!status) {
        console.log(chalk.yellow("Workspace not found."));
        await db.close();
        return;
      }

      console.log(chalk.bold(`Workspace: ${status.name}\n`));
      console.log(`Path: ${status.path}`);
      
      const watchIcon = status.watchStatus === "active"
        ? chalk.green("● LIVE")
        : status.watchStatus === "paused"
          ? chalk.yellow("○ PAUSED")
          : chalk.gray("○ STOPPED");
      console.log(`Watch Status: ${watchIcon}`);
      
      console.log(`Repositories: ${status.repositoryCount}`);
      console.log(`Files: ${status.fileCount.toLocaleString()}`);
      console.log(`Symbols: ${status.symbolCount.toLocaleString()}`);
      console.log(`Index Queue: ${status.indexQueue}`);
      
      if (status.lastUpdate) {
        const ago = Date.now() - status.lastUpdate.getTime();
        const agoStr = ago < 1000 ? "just now" :
          ago < 60000 ? `${Math.floor(ago / 1000)} seconds ago` :
          ago < 3600000 ? `${Math.floor(ago / 60000)} minutes ago` :
          `${Math.floor(ago / 3600000)} hours ago`;
        console.log(`Last Update: ${agoStr}`);
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
 * Workspace git-status command
 */
export const workspaceGitStatusCommand = new Command()
  .command("workspace:git-status")
  .alias("workspace git-status")
  .description("Show git status for all repositories")
  .option("-w, --workspace <id>", "Workspace ID")
  .action(async (options?: { workspace?: string }) => {
    try {
      const db = await getDatabase();
      const manager = createWorkspaceManager(db, { autoWatch: false });

      // Get workspace ID
      let workspaceId = options?.workspace;
      if (!workspaceId) {
        const workspaces = await db.query<{ id: string }>(
          "SELECT id FROM workspaces ORDER BY created_at DESC LIMIT 1"
        );
        if (workspaces.length === 0) {
          console.log(chalk.yellow("No workspace found."));
          await db.close();
          return;
        }
        workspaceId = workspaces[0].id;
      }

      const repos = await manager.listRepositories(workspaceId);
      
      if (repos.length === 0) {
        console.log(chalk.yellow("No repositories in workspace."));
        await db.close();
        return;
      }

      console.log(chalk.bold("Git Status\n"));

      for (const repo of repos) {
        const gitState = await getGitState(repo.absolutePath);
        
        console.log(chalk.blue(path.basename(repo.absolutePath)));
        
        if (!gitState) {
          console.log(chalk.gray("  Not a git repository"));
          continue;
        }

        console.log(chalk.gray(`  Branch: ${gitState.branch}`));
        console.log(chalk.gray(`  HEAD: ${gitState.commitSha.slice(0, 8)}`));
        
        if (gitState.isDirty) {
          const modified = gitState.changedFiles.length - gitState.untrackedFiles.length;
          console.log(chalk.yellow(`  Changes:`));
          if (gitState.stagedFiles.length > 0) {
            console.log(chalk.green(`    ${gitState.stagedFiles.length} staged`));
          }
          if (modified > 0) {
            console.log(chalk.yellow(`    ${modified} modified`));
          }
          if (gitState.untrackedFiles.length > 0) {
            console.log(chalk.gray(`    ${gitState.untrackedFiles.length} untracked`));
          }
        } else {
          console.log(chalk.green(`  Clean`));
        }
        
        console.log("");
      }

      await db.close();
    } catch (error) {
      console.error(
        chalk.red(
          `✗ Failed to get git status: ${error instanceof Error ? error.message : String(error)}`
        )
      );
      process.exit(1);
    }
  });

/**
 * Export all workspace commands
 */
export const workspaceCommands = [
  workspaceInitCommand,
  workspaceAddCommand,
  workspaceRemoveCommand,
  workspaceListCommand,
  workspaceStatusCommand,
  workspaceGitStatusCommand,
];
