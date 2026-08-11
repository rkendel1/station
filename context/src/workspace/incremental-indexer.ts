/**
 * PR7: Incremental indexer - updates context incrementally on file changes
 */

import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type {
  FileChange,
  ContextEventType,
  FreshnessStatus,
  ChangeType,
} from "../types/index.js";
import type { Database } from "../db/client.js";
import { classifyChange, isDependencyFile } from "./change-classifier.js";
import {
  ContextEventEmitter,
  ContextEvents,
  getGlobalEventEmitter,
} from "./events.js";

/**
 * Indexer options
 */
export interface IncrementalIndexerOptions {
  eventEmitter?: ContextEventEmitter;
  batchSize?: number;
  useTransactions?: boolean;
}

const DEFAULT_OPTIONS: IncrementalIndexerOptions = {
  batchSize: 50,
  useTransactions: true,
};

/**
 * Index result
 */
export interface IndexResult {
  filesProcessed: number;
  symbolsUpdated: number;
  relationshipsUpdated: number;
  capabilitiesUpdated: number;
  errors: string[];
  duration: number;
}

/**
 * Incremental indexer - updates context based on file changes
 */
export class IncrementalIndexer {
  private db: Database;
  private options: Required<IncrementalIndexerOptions>;
  private eventEmitter: ContextEventEmitter;
  private indexQueue: FileChange[] = [];
  private isProcessing = false;

