/**
 * PR7: Context snapshot manager - creates and compares context snapshots
 */

import { randomUUID } from "crypto";
import type { ContextSnapshot } from "../types/index.js";
import type { Database } from "../db/client.js";

/**
 * Snapshot diff result
 */
export interface SnapshotDiff {
  fromCommit: string;
  toCommit: string;
  addedSymbols: string[];
  removedSymbols: string[];
  changedSymbols: string[];
  addedFiles: string[];
  removedFiles: string[];
  addedCapabilities: string[];
  removedCapabilities: string[];
  changedCapabilities: string[];
}

/**
 * Context snapshot manager
 */
export class SnapshotManager {
  constructor(private db: Database) {}

  /**
   * Create a context snapshot for the current state
   */
  async createSnapshot(
    repositoryId: string,
    commitSha: string
  ): Promise<ContextSnapshot> {
    // Get counts
    const fileCounts = await this.db.query<{ count: number }>(
      "SELECT COUNT(*) as count FROM files WHERE repository_id = ?",
      [repositoryId]
    );

    const symbolCounts = await this.db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM symbols WHERE file_id IN (
        SELECT id FROM files WHERE repository_id = ?
      )`,
      [repositoryId]
    );

    const capabilityCounts = await this.db.query<{ count: number }>(
      "SELECT COUNT(*) as count FROM capabilities WHERE repository_id = ?",
      [repositoryId]
    );

    const relationshipCounts = await this.db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM relationships WHERE
       source_id IN (SELECT id FROM files WHERE repository_id = ?)
       OR target_id IN (SELECT id FROM files WHERE repository_id = ?)`,
      [repositoryId, repositoryId]
    );

    // Get next snapshot number
    const maxSnapshot = await this.db.query<{ max_num: number | null }>(
      "SELECT MAX(snapshot_number) as max_num FROM context_snapshots WHERE repository_id = ?",
      [repositoryId]
    );

    const snapshotNumber = (maxSnapshot[0]?.max_num ?? 0) + 1;

    const id = randomUUID();
    const now = new Date();

    const snapshot: ContextSnapshot = {
      id,
      repositoryId,
      commitSha,
      snapshotNumber,
      symbolCount: symbolCounts[0]?.count ?? 0,
      fileCount: fileCounts[0]?.count ?? 0,
      capabilityCount: capabilityCounts[0]?.count ?? 0,
      relationshipCount: relationshipCounts[0]?.count ?? 0,
      created_at: now,
    };

    await this.db.run(
      `INSERT INTO context_snapshots (id, repository_id, commit_sha, snapshot_number, symbol_count, file_count, capability_count, relationship_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(repository_id, commit_sha) DO UPDATE SET
         snapshot_number = excluded.snapshot_number,
         symbol_count = excluded.symbol_count,
         file_count = excluded.file_count,
         capability_count = excluded.capability_count,
         relationship_count = excluded.relationship_count`,
      [
        id,
        repositoryId,
        commitSha,
        snapshotNumber,
        snapshot.symbolCount,
        snapshot.fileCount,
        snapshot.capabilityCount,
        snapshot.relationshipCount,
        now,
      ]
    );

