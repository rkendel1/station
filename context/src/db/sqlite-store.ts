/**
 * SQLite implementation of ContextStore using better-sqlite3
 */

import { Database } from "./client.js";
import { ContextStore } from "./store.js";
import {
  Repository,
  Workspace,
  File,
  Symbol,
  Dependency,
  Relationship,
  Capability,
  Document,
  Decision,
  TestRecord,
  Embedding,
} from "../types/index.js";
import { randomUUID } from "crypto";

export class SQLiteContextStore implements ContextStore {
  constructor(private db: Database) {}

  // Repository operations
  async getRepository(id: string): Promise<Repository | null> {
    const result = await this.db.query<Repository>(
      "SELECT * FROM repositories WHERE id = ?",
      [id]
    );
    return result[0] || null;
  }

  async listRepositories(): Promise<Repository[]> {
    return this.db.query<Repository>("SELECT * FROM repositories");
  }

  async createRepository(
    repo: Omit<Repository, "created_at" | "updated_at">
  ): Promise<Repository> {
    const id = repo.id || randomUUID();
    const now = new Date();
    await this.db.run(
      `INSERT INTO repositories (id, name, full_name, remote_url, local_path, default_branch, language, framework, package_manager, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        repo.name,
        repo.full_name,
        repo.remote_url || null,
        repo.local_path,
        repo.default_branch || "main",
        repo.language || null,
        repo.framework || null,
        repo.package_manager || null,
        repo.status,
        now,
        now,
      ]
    );
    return this.getRepository(id) as Promise<Repository>;
  }

  async updateRepository(
    id: string,
    updates: Partial<Repository>
  ): Promise<Repository> {
    const updateFields = Object.entries(updates)
      .filter(([key]) => key !== "id" && key !== "created_at")
      .map(([key]) => `${key} = ?`)
      .join(", ");

    const values = Object.entries(updates)
      .filter(([key]) => key !== "id" && key !== "created_at")
      .map(([, value]) => value);

    if (updateFields) {
      await this.db.run(
        `UPDATE repositories SET ${updateFields}, updated_at = ? WHERE id = ?`,
        [...values, new Date(), id]
      );
    }
    return this.getRepository(id) as Promise<Repository>;
  }

  async deleteRepository(id: string): Promise<void> {
    await this.db.run("DELETE FROM repositories WHERE id = ?", [id]);
  }

  // Workspace operations
  async getWorkspace(id: string): Promise<Workspace | null> {
    const result = await this.db.query<Workspace>(
      "SELECT * FROM workspaces WHERE id = ?",
      [id]
    );
    return result[0] || null;
  }

  async listWorkspaces(): Promise<Workspace[]> {
    return this.db.query<Workspace>("SELECT * FROM workspaces");
  }

  async createWorkspace(
    workspace: Omit<Workspace, "created_at" | "updated_at">
  ): Promise<Workspace> {
    const id = workspace.id || randomUUID();
    const now = new Date();
    await this.db.run(
      `INSERT INTO workspaces (id, name, path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [id, workspace.name, workspace.path, now, now]
    );
    return this.getWorkspace(id) as Promise<Workspace>;
  }

  async updateWorkspace(
    id: string,
    updates: Partial<Workspace>
  ): Promise<Workspace> {
    const updateFields = Object.entries(updates)
      .filter(([key]) => key !== "id" && key !== "created_at")
      .map(([key]) => `${key} = ?`)
      .join(", ");

    const values = Object.entries(updates)
      .filter(([key]) => key !== "id" && key !== "created_at")
      .map(([, value]) => value);

    if (updateFields) {
      await this.db.run(
        `UPDATE workspaces SET ${updateFields}, updated_at = ? WHERE id = ?`,
        [...values, new Date(), id]
      );
    }
    return this.getWorkspace(id) as Promise<Workspace>;
  }

  async deleteWorkspace(id: string): Promise<void> {
    await this.db.run("DELETE FROM workspaces WHERE id = ?", [id]);
  }

  // File operations
  async getFile(id: string): Promise<File | null> {
    const result = await this.db.query<File>(
      "SELECT * FROM files WHERE id = ?",
      [id]
    );
    return result[0] || null;
  }

  async listFilesByRepository(repositoryId: string): Promise<File[]> {
    return this.db.query<File>(
      "SELECT * FROM files WHERE repository_id = ?",
      [repositoryId]
    );
  }

  async createFile(file: Omit<File, "indexed_at">): Promise<File> {
    const id = file.id || randomUUID();
    await this.db.run(
      `INSERT INTO files (id, repository_id, path, language, size, hash, last_modified)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        file.repository_id,
        file.path,
        file.language || null,
        file.size || null,
        file.hash || null,
        file.last_modified || null,
      ]
    );
    return this.getFile(id) as Promise<File>;
  }

  async updateFile(id: string, updates: Partial<File>): Promise<File> {
    const updateFields = Object.entries(updates)
      .filter(([key]) => key !== "id")
      .map(([key]) => `${key} = ?`)
      .join(", ");

    const values = Object.entries(updates)
      .filter(([key]) => key !== "id")
      .map(([, value]) => value);

    if (updateFields) {
      await this.db.run(
        `UPDATE files SET ${updateFields} WHERE id = ?`,
        [...values, id]
      );
    }
    return this.getFile(id) as Promise<File>;
  }

  async deleteFile(id: string): Promise<void> {
    await this.db.run("DELETE FROM files WHERE id = ?", [id]);
  }

  // Symbol operations
  async getSymbol(id: string): Promise<Symbol | null> {
    const result = await this.db.query<Symbol>(
      "SELECT * FROM symbols WHERE id = ?",
      [id]
    );
    return result[0] || null;
  }

  async listSymbolsByFile(fileId: string): Promise<Symbol[]> {
    return this.db.query<Symbol>(
      "SELECT * FROM symbols WHERE file_id = ?",
      [fileId]
    );
  }

  async listSymbolsByRepository(repositoryId: string): Promise<Symbol[]> {
    return this.db.query<Symbol>(
      `SELECT s.* FROM symbols s
       JOIN files f ON s.file_id = f.id
       WHERE f.repository_id = ?`,
      [repositoryId]
    );
  }

  async searchSymbols(query: string): Promise<Symbol[]> {
    return this.db.query<Symbol>(
      "SELECT * FROM symbols WHERE name LIKE ? OR qualified_name LIKE ?",
      [`%${query}%`, `%${query}%`]
    );
  }

  async createSymbol(symbol: Symbol): Promise<Symbol> {
    const id = symbol.id || randomUUID();
    await this.db.run(
      `INSERT INTO symbols (id, file_id, name, kind, qualified_name, start_line, end_line, signature, summary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        symbol.file_id,
        symbol.name,
        symbol.kind,
        symbol.qualified_name || null,
        symbol.start_line || null,
        symbol.end_line || null,
        symbol.signature || null,
        symbol.summary || null,
      ]
    );
    return this.getSymbol(id) as Promise<Symbol>;
  }

  async updateSymbol(id: string, updates: Partial<Symbol>): Promise<Symbol> {
    const updateFields = Object.entries(updates)
      .filter(([key]) => key !== "id")
      .map(([key]) => `${key} = ?`)
      .join(", ");

    const values = Object.entries(updates)
      .filter(([key]) => key !== "id")
      .map(([, value]) => value);

    if (updateFields) {
      await this.db.run(
        `UPDATE symbols SET ${updateFields} WHERE id = ?`,
        [...values, id]
      );
    }
    return this.getSymbol(id) as Promise<Symbol>;
  }

  async deleteSymbol(id: string): Promise<void> {
    await this.db.run("DELETE FROM symbols WHERE id = ?", [id]);
  }

  // Dependency operations
  async getDependency(id: string): Promise<Dependency | null> {
    const result = await this.db.query<Dependency>(
      "SELECT * FROM dependencies WHERE id = ?",
      [id]
    );
    return result[0] || null;
  }

  async listDependenciesByRepository(
    repositoryId: string
  ): Promise<Dependency[]> {
    return this.db.query<Dependency>(
      "SELECT * FROM dependencies WHERE repository_id = ?",
      [repositoryId]
    );
  }

  async createDependency(dependency: Dependency): Promise<Dependency> {
    const id = dependency.id || randomUUID();
    await this.db.run(
      `INSERT INTO dependencies (id, repository_id, source, target, dependency_type, version, resolved_path)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        dependency.repository_id,
        dependency.source,
        dependency.target,
        dependency.dependency_type || null,
        dependency.version || null,
        dependency.resolved_path || null,
      ]
    );
    return this.getDependency(id) as Promise<Dependency>;
  }

  async updateDependency(
    id: string,
    updates: Partial<Dependency>
  ): Promise<Dependency> {
    const updateFields = Object.entries(updates)
      .filter(([key]) => key !== "id")
      .map(([key]) => `${key} = ?`)
      .join(", ");

    const values = Object.entries(updates)
      .filter(([key]) => key !== "id")
      .map(([, value]) => value);

    if (updateFields) {
      await this.db.run(
        `UPDATE dependencies SET ${updateFields} WHERE id = ?`,
        [...values, id]
      );
    }
    return this.getDependency(id) as Promise<Dependency>;
  }

  async deleteDependency(id: string): Promise<void> {
    await this.db.run("DELETE FROM dependencies WHERE id = ?", [id]);
  }

  // Relationship operations
  async getRelationship(id: string): Promise<Relationship | null> {
    const result = await this.db.query<Relationship>(
      "SELECT * FROM relationships WHERE id = ?",
      [id]
    );
    return result[0] || null;
  }

  async listRelationshipsBySource(
    sourceType: string,
    sourceId: string
  ): Promise<Relationship[]> {
    return this.db.query<Relationship>(
      "SELECT * FROM relationships WHERE source_type = ? AND source_id = ?",
      [sourceType, sourceId]
    );
  }

  async listRelationshipsByTarget(
    targetType: string,
    targetId: string
  ): Promise<Relationship[]> {
    return this.db.query<Relationship>(
      "SELECT * FROM relationships WHERE target_type = ? AND target_id = ?",
      [targetType, targetId]
    );
  }

  async createRelationship(
    relationship: Relationship
  ): Promise<Relationship> {
    const id = relationship.id || randomUUID();
    const now = new Date();
    await this.db.run(
      `INSERT INTO relationships (id, source_type, source_id, relationship, target_type, target_id, confidence, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        relationship.source_type,
        relationship.source_id,
        relationship.relationship,
        relationship.target_type,
        relationship.target_id,
        relationship.confidence,
        relationship.source,
        now,
        now,
      ]
    );
    return this.getRelationship(id) as Promise<Relationship>;
  }

  async updateRelationship(
    id: string,
    updates: Partial<Relationship>
  ): Promise<Relationship> {
    const updateFields = Object.entries(updates)
      .filter(([key]) => key !== "id" && key !== "created_at")
      .map(([key]) => `${key} = ?`)
      .join(", ");

    const values = Object.entries(updates)
      .filter(([key]) => key !== "id" && key !== "created_at")
      .map(([, value]) => value);

    if (updateFields) {
      await this.db.run(
        `UPDATE relationships SET ${updateFields}, updated_at = ? WHERE id = ?`,
        [...values, new Date(), id]
      );
    }
    return this.getRelationship(id) as Promise<Relationship>;
  }

  async deleteRelationship(id: string): Promise<void> {
    await this.db.run("DELETE FROM relationships WHERE id = ?", [id]);
  }

  // Capability operations
  async getCapability(id: string): Promise<Capability | null> {
    const result = await this.db.query<Capability>(
      "SELECT * FROM capabilities WHERE id = ?",
      [id]
    );
    return result[0] || null;
  }

  async listCapabilitiesByRepository(
    repositoryId: string
  ): Promise<Capability[]> {
    return this.db.query<Capability>(
      "SELECT * FROM capabilities WHERE repository_id = ?",
      [repositoryId]
    );
  }

  async createCapability(capability: Capability): Promise<Capability> {
    const id = capability.id || randomUUID();
    const now = new Date();
    await this.db.run(
      `INSERT INTO capabilities (id, repository_id, name, description, category, confidence, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        capability.repository_id,
        capability.name,
        capability.description || null,
        capability.category || null,
        capability.confidence,
        capability.source,
        now,
        now,
      ]
    );
    return this.getCapability(id) as Promise<Capability>;
  }

  async updateCapability(
    id: string,
    updates: Partial<Capability>
  ): Promise<Capability> {
    const updateFields = Object.entries(updates)
      .filter(([key]) => key !== "id" && key !== "created_at")
      .map(([key]) => `${key} = ?`)
      .join(", ");

    const values = Object.entries(updates)
      .filter(([key]) => key !== "id" && key !== "created_at")
      .map(([, value]) => value);

    if (updateFields) {
      await this.db.run(
        `UPDATE capabilities SET ${updateFields}, updated_at = ? WHERE id = ?`,
        [...values, new Date(), id]
      );
    }
    return this.getCapability(id) as Promise<Capability>;
  }

  async deleteCapability(id: string): Promise<void> {
    await this.db.run("DELETE FROM capabilities WHERE id = ?", [id]);
  }

  // Document operations
  async getDocument(id: string): Promise<Document | null> {
    const result = await this.db.query<Document>(
      "SELECT * FROM documents WHERE id = ?",
      [id]
    );
    return result[0] || null;
  }

  async listDocumentsByRepository(repositoryId: string): Promise<Document[]> {
    return this.db.query<Document>(
      "SELECT * FROM documents WHERE repository_id = ?",
      [repositoryId]
    );
  }

  async createDocument(document: Document): Promise<Document> {
    const id = document.id || randomUUID();
    await this.db.run(
      `INSERT INTO documents (id, repository_id, path, document_type, title, content_hash, summary, indexed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        document.repository_id,
        document.path,
        document.document_type || null,
        document.title || null,
        document.content_hash || null,
        document.summary || null,
        document.indexed_at || null,
      ]
    );
    return this.getDocument(id) as Promise<Document>;
  }

  async updateDocument(
    id: string,
    updates: Partial<Document>
  ): Promise<Document> {
    const updateFields = Object.entries(updates)
      .filter(([key]) => key !== "id")
      .map(([key]) => `${key} = ?`)
      .join(", ");

    const values = Object.entries(updates)
      .filter(([key]) => key !== "id")
      .map(([, value]) => value);

    if (updateFields) {
      await this.db.run(
        `UPDATE documents SET ${updateFields} WHERE id = ?`,
        [...values, id]
      );
    }
    return this.getDocument(id) as Promise<Document>;
  }

  async deleteDocument(id: string): Promise<void> {
    await this.db.run("DELETE FROM documents WHERE id = ?", [id]);
  }

  // Decision operations
  async getDecision(id: string): Promise<Decision | null> {
    const result = await this.db.query<Decision>(
      "SELECT * FROM decisions WHERE id = ?",
      [id]
    );
    return result[0] || null;
  }

  async listDecisionsByRepository(repositoryId: string): Promise<Decision[]> {
    return this.db.query<Decision>(
      "SELECT * FROM decisions WHERE repository_id = ?",
      [repositoryId]
    );
  }

  async createDecision(decision: Decision): Promise<Decision> {
    const id = decision.id || randomUUID();
    const now = new Date();
    await this.db.run(
      `INSERT INTO decisions (id, repository_id, title, decision, rationale, status, source, confidence, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        decision.repository_id,
        decision.title,
        decision.decision || null,
        decision.rationale || null,
        decision.status || null,
        decision.source,
        decision.confidence,
        now,
        now,
      ]
    );
    return this.getDecision(id) as Promise<Decision>;
  }

  async updateDecision(
    id: string,
    updates: Partial<Decision>
  ): Promise<Decision> {
    const updateFields = Object.entries(updates)
      .filter(([key]) => key !== "id" && key !== "created_at")
      .map(([key]) => `${key} = ?`)
      .join(", ");

    const values = Object.entries(updates)
      .filter(([key]) => key !== "id" && key !== "created_at")
      .map(([, value]) => value);

    if (updateFields) {
      await this.db.run(
        `UPDATE decisions SET ${updateFields}, updated_at = ? WHERE id = ?`,
        [...values, new Date(), id]
      );
    }
    return this.getDecision(id) as Promise<Decision>;
  }

  async deleteDecision(id: string): Promise<void> {
    await this.db.run("DELETE FROM decisions WHERE id = ?", [id]);
  }

  // Test operations
  async getTest(id: string): Promise<TestRecord | null> {
    const result = await this.db.query<TestRecord>(
      "SELECT * FROM tests WHERE id = ?",
      [id]
    );
    return result[0] || null;
  }

  async listTestsByRepository(repositoryId: string): Promise<TestRecord[]> {
    return this.db.query<TestRecord>(
      "SELECT * FROM tests WHERE repository_id = ?",
      [repositoryId]
    );
  }

  async listTestsByFile(fileId: string): Promise<TestRecord[]> {
    return this.db.query<TestRecord>(
      "SELECT * FROM tests WHERE file_id = ?",
      [fileId]
    );
  }

  async createTest(test: TestRecord): Promise<TestRecord> {
    const id = test.id || randomUUID();
    await this.db.run(
      `INSERT INTO tests (id, repository_id, file_id, name, framework, target)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, test.repository_id, test.file_id || null, test.name, test.framework || null, test.target || null]
    );
    return this.getTest(id) as Promise<TestRecord>;
  }

