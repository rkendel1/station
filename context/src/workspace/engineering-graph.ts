/**
 * PR7: Engineering graph - manages the relationship graph between entities
 */

import { randomUUID } from "crypto";
import type {
  RelationshipType,
  SourceType,
  CapabilityEvidence,
  ImpactAssessment,
} from "../types/index.js";
import type { Database } from "../db/client.js";

/**
 * Graph node types
 */
export type NodeType =
  | "repository"
  | "file"
  | "symbol"
  | "capability"
  | "test"
  | "document"
  | "dependency";

/**
 * Graph relationship with full metadata
 */
export interface GraphRelationship {
  id: string;
  sourceType: NodeType;
  sourceId: string;
  sourceName?: string;
  relationship: RelationshipType;
  targetType: NodeType;
  targetId: string;
  targetName?: string;
  confidence: number;
  source: SourceType;
  evidenceFile?: string;
  evidenceLine?: number;
}

/**
 * Graph query options
 */
export interface GraphQueryOptions {
  depth?: number;
  relationshipTypes?: RelationshipType[];
  nodeTypes?: NodeType[];
  minConfidence?: number;
}

/**
 * Graph traversal result
 */
export interface GraphTraversalResult {
  nodes: Set<string>;
  relationships: GraphRelationship[];
}

/**
 * Engineering graph - manages relationships and traversal
 */
export class EngineeringGraph {
  constructor(private db: Database) {}

