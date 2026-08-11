/**
 * PR7: Workspace manager - manages workspaces and repositories
 */

import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type {
  WorkspaceState,
  WorkspaceRepository,
  GitState,
  FileChange,
} from "../types/index.js";
import type { Database } from "../db/client.js";
import { getGitState, getRemoteUrl, getDefaultBranch, generateStableRepoId } from "./git-tracker.js";
import { WorkspaceWatcher, FileChangeBatch, WatcherOptions } from "./watcher.js";
import { IncrementalIndexer } from "./incremental-indexer.js";
import { ContextEventEmitter, getGlobalEventEmitter } from "./events.js";

/**
 * Workspace manager options
 */
export interface WorkspaceManagerOptions {
  eventEmitter?: ContextEventEmitter;
  watcherOptions?: WatcherOptions;
  autoWatch?: boolean;
}

const DEFAULT_OPTIONS: WorkspaceManagerOptions = {
  autoWatch: true,
  watcherOptions: {
    debounceMs: 300,
    respectGitignore: true,
  },
};

/**
 * Repository registration result
 */
export interface RepositoryRegistration {
  repositoryId: string;
  absolutePath: string;
  remoteUrl?: string;
  defaultBranch: string;
  currentBranch: string;
  commitSha: string;
  language?: string;
  packageManager?: string;
}

/**
 * Workspace status
 */
export interface WorkspaceStatus {
  id: string;
  name: string;
  path: string;
  watchStatus: "active" | "paused" | "stopped";
  repositoryCount: number;
  fileCount: number;
  symbolCount: number;
  lastUpdate: Date | null;
  indexQueue: number;
}

/**
 * Workspace manager - manages workspaces, repositories, and live context
 */
export class WorkspaceManager {
  private db: Database;
  private options: Required<WorkspaceManagerOptions>;
  private eventEmitter: ContextEventEmitter;
  private watchers: Map<string, WorkspaceWatcher> = new Map();
  private indexers: Map<string, IncrementalIndexer> = new Map();
  private activeWorkspaceId: string | null = null;

