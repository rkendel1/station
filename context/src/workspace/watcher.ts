/**
 * PR7: Filesystem watcher - watches for file changes in repositories
 */

import fs from "fs";
import path from "path";
import { EventEmitter } from "events";
import type { FileChange, ChangeType } from "../types/index.js";
import { classifyChange, createFileChange } from "./change-classifier.js";

/**
 * Default ignore patterns
 */
const DEFAULT_IGNORE_PATTERNS = [
  ".git",
  "node_modules",
  "target",
  "dist",
  "build",
  "coverage",
  ".cache",
  ".tmp",
  ".env",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  ".tox",
  "venv",
  ".venv",
  "env",
  ".next",
  ".nuxt",
  ".output",
  ".vercel",
  ".turbo",
  "*.log",
  "*.lock",
];

/**
 * Watcher options
 */
export interface WatcherOptions {
  debounceMs?: number;
  ignorePatterns?: string[];
  respectGitignore?: boolean;
  maxDepth?: number;
  persistent?: boolean;
}

const DEFAULT_OPTIONS: WatcherOptions = {
  debounceMs: 300,
  ignorePatterns: DEFAULT_IGNORE_PATTERNS,
  respectGitignore: true,
  maxDepth: 10,
  persistent: true,
};

/**
 * File change batch (debounced changes)
 */
export interface FileChangeBatch {
  changes: FileChange[];
  timestamp: Date;
}

/**
 * Workspace watcher - watches a directory for file changes
 */
export class WorkspaceWatcher extends EventEmitter {
  private watchPath: string;
  private options: Required<WatcherOptions>;
  private watcher: fs.FSWatcher | null = null;
  private pendingChanges: Map<string, FileChange> = new Map();
  private debounceTimer: NodeJS.Timeout | null = null;
  private gitignorePatterns: RegExp[] = [];
  private isWatching = false;

  constructor(watchPath: string, options: WatcherOptions = {}) {
    super();
    this.watchPath = path.resolve(watchPath);
    this.options = { ...DEFAULT_OPTIONS, ...options } as Required<WatcherOptions>;

    if (this.options.respectGitignore) {
      this.loadGitignore();
    }
  }

  /**
   * Load .gitignore patterns
   */
  private loadGitignore(): void {
    const gitignorePath = path.join(this.watchPath, ".gitignore");
    if (fs.existsSync(gitignorePath)) {
      try {
        const content = fs.readFileSync(gitignorePath, "utf-8");
        const lines = content.split("\n").filter((line) => {
          const trimmed = line.trim();
          return trimmed.length > 0 && !trimmed.startsWith("#");
        });

        this.gitignorePatterns = lines.map((pattern) => {
          // Convert gitignore patterns to regex
          const escaped = pattern
            .replace(/[.+^${}()|[\]\\]/g, "\\$&")
            .replace(/\*/g, ".*")
            .replace(/\?/g, ".");
          return new RegExp(escaped);
        });
      } catch {
        // Ignore errors reading .gitignore
      }
    }
  }

