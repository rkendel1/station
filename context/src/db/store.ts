/**
 * Storage abstraction layer for the context system
 * Allows pluggable implementations (SQLite, PGlite, etc.)
 */

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

/**
 * Provider-agnostic storage interface for the context system
 * All AI control plane code should use this interface
 * instead of importing database drivers directly
 */
export interface ContextStore {
  // Repository operations
  getRepository(id: string): Promise<Repository | null>;
  listRepositories(): Promise<Repository[]>;
  createRepository(repo: Omit<Repository, "created_at" | "updated_at">): Promise<Repository>;
  updateRepository(id: string, updates: Partial<Repository>): Promise<Repository>;
  deleteRepository(id: string): Promise<void>;

  // Workspace operations
  getWorkspace(id: string): Promise<Workspace | null>;
  listWorkspaces(): Promise<Workspace[]>;
  createWorkspace(workspace: Omit<Workspace, "created_at" | "updated_at">): Promise<Workspace>;
  updateWorkspace(id: string, updates: Partial<Workspace>): Promise<Workspace>;
  deleteWorkspace(id: string): Promise<void>;

  // File operations
  getFile(id: string): Promise<File | null>;
  listFilesByRepository(repositoryId: string): Promise<File[]>;
  createFile(file: Omit<File, "indexed_at">): Promise<File>;
  updateFile(id: string, updates: Partial<File>): Promise<File>;
  deleteFile(id: string): Promise<void>;

  // Symbol operations
  getSymbol(id: string): Promise<Symbol | null>;
  listSymbolsByFile(fileId: string): Promise<Symbol[]>;
  listSymbolsByRepository(repositoryId: string): Promise<Symbol[]>;
  searchSymbols(query: string): Promise<Symbol[]>;
  createSymbol(symbol: Symbol): Promise<Symbol>;
  updateSymbol(id: string, updates: Partial<Symbol>): Promise<Symbol>;
  deleteSymbol(id: string): Promise<void>;

  // Dependency operations
  getDependency(id: string): Promise<Dependency | null>;
  listDependenciesByRepository(repositoryId: string): Promise<Dependency[]>;
  createDependency(dependency: Dependency): Promise<Dependency>;
  updateDependency(id: string, updates: Partial<Dependency>): Promise<Dependency>;
  deleteDependency(id: string): Promise<void>;

  // Relationship operations
  getRelationship(id: string): Promise<Relationship | null>;
  listRelationshipsBySource(sourceType: string, sourceId: string): Promise<Relationship[]>;
  listRelationshipsByTarget(targetType: string, targetId: string): Promise<Relationship[]>;
  createRelationship(relationship: Relationship): Promise<Relationship>;
  updateRelationship(id: string, updates: Partial<Relationship>): Promise<Relationship>;
  deleteRelationship(id: string): Promise<void>;

  // Capability operations
  getCapability(id: string): Promise<Capability | null>;
  listCapabilitiesByRepository(repositoryId: string): Promise<Capability[]>;
  createCapability(capability: Capability): Promise<Capability>;
  updateCapability(id: string, updates: Partial<Capability>): Promise<Capability>;
  deleteCapability(id: string): Promise<void>;

  // Document operations
  getDocument(id: string): Promise<Document | null>;
  listDocumentsByRepository(repositoryId: string): Promise<Document[]>;
  createDocument(document: Document): Promise<Document>;
  updateDocument(id: string, updates: Partial<Document>): Promise<Document>;
  deleteDocument(id: string): Promise<void>;

  // Decision operations
  getDecision(id: string): Promise<Decision | null>;
  listDecisionsByRepository(repositoryId: string): Promise<Decision[]>;
  createDecision(decision: Decision): Promise<Decision>;
  updateDecision(id: string, updates: Partial<Decision>): Promise<Decision>;
  deleteDecision(id: string): Promise<void>;

  // Test operations
  getTest(id: string): Promise<TestRecord | null>;
  listTestsByRepository(repositoryId: string): Promise<TestRecord[]>;
  listTestsByFile(fileId: string): Promise<TestRecord[]>;
  createTest(test: TestRecord): Promise<TestRecord>;
  updateTest(id: string, updates: Partial<TestRecord>): Promise<TestRecord>;
  deleteTest(id: string): Promise<void>;

  // Embedding operations
  getEmbedding(id: string): Promise<Embedding | null>;
  listEmbeddingsByEntity(entityType: string, entityId: string): Promise<Embedding[]>;
  createEmbedding(embedding: Embedding): Promise<Embedding>;
  updateEmbedding(id: string, updates: Partial<Embedding>): Promise<Embedding>;
  deleteEmbedding(id: string): Promise<void>;

  // Connection management
  close(): Promise<void>;
}