    return snapshot;
  }

  /**
   * Get a snapshot by commit
   */
  async getSnapshot(
    repositoryId: string,
    commitSha: string
  ): Promise<ContextSnapshot | null> {
    const rows = await this.db.query<{
      id: string;
      repository_id: string;
      commit_sha: string;
      snapshot_number: number;
      symbol_count: number;
      file_count: number;
      capability_count: number;
      relationship_count: number;
      created_at: string;
    }>(
      "SELECT * FROM context_snapshots WHERE repository_id = ? AND commit_sha = ?",
      [repositoryId, commitSha]
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      id: row.id,
      repositoryId: row.repository_id,
      commitSha: row.commit_sha,
      snapshotNumber: row.snapshot_number,
      symbolCount: row.symbol_count,
      fileCount: row.file_count,
      capabilityCount: row.capability_count,
      relationshipCount: row.relationship_count,
      created_at: new Date(row.created_at),
    };
  }

  /**
   * List snapshots for a repository
   */
  async listSnapshots(
    repositoryId: string,
    limit?: number
  ): Promise<ContextSnapshot[]> {
    let query = "SELECT * FROM context_snapshots WHERE repository_id = ? ORDER BY snapshot_number DESC";
    const params: unknown[] = [repositoryId];

    if (limit) {
      query += " LIMIT ?";
      params.push(limit);
    }

    const rows = await this.db.query<{
      id: string;
      repository_id: string;
      commit_sha: string;
      snapshot_number: number;
      symbol_count: number;
      file_count: number;
      capability_count: number;
      relationship_count: number;
      created_at: string;
    }>(query, params);

    return rows.map((row) => ({
      id: row.id,
      repositoryId: row.repository_id,
      commitSha: row.commit_sha,
      snapshotNumber: row.snapshot_number,
      symbolCount: row.symbol_count,
      fileCount: row.file_count,
      capabilityCount: row.capability_count,
      relationshipCount: row.relationship_count,
      created_at: new Date(row.created_at),
    }));
  }

  /**
   * Compare two snapshots
   */
  async compareSnapshots(
    repositoryId: string,
    fromCommit: string,
    toCommit: string
  ): Promise<SnapshotDiff> {
    // This is a simplified comparison
    // A full implementation would store detailed snapshot data

    const fromSnapshot = await this.getSnapshot(repositoryId, fromCommit);
    const toSnapshot = await this.getSnapshot(repositoryId, toCommit);

    const diff: SnapshotDiff = {
      fromCommit,
      toCommit,
      addedSymbols: [],
      removedSymbols: [],
      changedSymbols: [],
      addedFiles: [],
      removedFiles: [],
      addedCapabilities: [],
      removedCapabilities: [],
      changedCapabilities: [],
    };

    // Calculate deltas
    if (fromSnapshot && toSnapshot) {
      const symbolDelta = toSnapshot.symbolCount - fromSnapshot.symbolCount;
      const fileDelta = toSnapshot.fileCount - fromSnapshot.fileCount;
      const capDelta = toSnapshot.capabilityCount - fromSnapshot.capabilityCount;

      // Create placeholder entries for the deltas
      if (symbolDelta > 0) {
        diff.addedSymbols = Array(symbolDelta).fill("").map((_, i) => `symbol_${i}`);
      } else if (symbolDelta < 0) {
        diff.removedSymbols = Array(-symbolDelta).fill("").map((_, i) => `symbol_${i}`);
      }

      if (fileDelta > 0) {
        diff.addedFiles = Array(fileDelta).fill("").map((_, i) => `file_${i}`);
      } else if (fileDelta < 0) {
        diff.removedFiles = Array(-fileDelta).fill("").map((_, i) => `file_${i}`);
      }

      if (capDelta > 0) {
        diff.addedCapabilities = Array(capDelta).fill("").map((_, i) => `capability_${i}`);
      } else if (capDelta < 0) {
        diff.removedCapabilities = Array(-capDelta).fill("").map((_, i) => `capability_${i}`);
      }
    }

    return diff;
  }

  /**
   * Delete old snapshots, keeping the most recent N
   */
  async cleanupSnapshots(
    repositoryId: string,
    keepCount: number = 10
  ): Promise<number> {
    const result = await this.db.run(
      `DELETE FROM context_snapshots WHERE repository_id = ? AND snapshot_number NOT IN (
        SELECT snapshot_number FROM context_snapshots WHERE repository_id = ?
        ORDER BY snapshot_number DESC LIMIT ?
      )`,
      [repositoryId, repositoryId, keepCount]
    );
    return result.changes ?? 0;
  }
}

/**
 * Create a snapshot manager
 */
export function createSnapshotManager(db: Database): SnapshotManager {
  return new SnapshotManager(db);
}