  /**
   * Create a relationship
   */
  async createRelationship(
    sourceType: NodeType,
    sourceId: string,
    relationship: RelationshipType,
    targetType: NodeType,
    targetId: string,
    options: {
      confidence?: number;
      source?: SourceType;
      evidenceFile?: string;
      evidenceLine?: number;
    } = {}
  ): Promise<string> {
    const id = randomUUID();
    const now = new Date();

    await this.db.run(
      `INSERT INTO relationships (id, source_type, source_id, relationship, target_type, target_id, confidence, source, evidence_file, evidence_line, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sourceType,
        sourceId,
        relationship,
        targetType,
        targetId,
        options.confidence ?? 1.0,
        options.source ?? "OBSERVED",
        options.evidenceFile ?? null,
        options.evidenceLine ?? null,
        now,
        now,
      ]
    );

    return id;
  }

  /**
   * Get outgoing relationships from a node
   */
  async getOutgoingRelationships(
    sourceType: NodeType,
    sourceId: string,
    options: GraphQueryOptions = {}
  ): Promise<GraphRelationship[]> {
    let query = `SELECT * FROM relationships WHERE source_type = ? AND source_id = ?`;
    const params: unknown[] = [sourceType, sourceId];

    if (options.relationshipTypes && options.relationshipTypes.length > 0) {
      const placeholders = options.relationshipTypes.map(() => "?").join(",");
      query += ` AND relationship IN (${placeholders})`;
      params.push(...options.relationshipTypes);
    }

    if (options.minConfidence !== undefined) {
      query += ` AND confidence >= ?`;
      params.push(options.minConfidence);
    }

    const rows = await this.db.query<{
      id: string;
      source_type: string;
      source_id: string;
      relationship: string;
      target_type: string;
      target_id: string;
      confidence: number;
      source: string;
      evidence_file: string | null;
      evidence_line: number | null;
    }>(query, params);

    return rows.map((row) => ({
      id: row.id,
      sourceType: row.source_type as NodeType,
      sourceId: row.source_id,
      relationship: row.relationship as RelationshipType,
      targetType: row.target_type as NodeType,
      targetId: row.target_id,
      confidence: row.confidence,
      source: row.source as SourceType,
      evidenceFile: row.evidence_file ?? undefined,
      evidenceLine: row.evidence_line ?? undefined,
    }));
  }

  /**
   * Get incoming relationships to a node
   */
  async getIncomingRelationships(
    targetType: NodeType,
    targetId: string,
    options: GraphQueryOptions = {}
  ): Promise<GraphRelationship[]> {
    let query = `SELECT * FROM relationships WHERE target_type = ? AND target_id = ?`;
    const params: unknown[] = [targetType, targetId];

    if (options.relationshipTypes && options.relationshipTypes.length > 0) {
      const placeholders = options.relationshipTypes.map(() => "?").join(",");
      query += ` AND relationship IN (${placeholders})`;
      params.push(...options.relationshipTypes);
    }

    if (options.minConfidence !== undefined) {
      query += ` AND confidence >= ?`;
      params.push(options.minConfidence);
    }

    const rows = await this.db.query<{
      id: string;
      source_type: string;
      source_id: string;
      relationship: string;
      target_type: string;
      target_id: string;
      confidence: number;
      source: string;
      evidence_file: string | null;
      evidence_line: number | null;
    }>(query, params);

    return rows.map((row) => ({
      id: row.id,
      sourceType: row.source_type as NodeType,
      sourceId: row.source_id,
      relationship: row.relationship as RelationshipType,
      targetType: row.target_type as NodeType,
      targetId: row.target_id,
      confidence: row.confidence,
      source: row.source as SourceType,
      evidenceFile: row.evidence_file ?? undefined,
      evidenceLine: row.evidence_line ?? undefined,
    }));
  }

  /**
   * Traverse the graph from a starting node
   */
  async traverse(
    startType: NodeType,
    startId: string,
    options: GraphQueryOptions = {}
  ): Promise<GraphTraversalResult> {
    const depth = options.depth ?? 2;
    const visited = new Set<string>();
    const relationships: GraphRelationship[] = [];

    const queue: Array<{ type: NodeType; id: string; currentDepth: number }> = [
      { type: startType, id: startId, currentDepth: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const key = `${current.type}:${current.id}`;

      if (visited.has(key) || current.currentDepth > depth) {
        continue;
      }

      visited.add(key);

      if (current.currentDepth < depth) {
        const outgoing = await this.getOutgoingRelationships(
          current.type,
          current.id,
          options
        );

        for (const rel of outgoing) {
          relationships.push(rel);

          if (!options.nodeTypes || options.nodeTypes.includes(rel.targetType)) {
            queue.push({
              type: rel.targetType,
              id: rel.targetId,
              currentDepth: current.currentDepth + 1,
            });
          }
        }
      }
    }

    return { nodes: visited, relationships };
  }

  /**
   * Get capability evidence
   */
  async getCapabilityEvidence(capabilityId: string): Promise<CapabilityEvidence> {
    const rows = await this.db.query<{
      evidence_type: string;
      target_type: string;
      target_id: string;
    }>(
      "SELECT evidence_type, target_type, target_id FROM capability_evidence WHERE capability_id = ?",
      [capabilityId]
    );

    const evidence: CapabilityEvidence = {
      capabilityId,
      implementedBy: [],
      configuredBy: [],
      testedBy: [],
      documentedBy: [],
      dependencies: [],
    };

    for (const row of rows) {
      const targetKey = `${row.target_type}:${row.target_id}`;
      switch (row.evidence_type) {
        case "IMPLEMENTED_BY":
          evidence.implementedBy.push(targetKey);
          break;
        case "CONFIGURED_BY":
          evidence.configuredBy.push(targetKey);
          break;
        case "TESTED_BY":
          evidence.testedBy.push(targetKey);
          break;
        case "DOCUMENTED_BY":
          evidence.documentedBy.push(targetKey);
          break;
        case "DEPENDS_ON":
          evidence.dependencies.push(targetKey);
          break;
      }
    }

    return evidence;
  }

  /**
   * Add capability evidence
   */
  async addCapabilityEvidence(
    capabilityId: string,
    evidenceType: "IMPLEMENTED_BY" | "CONFIGURED_BY" | "TESTED_BY" | "DOCUMENTED_BY" | "DEPENDS_ON",
    targetType: string,
    targetId: string
  ): Promise<void> {
    const id = randomUUID();
    const now = new Date();

    await this.db.run(
      `INSERT INTO capability_evidence (id, capability_id, evidence_type, target_type, target_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, capabilityId, evidenceType, targetType, targetId, now]
    );
  }

