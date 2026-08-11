/**
 * Context retrieval system - finds relevant context for queries
 */

import type { Database } from "../db/client.js";
import type {
  Repository,
  File,
  Symbol,
  Document,
  Capability,
  Decision,
  TestRecord,
  Dependency,
} from "../types/index.js";

export interface RetrievalResult {
  repositories: Repository[];
  files: File[];
  symbols: Symbol[];
  documents: Document[];
  capabilities: Capability[];
  decisions: Decision[];
  tests: TestRecord[];
  dependencies: Dependency[];
  score: number;
}

export interface RetrievalOptions {
  limit?: number;
  includeSymbols?: boolean;
  includeTests?: boolean;
  includeDocuments?: boolean;
  minConfidence?: number;
}

export class ContextRetriever {
  constructor(private db: Database) {}

  /**
   * Search for symbols by name or qualified name
   */
  async searchSymbols(
    query: string,
    limit = 20
  ): Promise<Symbol[]> {
    const likeQuery = `%${query}%`;
    return this.db.query<Symbol>(
      `SELECT * FROM symbols 
       WHERE name LIKE ? OR qualified_name LIKE ?
       ORDER BY name ASC
       LIMIT ?`,
      [likeQuery, likeQuery, limit]
    );
  }

  /**
   * Search for files by path or name
   */
  async searchFiles(query: string, limit = 20): Promise<File[]> {
    const likeQuery = `%${query}%`;
    return this.db.query<File>(
      `SELECT * FROM files 
       WHERE path LIKE ?
       ORDER BY path ASC
       LIMIT ?`,
      [likeQuery, limit]
    );
  }

  /**
   * Search for repositories
   */
  async searchRepositories(query: string, limit = 10): Promise<Repository[]> {
    const likeQuery = `%${query}%`;
    return this.db.query<Repository>(
      `SELECT * FROM repositories 
       WHERE name LIKE ? OR full_name LIKE ?
       ORDER BY name ASC
       LIMIT ?`,
      [likeQuery, likeQuery, limit]
    );
  }

  /**
   * Find symbols in a file
   */
  async getFileSymbols(fileId: string): Promise<Symbol[]> {
    return this.db.query<Symbol>(
      `SELECT * FROM symbols WHERE file_id = ?`,
      [fileId]
    );
  }

  /**
   * Get dependencies for a repository
   */
  async getRepositoryDependencies(
    repositoryId: string
  ): Promise<Dependency[]> {
    return this.db.query<Dependency>(
      `SELECT * FROM dependencies WHERE repository_id = ?`,
      [repositoryId]
    );
  }

  /**
   * Get capabilities for a repository
   */
  async getRepositoryCapabilities(
    repositoryId: string,
    minConfidence = 0
  ): Promise<Capability[]> {
    return this.db.query<Capability>(
      `SELECT * FROM capabilities 
       WHERE repository_id = ? AND confidence >= ?`,
      [repositoryId, minConfidence]
    );
  }

  /**
   * Get decisions for a repository
   */
  async getRepositoryDecisions(
    repositoryId: string
  ): Promise<Decision[]> {
    return this.db.query<Decision>(
      `SELECT * FROM decisions WHERE repository_id = ?`,
      [repositoryId]
    );
  }

  /**
   * Get database instance for direct queries
   */
  getDatabase(): Database {
    return this.db;
  }

  /**
   * Get files in a repository
   */
  async getRepositoryFiles(repositoryId: string): Promise<File[]> {
    return this.db.query<File>(
      `SELECT * FROM files WHERE repository_id = ? ORDER BY path`,
      [repositoryId]
    );
  }

  /**
   * Get tests for a file
   */
  async getFileTests(fileId: string): Promise<TestRecord[]> {
    return this.db.query<TestRecord>(
      `SELECT * FROM tests WHERE file_id = ?`,
      [fileId]
    );
  }

  /**
   * Get related files (files that import or reference each other)
   */
  async getRelatedFiles(fileId: string): Promise<File[]> {
    // This is a simplified implementation
    // A full implementation would track imports/references
    return [];
  }

  /**
   * Find all repositories
   */
  async getAllRepositories(): Promise<Repository[]> {
    return this.db.query<Repository>(
      `SELECT * FROM repositories WHERE status = 'indexed' ORDER BY name`
    );
  }

  /**
   * Get files in a language
   */
  async getFilesByLanguage(
    repositoryId: string,
    language: string
  ): Promise<File[]> {
    return this.db.query<File>(
      `SELECT * FROM files 
       WHERE repository_id = ? AND language = ?
       ORDER BY path ASC`,
      [repositoryId, language]
    );
  }

  /**
   * Search broadly for context given a query
   */
  async retrieveContextForQuery(
    query: string,
    options: RetrievalOptions = {}
  ): Promise<RetrievalResult> {
    const limit = options.limit || 50;
    const likeQuery = `%${query}%`;

    const repositories = await this.searchRepositories(query, Math.ceil(limit / 5));
    const files = await this.searchFiles(query, limit);
    const symbols = options.includeSymbols
      ? await this.searchSymbols(query, limit)
      : [];

    const documents = options.includeDocuments
      ? await this.db.query<Document>(
          `SELECT * FROM documents 
           WHERE title LIKE ? OR path LIKE ?
           LIMIT ?`,
          [likeQuery, likeQuery, limit]
        )
      : [];

    const capabilities = await this.db.query<Capability>(
      `SELECT * FROM capabilities 
       WHERE name LIKE ? OR description LIKE ?
       AND confidence >= ?
       LIMIT ?`,
      [likeQuery, likeQuery, options.minConfidence || 0, limit]
    );

    const decisions = await this.db.query<Decision>(
      `SELECT * FROM decisions 
       WHERE title LIKE ? OR decision LIKE ?
       LIMIT ?`,
      [likeQuery, likeQuery, limit]
    );

    const tests = options.includeTests
      ? await this.db.query<TestRecord>(
          `SELECT * FROM tests WHERE name LIKE ? LIMIT ?`,
          [likeQuery, limit]
        )
      : [];

    const dependencies: Dependency[] = [];

    return {
      repositories,
      files,
      symbols,
      documents,
      capabilities,
      decisions,
      tests,
      dependencies,
      score: this.calculateRelevanceScore({
        repositories: repositories.length,
        files: files.length,
        symbols: symbols.length,
        documents: documents.length,
        capabilities: capabilities.length,
        decisions: decisions.length,
        tests: tests.length,
      }),
    };
  }

  /**
   * Calculate relevance score based on result counts
   */
  private calculateRelevanceScore(counts: {
    repositories: number;
    files: number;
    symbols: number;
    documents: number;
    capabilities: number;
    decisions: number;
    tests: number;
  }): number {
    const weights = {
      repositories: 2,
      files: 1.5,
      symbols: 1,
      documents: 1.5,
      capabilities: 2,
      decisions: 2,
      tests: 1,
    };

    return (
      counts.repositories * weights.repositories +
      counts.files * weights.files +
      counts.symbols * weights.symbols +
      counts.documents * weights.documents +
      counts.capabilities * weights.capabilities +
      counts.decisions * weights.decisions +
      counts.tests * weights.tests
    );
  }
}
