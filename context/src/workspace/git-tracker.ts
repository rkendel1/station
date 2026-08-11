/**
 * PR7: Git state tracker - tracks git repository state
 */

import { execFile, execFileSync } from "child_process";
import { promisify } from "util";
import type { GitState } from "../types/index.js";

const execFileAsync = promisify(execFile);

/**
 * Options for git state tracking
 */
export interface GitStateOptions {
  maxChangedFiles?: number;
  timeout?: number;
}

const DEFAULT_OPTIONS: GitStateOptions = {
  maxChangedFiles: 1000,
  timeout: 10000,
};

/**
 * Validate that a string is a safe git ref (commit SHA, branch name, or HEAD~N)
 * Prevents shell injection by only allowing safe characters
 */
function isValidGitRef(ref: string): boolean {
  // Allow: alphanumeric, /, -, _, ., ~, ^, @
  // Disallow: shell metacharacters like ;, |, &, $, `, etc.
  return /^[a-zA-Z0-9/_.\-~^@]+$/.test(ref);
}

/**
 * Execute a git command and return the output (safe version using execFile)
 */
async function gitCommand(
  cwd: string,
  args: string[],
  options: GitStateOptions = {}
): Promise<string> {
  const timeout = options.timeout ?? DEFAULT_OPTIONS.timeout;
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd,
      timeout,
      encoding: "utf-8",
    });
    return stdout.trim();
  } catch {
    return "";
  }
}

/**
 * Execute a git command synchronously (safe version using execFileSync)
 */
function gitCommandSync(cwd: string, args: string[]): string {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
  } catch {
    return "";
  }
}

/**
 * Get the current git state of a repository
 */
export async function getGitState(
  repoPath: string,
  options: GitStateOptions = {}
): Promise<GitState | null> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Check if this is a git repository
  const isGitRepo = gitCommandSync(repoPath, ["rev-parse", "--is-inside-work-tree"]);
  if (isGitRepo !== "true") {
    return null;
  }

  // Get HEAD
  const head = await gitCommand(repoPath, ["rev-parse", "HEAD"], opts);
  if (!head) {
    // Empty repository
    return {
      head: "",
      branch: await gitCommand(repoPath, ["branch", "--show-current"], opts) || "main",
      remote: await gitCommand(repoPath, ["config", "--get", "remote.origin.url"], opts) || undefined,
      commitSha: "",
      isDirty: false,
      changedFiles: [],
      stagedFiles: [],
      unstagedFiles: [],
      untrackedFiles: [],
    };
  }

  // Get current branch
  const branch = await gitCommand(repoPath, ["branch", "--show-current"], opts);

  // Get remote URL
  const remote = await gitCommand(repoPath, ["config", "--get", "remote.origin.url"], opts);

  // Get dirty state
  const statusOutput = await gitCommand(repoPath, ["status", "--porcelain"], opts);
  const isDirty = statusOutput.length > 0;

  // Parse status output
  const statusLines = statusOutput.split("\n").filter((line) => line.length > 0);

  const stagedFiles: string[] = [];
  const unstagedFiles: string[] = [];
  const untrackedFiles: string[] = [];
  const changedFiles: string[] = [];

  for (const line of statusLines.slice(0, opts.maxChangedFiles)) {
    if (line.length < 4) continue;

    const indexStatus = line[0];
    const workTreeStatus = line[1];
    const filePath = line.slice(3).trim();

    // Handle renamed files (format: "R  old -> new")
    const actualPath = filePath.includes(" -> ")
      ? filePath.split(" -> ")[1]
      : filePath;

    changedFiles.push(actualPath);

    // Staged changes (index status is not space or ?)
    if (indexStatus !== " " && indexStatus !== "?") {
      stagedFiles.push(actualPath);
    }

    // Unstaged changes (worktree status is not space)
    if (workTreeStatus !== " " && workTreeStatus !== "?") {
      unstagedFiles.push(actualPath);
    }

    // Untracked files
    if (indexStatus === "?" && workTreeStatus === "?") {
      untrackedFiles.push(actualPath);
    }
  }

  return {
    head,
    branch: branch || "HEAD",
    remote: remote || undefined,
    commitSha: head,
    isDirty,
    changedFiles,
    stagedFiles,
    unstagedFiles,
    untrackedFiles,
  };
}

/**
 * Get the current commit SHA
 */
export async function getCurrentCommit(repoPath: string): Promise<string | null> {
  const sha = await gitCommand(repoPath, ["rev-parse", "HEAD"]);
  return sha || null;
}

