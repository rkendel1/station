/**
 * PR7: Context freshness tracker - tracks freshness of context entities
 */

import { randomUUID } from "crypto";
import type { FreshnessStatus } from "../types/index.js";
import type { Database } from "../db/client.js";

/**
 * Freshness record
 */
export interface FreshnessRecord {
  entityType: string;
  entityId: string;
  sourceCommit: string;
  sourceFileHash?: string;
  freshnessStatus: FreshnessStatus;
  updatedAt: Date;
}

/**
 * Context freshness tracker
 */
export class FreshnessTracker {
  constructor(private db: Database) {}

  /**
   * Set freshness for an entity
   */
  async setFreshness(
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
   * Get freshness for an entity
   */
  async getFreshness(
    entityType: string,
    entityId: string
  ): Promise<FreshnessRecord | null> {
    const rows = await this.db.query<{
      entity_type: string;
      entity_id: string;
      source_commit: string;
      source_file_hash: string | null;
      freshness_status: string;
      updated_at: string;
    }>(
      "SELECT * FROM context_freshness WHERE entity_type = ? AND entity_id = ?",
      [entityType, entityId]
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      entityType: row.entity_type,
      entityId: row.entity_id,
      sourceCommit: row.source_commit,
      sourceFileHash: row.source_file_hash ?? undefined,
      freshnessStatus: row.freshness_status as FreshnessStatus,
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Mark entities as stale
   */
  async markStale(entityType: string, entityIds: string[]): Promise<void> {
    if (entityIds.length === 0) return;

    const now = new Date();
    const placeholders = entityIds.map(() => "?").join(",");

    await this.db.run(
      `UPDATE context_freshness SET freshness_status = 'STALE', updated_at = ?
       WHERE entity_type = ? AND entity_id IN (${placeholders})`,
      [now, entityType, ...entityIds]
    );
  }

  /**
   * Mark entities as invalid
   */
  async markInvalid(entityType: string, entityIds: string[]): Promise<void> {
    if (entityIds.length === 0) return;

    const now = new Date();
    const placeholders = entityIds.map(() => "?").join(",");

    await this.db.run(
      `UPDATE context_freshness SET freshness_status = 'INVALID', updated_at = ?
       WHERE entity_type = ? AND entity_id IN (${placeholders})`,
      [now, entityType, ...entityIds]
    );
  }

  /**
   * Get all stale entities
   */
  async getStaleEntities(
    entityType?: string,
    limit?: number
  ): Promise<FreshnessRecord[]> {
    let query = "SELECT * FROM context_freshness WHERE freshness_status = 'STALE'";
    const params: unknown[] = [];

    if (entityType) {
      query += " AND entity_type = ?";
      params.push(entityType);
    }

    if (limit) {
      query += " LIMIT ?";
      params.push(limit);
    }

    const rows = await this.db.query<{
      entity_type: string;
      entity_id: string;
      source_commit: string;
      source_file_hash: string | null;
      freshness_status: string;
      updated_at: string;
    }>(query, params);

    return rows.map((row) => ({
      entityType: row.entity_type,
      entityId: row.entity_id,
      sourceCommit: row.source_commit,
      sourceFileHash: row.source_file_hash ?? undefined,
      freshnessStatus: row.freshness_status as FreshnessStatus,
      updatedAt: new Date(row.updated_at),
    }));
  }

  /**
   * Get freshness statistics
   */
  async getStatistics(): Promise<Record<FreshnessStatus, number>> {
    const rows = await this.db.query<{
      freshness_status: string;
      count: number;
    }>(
      `SELECT freshness_status, COUNT(*) as count FROM context_freshness
       GROUP BY freshness_status`
    );

    const stats: Record<FreshnessStatus, number> = {
      CURRENT: 0,
      STALE: 0,
      INVALID: 0,
      UNKNOWN: 0,
    };

    for (const row of rows) {
      stats[row.freshness_status as FreshnessStatus] = row.count;
    }

    return stats;
  }

  /**
   * Invalidate context for commit change
   */
  async invalidateForCommit(
    repositoryId: string,
    changedFiles: string[]
  ): Promise<void> {
    const now = new Date();

    // Mark files as stale
    if (changedFiles.length > 0) {
      const placeholders = changedFiles.map(() => "?").join(",");
      await this.db.run(
        `UPDATE context_freshness SET freshness_status = 'STALE', updated_at = ?
         WHERE entity_type = 'file' AND entity_id IN (${placeholders})`,
        [now, ...changedFiles]
      );
    }

    // Get file IDs for changed files
    const fileIds = await this.db.query<{ id: string }>(
      `SELECT id FROM files WHERE repository_id = ? AND path IN (${changedFiles.map(() => "?").join(",")})`,
      [repositoryId, ...changedFiles]
    );

    // Mark symbols in those files as stale
    if (fileIds.length > 0) {
      const ids = fileIds.map((f) => f.id);
      const symbols = await this.db.query<{ id: string }>(
        `SELECT id FROM symbols WHERE file_id IN (${ids.map(() => "?").join(",")})`,
        ids
      );

      if (symbols.length > 0) {
        const symbolIds = symbols.map((s) => s.id);
        await this.markStale("symbol", symbolIds);
      }
    }
  }

  /**
   * Clean up old records
   */
  async cleanup(olderThan: Date): Promise<number> {
    const result = await this.db.run(
      "DELETE FROM context_freshness WHERE updated_at < ?",
      [olderThan]
    );
    return result.changes ?? 0;
  }
}

/**
 * Create a freshness tracker
 */
export function createFreshnessTracker(db: Database): FreshnessTracker {
  return new FreshnessTracker(db);
}