  /**
   * Assess impact of changes
   */
  async assessImpact(
    repositoryId: string,
    changedFiles: string[]
  ): Promise<ImpactAssessment> {
    // Get affected symbols
    const fileIds = await this.db.query<{ id: string }>(
      `SELECT id FROM files WHERE repository_id = ? AND path IN (${changedFiles.map(() => "?").join(",")})`,
      [repositoryId, ...changedFiles]
    );

    let symbolCount = 0;
    if (fileIds.length > 0) {
      const ids = fileIds.map((f) => f.id);
      const symbols = await this.db.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM symbols WHERE file_id IN (${ids.map(() => "?").join(",")})`,
        ids
      );
      symbolCount = symbols[0]?.count ?? 0;
    }

    // Get affected tests
    const testCount = await this.db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM tests WHERE repository_id = ? AND file_id IN (
        SELECT id FROM files WHERE path IN (${changedFiles.map(() => "?").join(",")})
      )`,
      [repositoryId, ...changedFiles]
    );

    // Get affected capabilities
    const capCount = await this.db.query<{ count: number }>(
      `SELECT COUNT(DISTINCT capability_id) as count FROM capability_evidence
       WHERE target_type = 'file' AND target_id IN (${changedFiles.map(() => "?").join(",")})`,
      changedFiles
    );

    // Check cross-repository impact
    const crossRepoRelations = await this.db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM relationships
       WHERE (source_type = 'file' AND source_id IN (${changedFiles.map(() => "?").join(",")}))
       OR (target_type = 'file' AND target_id IN (${changedFiles.map(() => "?").join(",")}))`,
      [...changedFiles, ...changedFiles]
    );

    // Determine complexity
    let workingTreeComplexity: "LOW" | "MEDIUM" | "HIGH" = "LOW";
    if (changedFiles.length > 20 || symbolCount > 50) {
      workingTreeComplexity = "HIGH";
    } else if (changedFiles.length > 5 || symbolCount > 10) {
      workingTreeComplexity = "MEDIUM";
    }

    return {
      symbolCount,
      testCount: testCount[0]?.count ?? 0,
      capabilityCount: capCount[0]?.count ?? 0,
      repositoryCount: 1, // Single repository for now
      moduleCount: fileIds.length,
      databaseCount: 0, // Would need schema analysis
      crossRepositoryImpact: (crossRepoRelations[0]?.count ?? 0) > changedFiles.length * 2,
      workingTreeComplexity,
    };
  }

  /**
   * Find related entities for a task
   */
  async findRelatedEntities(
    keywords: string[],
    options: GraphQueryOptions = {}
  ): Promise<{
    symbols: string[];
    files: string[];
    capabilities: string[];
    tests: string[];
  }> {
    const result = {
      symbols: [] as string[],
      files: [] as string[],
      capabilities: [] as string[],
      tests: [] as string[],
    };

    // Search symbols by name
    for (const keyword of keywords) {
      const symbols = await this.db.query<{ id: string; name: string }>(
        "SELECT id, name FROM symbols WHERE name LIKE ? LIMIT 10",
        [`%${keyword}%`]
      );
      result.symbols.push(...symbols.map((s) => s.id));

      // Search capabilities
      const caps = await this.db.query<{ id: string }>(
        "SELECT id FROM capabilities WHERE name LIKE ? OR description LIKE ? LIMIT 10",
        [`%${keyword}%`, `%${keyword}%`]
      );
      result.capabilities.push(...caps.map((c) => c.id));

      // Search tests
      const tests = await this.db.query<{ id: string }>(
        "SELECT id FROM tests WHERE name LIKE ? LIMIT 10",
        [`%${keyword}%`]
      );
      result.tests.push(...tests.map((t) => t.id));
    }

    // Get files for found symbols
    if (result.symbols.length > 0) {
      const files = await this.db.query<{ file_id: string }>(
        `SELECT DISTINCT file_id FROM symbols WHERE id IN (${result.symbols.map(() => "?").join(",")})`,
        result.symbols
      );
      result.files.push(...files.map((f) => f.file_id));
    }

    return result;
  }

  /**
   * Get graph statistics
   */
  async getStatistics(): Promise<{
    relationshipCount: number;
    nodesByType: Record<string, number>;
    relationshipsByType: Record<string, number>;
  }> {
    const relCount = await this.db.query<{ count: number }>(
      "SELECT COUNT(*) as count FROM relationships"
    );

    const relByType = await this.db.query<{ relationship: string; count: number }>(
      "SELECT relationship, COUNT(*) as count FROM relationships GROUP BY relationship"
    );

    const nodesByType: Record<string, number> = {};
    const nodeQueries = [
      { type: "repository", table: "repositories" },
      { type: "file", table: "files" },
      { type: "symbol", table: "symbols" },
      { type: "capability", table: "capabilities" },
      { type: "test", table: "tests" },
      { type: "document", table: "documents" },
    ];

    for (const { type, table } of nodeQueries) {
      const count = await this.db.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM ${table}`
      );
      nodesByType[type] = count[0]?.count ?? 0;
    }

    const relationshipsByType: Record<string, number> = {};
    for (const row of relByType) {
      relationshipsByType[row.relationship] = row.count;
    }

    return {
      relationshipCount: relCount[0]?.count ?? 0,
      nodesByType,
      relationshipsByType,
    };
  }
}

/**
 * Create an engineering graph
 */
export function createEngineeringGraph(db: Database): EngineeringGraph {
  return new EngineeringGraph(db);
}