/**
 * Get the current branch name
 */
export async function getCurrentBranch(repoPath: string): Promise<string | null> {
  const branch = await gitCommand(repoPath, ["branch", "--show-current"]);
  return branch || null;
}

/**
 * Check if the repository is dirty (has uncommitted changes)
 */
export async function isDirty(repoPath: string): Promise<boolean> {
  const status = await gitCommand(repoPath, ["status", "--porcelain"]);
  return status.length > 0;
}

/**
 * Get the diff between two commits
 */
export async function getDiff(
  repoPath: string,
  fromCommit: string,
  toCommit: string = "HEAD"
): Promise<string[]> {
  // Validate git refs to prevent command injection
  if (!isValidGitRef(fromCommit) || !isValidGitRef(toCommit)) {
    return [];
  }
  
  const diff = await gitCommand(
    repoPath,
    ["diff", "--name-only", fromCommit, toCommit]
  );
  return diff.split("\n").filter((line) => line.length > 0);
}

/**
 * Get files changed since a specific commit
 */
export async function getChangedFilesSinceCommit(
  repoPath: string,
  sinceCommit: string
): Promise<string[]> {
  // Validate git ref to prevent command injection
  if (!isValidGitRef(sinceCommit)) {
    return [];
  }
  
  const diff = await gitCommand(
    repoPath,
    ["diff", "--name-only", sinceCommit, "HEAD"]
  );
  const committed = diff.split("\n").filter((line) => line.length > 0);

  // Also get uncommitted changes
  const status = await gitCommand(repoPath, ["status", "--porcelain"]);
  const uncommitted = status
    .split("\n")
    .filter((line) => line.length >= 3)
    .map((line) => {
      const filePath = line.slice(3).trim();
      return filePath.includes(" -> ") ? filePath.split(" -> ")[1] : filePath;
    });

  // Combine and dedupe
  return [...new Set([...committed, ...uncommitted])];
}

/**
 * Get the remote URL for the repository
 */
export async function getRemoteUrl(repoPath: string): Promise<string | null> {
  const remote = await gitCommand(repoPath, ["config", "--get", "remote.origin.url"]);
  return remote || null;
}

/**
 * Get the default branch name
 */
export async function getDefaultBranch(repoPath: string): Promise<string> {
  // Try to get from remote HEAD
  const remoteHead = await gitCommand(
    repoPath,
    ["symbolic-ref", "refs/remotes/origin/HEAD"]
  );
  if (remoteHead) {
    const match = remoteHead.match(/refs\/remotes\/origin\/(.+)/);
    if (match) {
      return match[1];
    }
  }

  // Fall back to common defaults
  const branches = await gitCommand(repoPath, ["branch", "-a"]);
  if (branches.includes("main")) {
    return "main";
  }
  if (branches.includes("master")) {
    return "master";
  }

  return "main";
}

/**
 * Compare two git states and return what changed
 */
export function compareGitStates(
  oldState: GitState | null,
  newState: GitState
): {
  branchChanged: boolean;
  commitChanged: boolean;
  filesChanged: string[];
  newlyDirty: boolean;
} {
  if (!oldState) {
    return {
      branchChanged: true,
      commitChanged: true,
      filesChanged: newState.changedFiles,
      newlyDirty: newState.isDirty,
    };
  }

  const branchChanged = oldState.branch !== newState.branch;
  const commitChanged = oldState.commitSha !== newState.commitSha;

  // Find files that changed between states
  const oldSet = new Set(oldState.changedFiles);
  const newSet = new Set(newState.changedFiles);
  const filesChanged: string[] = [];

  for (const file of newSet) {
    if (!oldSet.has(file)) {
      filesChanged.push(file);
    }
  }

  const newlyDirty = !oldState.isDirty && newState.isDirty;

  return {
    branchChanged,
    commitChanged,
    filesChanged,
    newlyDirty,
  };
}

/**
 * Generate a stable repository ID from git remote URL
 */
export function generateStableRepoId(remoteUrl: string | undefined, localPath: string): string {
  if (remoteUrl) {
    // Normalize the remote URL to create a stable ID
    // Remove protocol, .git suffix, and normalize slashes
    const normalized = remoteUrl
      .replace(/^(https?:\/\/|git@|ssh:\/\/)/, "")
      .replace(/\.git$/, "")
      .replace(/:/g, "/")
      .toLowerCase();
    
    // Create a simple hash-like string
    return `repo:${normalized}`;
  }

  // Fall back to local path-based ID
  return `local:${localPath.replace(/[/\\]/g, ":")}`;
}