  constructor(db: Database, options: IncrementalIndexerOptions = {}) {
    this.db = db;
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      eventEmitter: options.eventEmitter ?? getGlobalEventEmitter(),
    } as Required<IncrementalIndexerOptions>;
    this.eventEmitter = this.options.eventEmitter;
  }

  /**
   * Queue file changes for processing
   */
  queueChanges(changes: FileChange[]): void {
    this.indexQueue.push(...changes);
  }

  /**
   * Process queued changes
   */
  async processQueue(repositoryId: string): Promise<IndexResult> {
    if (this.isProcessing || this.indexQueue.length === 0) {
      return {
        filesProcessed: 0,
        symbolsUpdated: 0,
        relationshipsUpdated: 0,
        capabilitiesUpdated: 0,
        errors: [],
        duration: 0,
      };
    }

    this.isProcessing = true;
    const startTime = Date.now();
    const result: IndexResult = {
      filesProcessed: 0,
      symbolsUpdated: 0,
      relationshipsUpdated: 0,
      capabilitiesUpdated: 0,
      errors: [],
      duration: 0,
    };

    try {
      // Process in batches
      while (this.indexQueue.length > 0) {
        const batch = this.indexQueue.splice(0, this.options.batchSize);
        const batchResult = await this.processBatch(repositoryId, batch);

        result.filesProcessed += batchResult.filesProcessed;
        result.symbolsUpdated += batchResult.symbolsUpdated;
        result.relationshipsUpdated += batchResult.relationshipsUpdated;
        result.capabilitiesUpdated += batchResult.capabilitiesUpdated;
        result.errors.push(...batchResult.errors);
      }

      result.duration = Date.now() - startTime;

      // Emit completion event
      await this.eventEmitter.emit(
        "INDEX_COMPLETED",
        ContextEvents.indexCompleted(repositoryId, {
          files: result.filesProcessed,
          symbols: result.symbolsUpdated,
          duration: result.duration,
        })
      );
    } finally {
      this.isProcessing = false;
    }

    return result;
  }

  /**
   * Process a batch of file changes
   */
  private async processBatch(
    repositoryId: string,
    changes: FileChange[]
  ): Promise<IndexResult> {
    const result: IndexResult = {
      filesProcessed: 0,
      symbolsUpdated: 0,
      relationshipsUpdated: 0,
      capabilitiesUpdated: 0,
      errors: [],
      duration: 0,
    };

    for (const change of changes) {
      try {
        const changeResult = await this.processFileChange(repositoryId, change);
        result.filesProcessed++;
        result.symbolsUpdated += changeResult.symbolsUpdated;
        result.relationshipsUpdated += changeResult.relationshipsUpdated;
        result.capabilitiesUpdated += changeResult.capabilitiesUpdated;
      } catch (error) {
        result.errors.push(
          `Error processing ${change.path}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return result;
  }

  /**
   * Process a single file change
   */
  private async processFileChange(
    repositoryId: string,
    change: FileChange
  ): Promise<{
    symbolsUpdated: number;
    relationshipsUpdated: number;
    capabilitiesUpdated: number;
  }> {
    const result = {
      symbolsUpdated: 0,
      relationshipsUpdated: 0,
      capabilitiesUpdated: 0,
    };

    switch (change.type) {
      case "add":
        await this.handleFileAdded(repositoryId, change);
        await this.eventEmitter.emit(
          "FILE_ADDED",
          ContextEvents.fileAdded(
            repositoryId,
            change.path,
            change.changeType
          )
        );
        break;

      case "change":
        const changeStats = await this.handleFileChanged(repositoryId, change);
        result.symbolsUpdated = changeStats.symbolsUpdated;
        result.relationshipsUpdated = changeStats.relationshipsUpdated;
        result.capabilitiesUpdated = changeStats.capabilitiesUpdated;
        await this.eventEmitter.emit(
          "FILE_CHANGED",
          ContextEvents.fileChanged(
            repositoryId,
            change.path,
            change.changeType
          )
        );
        break;

      case "unlink":
        const deleteStats = await this.handleFileDeleted(repositoryId, change);
        result.symbolsUpdated = deleteStats.symbolsDeleted;
        result.relationshipsUpdated = deleteStats.relationshipsDeleted;
        await this.eventEmitter.emit(
          "FILE_DELETED",
          ContextEvents.fileDeleted(repositoryId, change.path)
        );
        break;
    }

    // Handle dependency changes specially
    if (isDependencyFile(change.path)) {
      await this.handleDependencyChange(repositoryId, change);
      await this.eventEmitter.emit(
        "DEPENDENCY_CHANGED",
        ContextEvents.dependencyChanged(repositoryId, change.path)
      );
    }

    return result;
  }

  /**
   * Handle file added
   */
  private async handleFileAdded(
    repositoryId: string,
    change: FileChange
  ): Promise<void> {
    const fileId = randomUUID();
    const now = new Date();

    // Insert file record
    await this.db.run(
      `INSERT INTO files (id, repository_id, path, change_type, indexed_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(repository_id, path) DO UPDATE SET
         change_type = excluded.change_type,
         indexed_at = excluded.indexed_at`,
      [fileId, repositoryId, change.path, change.changeType, now]
    );

    // Set freshness
    await this.setFreshness(
      "file",
      change.path,
      repositoryId,
      "CURRENT"
    );
  }

  /**
   * Handle file changed
   */
  private async handleFileChanged(
    repositoryId: string,
    change: FileChange
  ): Promise<{
    symbolsUpdated: number;
    relationshipsUpdated: number;
    capabilitiesUpdated: number;
  }> {
    const result = {
      symbolsUpdated: 0,
      relationshipsUpdated: 0,
      capabilitiesUpdated: 0,
    };

    // Get existing file record
    const existingFile = await this.db.query<{ id: string }>(
      "SELECT id FROM files WHERE repository_id = ? AND path = ?",
      [repositoryId, change.path]
    );

    if (existingFile.length === 0) {
      // File not in index, treat as add
      await this.handleFileAdded(repositoryId, change);
      return result;
    }

    const fileId = existingFile[0].id;

    // Update file record
    await this.db.run(
      `UPDATE files SET change_type = ?, indexed_at = ? WHERE id = ?`,
      [change.changeType, new Date(), fileId]
    );

    // If source file, remove and re-index symbols
    if (change.changeType === "SOURCE" || change.changeType === "TEST") {
      // Delete existing symbols for this file
      const deleteResult = await this.db.run(
        "DELETE FROM symbols WHERE file_id = ?",
        [fileId]
      );
      result.symbolsUpdated = deleteResult.changes ?? 0;

      // Delete relationships involving these symbols
      const relResult = await this.db.run(
        `DELETE FROM relationships WHERE
         (source_type = 'symbol' AND source_id IN (SELECT id FROM symbols WHERE file_id = ?))
         OR (target_type = 'symbol' AND target_id IN (SELECT id FROM symbols WHERE file_id = ?))`,
        [fileId, fileId]
      );
      result.relationshipsUpdated = relResult.changes ?? 0;
    }

    // Mark freshness as current
    await this.setFreshness(
      "file",
      change.path,
      repositoryId,
      "CURRENT"
    );

    return result;
  }

  /**
   * Handle file deleted
   */
  private async handleFileDeleted(
    repositoryId: string,
    change: FileChange
  ): Promise<{
    symbolsDeleted: number;
    relationshipsDeleted: number;
  }> {
    const result = {
      symbolsDeleted: 0,
      relationshipsDeleted: 0,
    };

    // Get file ID
    const existingFile = await this.db.query<{ id: string }>(
      "SELECT id FROM files WHERE repository_id = ? AND path = ?",
      [repositoryId, change.path]
    );

    if (existingFile.length === 0) {
      return result;
    }

    const fileId = existingFile[0].id;

    // Delete symbols (cascading will handle relationships)
    const symbolResult = await this.db.run(
      "DELETE FROM symbols WHERE file_id = ?",
      [fileId]
    );
    result.symbolsDeleted = symbolResult.changes ?? 0;

    // Delete the file record
    await this.db.run("DELETE FROM files WHERE id = ?", [fileId]);

    // Remove freshness record
    await this.db.run(
      "DELETE FROM context_freshness WHERE entity_type = 'file' AND entity_id = ?",
      [change.path]
    );

    return result;
  }

  /**
   * Handle dependency file change
   */
  private async handleDependencyChange(
    repositoryId: string,
    change: FileChange
  ): Promise<void> {
    // Mark all dependencies as stale
    await this.db.run(
      `UPDATE context_freshness SET freshness_status = 'STALE', updated_at = ?
       WHERE entity_type = 'dependency' AND entity_id LIKE ?`,
      [new Date(), `${repositoryId}:%`]
    );

    // Mark capabilities that depend on dependencies as stale
    await this.db.run(
      `UPDATE context_freshness SET freshness_status = 'STALE', updated_at = ?
       WHERE entity_type = 'capability' AND entity_id IN (
         SELECT capability_id FROM capability_evidence
         WHERE evidence_type = 'DEPENDS_ON'
       )`,
      [new Date()]
    );
  }

  /**
   * Set freshness status for an entity
   */
  private async setFreshness(
    entityType: string,
    entityId: string,
    sourceCommit: string,
    status: FreshnessStatus,
    fileHash?: string
  ): Promise<void> {
    const id = randomUUID();
    const now = new Date();

    await this.db.run(
      `INSERT INTO context_freshness (id, entity_type, entity_id, source_commit, source_file_hash, freshness_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(entity_type, entity_id) DO UPDATE SET
         source_commit = excluded.source_commit,
         source_file_hash = excluded.source_file_hash,
         freshness_status = excluded.freshness_status,
         updated_at = excluded.updated_at`,
      [id, entityType, entityId, sourceCommit, fileHash ?? null, status, now, now]
    );
  }

  /**
   * Invalidate context for a commit change
   */
  async invalidateForCommitChange(
    repositoryId: string,
    oldCommit: string,
    newCommit: string,
    changedFiles: string[]
  ): Promise<void> {
    // Mark files as stale
    for (const filePath of changedFiles) {
      await this.setFreshness("file", filePath, oldCommit, "STALE");
    }

    // Mark affected symbols as stale
    const fileIds = await this.db.query<{ id: string }>(
      `SELECT id FROM files WHERE repository_id = ? AND path IN (${changedFiles.map(() => "?").join(",")})`,
      [repositoryId, ...changedFiles]
    );

    if (fileIds.length > 0) {
      const ids = fileIds.map((f) => f.id);
      await this.db.run(
        `UPDATE context_freshness SET freshness_status = 'STALE', updated_at = ?
         WHERE entity_type = 'symbol' AND entity_id IN (
           SELECT id FROM symbols WHERE file_id IN (${ids.map(() => "?").join(",")})
         )`,
        [new Date(), ...ids]
      );
    }

    // Emit context invalidated event
    await this.eventEmitter.emit("CONTEXT_INVALIDATED", {
      repositoryId,
      data: {
        reason: "commit_changed",
        oldCommit,
        newCommit,
        affectedEntities: changedFiles,
      },
    });
  }

  /**
   * Get pending queue size
   */
  get queueSize(): number {
    return this.indexQueue.length;
  }

  /**
   * Check if currently processing
   */
  get processing(): boolean {
    return this.isProcessing;
  }

  /**
   * Clear the queue
   */
  clearQueue(): void {
    this.indexQueue = [];
  }
}

/**
 * Create an incremental indexer
 */
export function createIncrementalIndexer(
  db: Database,
  options?: IncrementalIndexerOptions
): IncrementalIndexer {
  return new IncrementalIndexer(db, options);
}