  constructor(db: Database, options: WorkspaceManagerOptions = {}) {
    this.db = db;
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      eventEmitter: options.eventEmitter ?? getGlobalEventEmitter(),
    } as Required<WorkspaceManagerOptions>;
    this.eventEmitter = this.options.eventEmitter;
  }

  /**
   * Initialize a new workspace
   */
  async initWorkspace(workspacePath: string, name?: string): Promise<string> {
    const absolutePath = path.resolve(workspacePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Workspace path does not exist: ${absolutePath}`);
    }

    // Check if workspace already exists
    const existing = await this.db.query<{ id: string }>(
      "SELECT id FROM workspaces WHERE path = ?",
      [absolutePath]
    );

    if (existing.length > 0) {
      return existing[0].id;
    }

    const id = randomUUID();
    const workspaceName = name || path.basename(absolutePath);
    const now = new Date();

    await this.db.run(
      `INSERT INTO workspaces (id, name, path, watch_status, created_at, updated_at)
       VALUES (?, ?, ?, 'stopped', ?, ?)`,
      [id, workspaceName, absolutePath, now, now]
    );

    this.activeWorkspaceId = id;
    return id;
  }

  /**
   * Add a repository to the workspace
   */
  async addRepository(
    workspaceId: string,
    repoPath: string
  ): Promise<RepositoryRegistration> {
    const absolutePath = path.resolve(repoPath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Repository path does not exist: ${absolutePath}`);
    }

    // Get git state
    const gitState = await getGitState(absolutePath);
    if (!gitState) {
      throw new Error(`Not a git repository: ${absolutePath}`);
    }

    // Get workspace path
    const workspace = await this.db.query<{ path: string }>(
      "SELECT path FROM workspaces WHERE id = ?",
      [workspaceId]
    );

    if (workspace.length === 0) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    const workspacePath = workspace[0].path;
    const relativePath = path.relative(workspacePath, absolutePath);

    // Generate stable repository ID
    const remoteUrl = gitState.remote;
    const repositoryId = generateStableRepoId(remoteUrl, absolutePath);

    // Get additional info
    const defaultBranch = await getDefaultBranch(absolutePath);
    const language = this.detectLanguage(absolutePath);
    const packageManager = this.detectPackageManager(absolutePath);

    const now = new Date();

    // Check if repository already exists
    const existingRepo = await this.db.query<{ id: string }>(
      "SELECT id FROM repositories WHERE id = ? OR local_path = ?",
      [repositoryId, absolutePath]
    );

    let actualRepoId = repositoryId;
    if (existingRepo.length > 0) {
      actualRepoId = existingRepo[0].id;
      // Update existing repository
      await this.db.run(
        `UPDATE repositories SET
           remote_url = ?, local_path = ?, default_branch = ?,
           language = ?, package_manager = ?, updated_at = ?
         WHERE id = ?`,
        [remoteUrl, absolutePath, defaultBranch, language, packageManager, now, actualRepoId]
      );
    } else {
      // Create new repository
      const repoName = path.basename(absolutePath);
      await this.db.run(
        `INSERT INTO repositories (id, name, full_name, remote_url, local_path, default_branch, language, package_manager, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
        [
          actualRepoId,
          repoName,
          remoteUrl || repoName,
          remoteUrl,
          absolutePath,
          defaultBranch,
          language,
          packageManager,
          now,
          now,
        ]
      );
    }

    // Check if workspace_repository association exists
    const existingAssoc = await this.db.query<{ workspace_id: string }>(
      "SELECT workspace_id FROM workspace_repositories WHERE workspace_id = ? AND repository_id = ?",
      [workspaceId, actualRepoId]
    );

    if (existingAssoc.length === 0) {
      // Create workspace-repository association
      await this.db.run(
        `INSERT INTO workspace_repositories
           (workspace_id, repository_id, relative_path, git_remote, default_branch, current_branch, commit_sha, watch_status, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'stopped', true)`,
        [
          workspaceId,
          actualRepoId,
          relativePath,
          remoteUrl,
          defaultBranch,
          gitState.branch,
          gitState.commitSha,
        ]
      );
    } else {
      // Update existing association
      await this.db.run(
        `UPDATE workspace_repositories SET
           relative_path = ?, git_remote = ?, default_branch = ?,
           current_branch = ?, commit_sha = ?, active = true
         WHERE workspace_id = ? AND repository_id = ?`,
        [
          relativePath,
          remoteUrl,
          defaultBranch,
          gitState.branch,
          gitState.commitSha,
          workspaceId,
          actualRepoId,
        ]
      );
    }

    // Start watching if auto-watch is enabled
    if (this.options.autoWatch) {
      await this.startWatching(actualRepoId, absolutePath);
    }

    return {
      repositoryId: actualRepoId,
      absolutePath,
      remoteUrl,
      defaultBranch,
      currentBranch: gitState.branch,
      commitSha: gitState.commitSha,
      language,
      packageManager,
    };
  }

  /**
   * Remove a repository from the workspace
   */
  async removeRepository(workspaceId: string, repositoryId: string): Promise<void> {
    // Stop watching
    this.stopWatching(repositoryId);

    // Remove association
    await this.db.run(
      "DELETE FROM workspace_repositories WHERE workspace_id = ? AND repository_id = ?",
      [workspaceId, repositoryId]
    );
  }

  /**
   * List repositories in a workspace
   */
  async listRepositories(workspaceId: string): Promise<WorkspaceRepository[]> {
    const rows = await this.db.query<{
      repository_id: string;
      relative_path: string;
      git_remote: string | null;
      default_branch: string;
      current_branch: string | null;
      commit_sha: string | null;
      last_indexed_commit: string | null;
      watch_status: string;
      active: number;
      local_path: string;
      language: string | null;
      package_manager: string | null;
      framework: string | null;
    }>(
      `SELECT wr.repository_id, wr.relative_path, wr.git_remote, wr.default_branch,
              wr.current_branch, wr.commit_sha, wr.last_indexed_commit, wr.watch_status, wr.active,
              r.local_path, r.language, r.package_manager, r.framework
       FROM workspace_repositories wr
       JOIN repositories r ON wr.repository_id = r.id
       WHERE wr.workspace_id = ?`,
      [workspaceId]
    );

    return rows.map((row) => ({
      id: randomUUID(),
      repositoryId: row.repository_id,
      absolutePath: row.local_path,
      relativePath: row.relative_path,
      gitRemote: row.git_remote ?? undefined,
      defaultBranch: row.default_branch,
      currentBranch: row.current_branch ?? row.default_branch,
      commitSha: row.commit_sha ?? "",
      lastIndexedCommit: row.last_indexed_commit ?? undefined,
      watchStatus: row.watch_status as "active" | "paused" | "stopped",
      language: row.language ?? undefined,
      packageManager: row.package_manager ?? undefined,
      framework: row.framework ?? undefined,
      active: Boolean(row.active),
    }));
  }

  /**
   * Get workspace status
   */
  async getWorkspaceStatus(workspaceId: string): Promise<WorkspaceStatus | null> {
    const workspace = await this.db.query<{
      id: string;
      name: string;
      path: string;
      watch_status: string;
      last_update: string | null;
      index_queue: number | null;
    }>("SELECT * FROM workspaces WHERE id = ?", [workspaceId]);

    if (workspace.length === 0) {
      return null;
    }

    const ws = workspace[0];

    // Get counts
    const repoCount = await this.db.query<{ count: number }>(
      "SELECT COUNT(*) as count FROM workspace_repositories WHERE workspace_id = ?",
      [workspaceId]
    );

    const repos = await this.db.query<{ repository_id: string }>(
      "SELECT repository_id FROM workspace_repositories WHERE workspace_id = ?",
      [workspaceId]
    );

    let fileCount = 0;
    let symbolCount = 0;

    if (repos.length > 0) {
      const repoIds = repos.map((r) => r.repository_id);
      const fileCounts = await this.db.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM files WHERE repository_id IN (${repoIds.map(() => "?").join(",")})`,
        repoIds
      );
      fileCount = fileCounts[0]?.count ?? 0;

      const symbolCounts = await this.db.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM symbols WHERE file_id IN (
          SELECT id FROM files WHERE repository_id IN (${repoIds.map(() => "?").join(",")})
        )`,
        repoIds
      );
      symbolCount = symbolCounts[0]?.count ?? 0;
    }

    // Calculate total queue size
    let totalQueue = ws.index_queue ?? 0;
    for (const indexer of this.indexers.values()) {
      totalQueue += indexer.queueSize;
    }

    return {
      id: ws.id,
      name: ws.name,
      path: ws.path,
      watchStatus: ws.watch_status as "active" | "paused" | "stopped",
      repositoryCount: repoCount[0]?.count ?? 0,
      fileCount,
      symbolCount,
      lastUpdate: ws.last_update ? new Date(ws.last_update) : null,
      indexQueue: totalQueue,
    };
  }

  /**
   * Start watching a repository
   */
  async startWatching(repositoryId: string, repoPath?: string): Promise<void> {
    if (this.watchers.has(repositoryId)) {
      return;
    }

    // Get repository path if not provided
    let absolutePath = repoPath;
    if (!absolutePath) {
      const repo = await this.db.query<{ local_path: string }>(
        "SELECT local_path FROM repositories WHERE id = ?",
        [repositoryId]
      );
      if (repo.length === 0) {
        throw new Error(`Repository not found: ${repositoryId}`);
      }
      absolutePath = repo[0].local_path;
    }

    // Create watcher
    const watcher = new WorkspaceWatcher(absolutePath, this.options.watcherOptions);

    // Create indexer
    const indexer = new IncrementalIndexer(this.db, {
      eventEmitter: this.eventEmitter,
    });

    // Handle changes
    watcher.on("changes", async (batch: FileChangeBatch) => {
      indexer.queueChanges(batch.changes);
      await indexer.processQueue(repositoryId);

      // Update last update time
      await this.db.run(
        "UPDATE workspaces SET last_update = ?, updated_at = ? WHERE id IN (SELECT workspace_id FROM workspace_repositories WHERE repository_id = ?)",
        [new Date(), new Date(), repositoryId]
      );
    });

    // Store references
    this.watchers.set(repositoryId, watcher);
    this.indexers.set(repositoryId, indexer);

    // Start watching
    watcher.start();

    // Update watch status
    await this.db.run(
      "UPDATE workspace_repositories SET watch_status = 'active' WHERE repository_id = ?",
      [repositoryId]
    );
  }

  /**
   * Stop watching a repository
   */
  stopWatching(repositoryId: string): void {
    const watcher = this.watchers.get(repositoryId);
    if (watcher) {
      watcher.stop();
      this.watchers.delete(repositoryId);
    }

    this.indexers.delete(repositoryId);
  }

  /**
   * Get git status for all repositories in a workspace
   */
  async getGitStatus(workspaceId: string): Promise<Map<string, GitState | null>> {
    const repos = await this.listRepositories(workspaceId);
    const results = new Map<string, GitState | null>();

    for (const repo of repos) {
      const gitState = await getGitState(repo.absolutePath);
      results.set(repo.repositoryId, gitState);

      // Update stored state
      if (gitState) {
        await this.db.run(
          `UPDATE workspace_repositories SET
             current_branch = ?, commit_sha = ?
           WHERE repository_id = ?`,
          [gitState.branch, gitState.commitSha, repo.repositoryId]
        );
      }
    }

    return results;
  }

  /**
   * Detect primary language from repository
   */
  private detectLanguage(repoPath: string): string | undefined {
    const extensions: Record<string, string> = {
      ".ts": "typescript",
      ".tsx": "typescript",
      ".js": "javascript",
      ".jsx": "javascript",
      ".py": "python",
      ".rs": "rust",
      ".go": "go",
      ".java": "java",
      ".cs": "csharp",
      ".cpp": "cpp",
      ".c": "c",
    };

    try {
      const files = fs.readdirSync(repoPath, { recursive: true });
      const fileList = Array.isArray(files) ? files : [files];

      for (const file of fileList) {
        if (typeof file === "string") {
          const ext = path.extname(file);
          if (extensions[ext]) {
            return extensions[ext];
          }
        }
      }
    } catch {
      // Ignore errors
    }

    return undefined;
  }

  /**
   * Detect package manager from repository
   */
  private detectPackageManager(repoPath: string): string | undefined {
    const packageFiles: Record<string, string> = {
      "package.json": "npm",
      "Cargo.toml": "cargo",
      "requirements.txt": "pip",
      "pyproject.toml": "python",
      "go.mod": "go",
      "pom.xml": "maven",
    };

    for (const [file, manager] of Object.entries(packageFiles)) {
      if (fs.existsSync(path.join(repoPath, file))) {
        return manager;
      }
    }

    return undefined;
  }

  /**
   * Clean up resources
   */
  async close(): Promise<void> {
    for (const [repoId] of this.watchers) {
      this.stopWatching(repoId);
    }
  }
}

/**
 * Create a workspace manager
 */
export function createWorkspaceManager(
  db: Database,
  options?: WorkspaceManagerOptions
): WorkspaceManager {
  return new WorkspaceManager(db, options);
}