  /**
   * Check if a path should be ignored
   */
  private shouldIgnore(filePath: string): boolean {
    const relativePath = path.relative(this.watchPath, filePath);
    const parts = relativePath.split(path.sep);

    // Check default ignore patterns
    for (const pattern of this.options.ignorePatterns) {
      if (pattern.startsWith("*")) {
        // Glob pattern like *.log
        const ext = pattern.slice(1);
        if (filePath.endsWith(ext)) {
          return true;
        }
      } else {
        // Exact directory/file match
        if (parts.includes(pattern)) {
          return true;
        }
      }
    }

    // Check gitignore patterns
    for (const pattern of this.gitignorePatterns) {
      if (pattern.test(relativePath)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Handle a file system event
   */
  private handleEvent(eventType: string, filename: string | null): void {
    if (!filename) return;

    const fullPath = path.join(this.watchPath, filename);

    // Check if should be ignored
    if (this.shouldIgnore(fullPath)) {
      return;
    }

    // Determine change type
    let changeType: "add" | "change" | "unlink";
    if (!fs.existsSync(fullPath)) {
      changeType = "unlink";
    } else if (eventType === "rename") {
      // Check if it's a new file or deleted
      changeType = fs.existsSync(fullPath) ? "add" : "unlink";
    } else {
      changeType = "change";
    }

    // Create file change
    const fileChange = createFileChange(filename, changeType);

    // Add to pending changes (overwrites previous for same file)
    this.pendingChanges.set(filename, fileChange);

    // Reset debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.flushChanges();
    }, this.options.debounceMs);
  }

  /**
   * Flush pending changes as a batch
   */
  private flushChanges(): void {
    if (this.pendingChanges.size === 0) {
      return;
    }

    const changes = Array.from(this.pendingChanges.values());
    this.pendingChanges.clear();

    const batch: FileChangeBatch = {
      changes,
      timestamp: new Date(),
    };

    this.emit("changes", batch);

    // Emit individual events by change type
    for (const change of changes) {
      this.emit(change.type, change);
      this.emit(`change:${change.changeType.toLowerCase()}`, change);
    }
  }

  /**
   * Start watching
   */
  start(): void {
    if (this.isWatching) {
      return;
    }

    if (!fs.existsSync(this.watchPath)) {
      throw new Error(`Watch path does not exist: ${this.watchPath}`);
    }

    try {
      this.watcher = fs.watch(
        this.watchPath,
        {
          recursive: true,
          persistent: this.options.persistent,
        },
        (eventType, filename) => {
          this.handleEvent(eventType, filename);
        }
      );

      this.watcher.on("error", (error) => {
        this.emit("error", error);
      });

      this.isWatching = true;
      this.emit("started");
    } catch (error) {
      throw new Error(
        `Failed to start watcher: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Stop watching
   */
  stop(): void {
    if (!this.isWatching) {
      return;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Flush any remaining changes
    this.flushChanges();

    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    this.isWatching = false;
    this.emit("stopped");
  }

  /**
   * Check if currently watching
   */
  get watching(): boolean {
    return this.isWatching;
  }

  /**
   * Get the watch path
   */
  get path(): string {
    return this.watchPath;
  }

  /**
   * Update debounce time
   */
  setDebounceMs(ms: number): void {
    this.options.debounceMs = ms;
  }

  /**
   * Add ignore patterns
   */
  addIgnorePatterns(patterns: string[]): void {
    this.options.ignorePatterns.push(...patterns);
  }
}

/**
 * Create a watcher for a repository path
 */
export function createWatcher(
  repoPath: string,
  options?: WatcherOptions
): WorkspaceWatcher {
  return new WorkspaceWatcher(repoPath, options);
}

/**
 * Watch multiple repositories
 */
export class MultiRepositoryWatcher extends EventEmitter {
  private watchers: Map<string, WorkspaceWatcher> = new Map();
  private options: WatcherOptions;

  constructor(options: WatcherOptions = {}) {
    super();
    this.options = options;
  }

  /**
   * Add a repository to watch
   */
  addRepository(repoPath: string, repoId?: string): void {
    const id = repoId || repoPath;
    if (this.watchers.has(id)) {
      return;
    }

    const watcher = new WorkspaceWatcher(repoPath, this.options);

    watcher.on("changes", (batch: FileChangeBatch) => {
      this.emit("changes", { repositoryId: id, ...batch });
    });

    watcher.on("error", (error: Error) => {
      this.emit("error", { repositoryId: id, error });
    });

    this.watchers.set(id, watcher);
    watcher.start();
  }

  /**
   * Remove a repository from watching
   */
  removeRepository(repoId: string): void {
    const watcher = this.watchers.get(repoId);
    if (watcher) {
      watcher.stop();
      this.watchers.delete(repoId);
    }
  }

  /**
   * Start all watchers
   */
  startAll(): void {
    for (const watcher of this.watchers.values()) {
      if (!watcher.watching) {
        watcher.start();
      }
    }
  }

  /**
   * Stop all watchers
   */
  stopAll(): void {
    for (const watcher of this.watchers.values()) {
      watcher.stop();
    }
  }

  /**
   * Get watched repository IDs
   */
  getWatchedRepositories(): string[] {
    return Array.from(this.watchers.keys());
  }

  /**
   * Check if a repository is being watched
   */
  isWatching(repoId: string): boolean {
    const watcher = this.watchers.get(repoId);
    return watcher?.watching ?? false;
  }
}