  async updateTest(id: string, updates: Partial<TestRecord>): Promise<TestRecord> {
    const updateFields = Object.entries(updates)
      .filter(([key]) => key !== "id")
      .map(([key]) => `${key} = ?`)
      .join(", ");

    const values = Object.entries(updates)
      .filter(([key]) => key !== "id")
      .map(([, value]) => value);

    if (updateFields) {
      await this.db.run(
        `UPDATE tests SET ${updateFields} WHERE id = ?`,
        [...values, id]
      );
    }
    return this.getTest(id) as Promise<TestRecord>;
  }

  async deleteTest(id: string): Promise<void> {
    await this.db.run("DELETE FROM tests WHERE id = ?", [id]);
  }

  // Embedding operations
  async getEmbedding(id: string): Promise<Embedding | null> {
    const result = await this.db.query<Embedding>(
      "SELECT * FROM embeddings WHERE id = ?",
      [id]
    );
    return result[0] || null;
  }

  async listEmbeddingsByEntity(
    entityType: string,
    entityId: string
  ): Promise<Embedding[]> {
    return this.db.query<Embedding>(
      "SELECT * FROM embeddings WHERE entity_type = ? AND entity_id = ?",
      [entityType, entityId]
    );
  }

  async createEmbedding(embedding: Embedding): Promise<Embedding> {
    const id = embedding.id || randomUUID();
    const now = new Date();
    await this.db.run(
      `INSERT INTO embeddings (id, entity_type, entity_id, content, embedding, model, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        embedding.entity_type,
        embedding.entity_id,
        embedding.content || null,
        embedding.embedding || null,
        embedding.model || null,
        now,
        now,
      ]
    );
    return this.getEmbedding(id) as Promise<Embedding>;
  }

  async updateEmbedding(
    id: string,
    updates: Partial<Embedding>
  ): Promise<Embedding> {
    const updateFields = Object.entries(updates)
      .filter(([key]) => key !== "id" && key !== "created_at")
      .map(([key]) => `${key} = ?`)
      .join(", ");

    const values = Object.entries(updates)
      .filter(([key]) => key !== "id" && key !== "created_at")
      .map(([, value]) => value);

    if (updateFields) {
      await this.db.run(
        `UPDATE embeddings SET ${updateFields}, updated_at = ? WHERE id = ?`,
        [...values, new Date(), id]
      );
    }
    return this.getEmbedding(id) as Promise<Embedding>;
  }

  async deleteEmbedding(id: string): Promise<void> {
    await this.db.run("DELETE FROM embeddings WHERE id = ?", [id]);
  }

  // Connection management
  async close(): Promise<void> {
    await this.db.close();
  }
}
