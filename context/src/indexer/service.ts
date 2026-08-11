/**
 * Main indexing service - orchestrates repository indexing
 */

import path from "path";
import type { Database } from "../db/client.js";
import type {
  Repository,
  File,
  Symbol,
  Dependency,
  TestRecord,
} from "../types/index.js";
import {
  getRepositoryInfo,
  repositoryInfoToModel,
  generateRepositoryId,
} from "./repository.js";
import { indexFiles, generateFileId } from "./filesystem.js";
import { indexDependencies } from "./package.js";
import { indexSymbolsInFile } from "./code.js";
import { discoverTestsInFile } from "./tests.js";

export interface IndexingOptions {
  force?: boolean;
  includeSymbols?: boolean;
  includeTests?: boolean;
  maxFileSize?: number;
}

export class RepositoryIndexer {
  constructor(private db: Database) {}

  /**
   * Index a single repository
   */
  async indexRepository(
    repoPath: string,
    options: IndexingOptions = {}
  ): Promise<{ repository: Repository; indexed: number }> {
    // Get repository info
    const repoInfo = await getRepositoryInfo(repoPath);
    if (!repoInfo) {
      throw new Error(
        `Not a git repository or cannot read: ${repoPath}`
      );
    }

    const repositoryId = generateRepositoryId(repoInfo);
    const repository = repositoryInfoToModel(repoInfo, repositoryId);

    // Check if already indexed
    if (!options.force) {
      try {
        const existing = await this.db.query<Repository>(
          "SELECT * FROM repositories WHERE id = ?",
          [repositoryId]
        );
        if (existing.length > 0) {
          return { repository, indexed: 0 };
        }
      } catch {
        // Continue with indexing
      }
    }

    // Insert repository
    await this.db.run(
      `INSERT OR REPLACE INTO repositories
       (id, name, full_name, remote_url, local_path, default_branch, language, package_manager, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        repository.id,
        repository.name,
        repository.full_name,
        repository.remote_url,
        repository.local_path,
        repository.default_branch,
        repository.language,
        repository.package_manager,
        repository.status,
        new Date().toISOString(),
        new Date().toISOString(),
      ]
    );

    let indexedCount = 1;

    // Index files
    const files = await indexFiles(repositoryId, repoPath, {
      maxFileSize: options.maxFileSize,
    });

    for (const file of files) {
      await this.db.run(
        `INSERT OR REPLACE INTO files
         (id, repository_id, path, language, size, hash, last_modified, indexed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          file.id,
          file.repository_id,
          file.path,
          file.language,
          file.size,
          file.hash,
          file.last_modified?.toISOString(),
          file.indexed_at?.toISOString(),
        ]
      );
      indexedCount++;

      // Index symbols if enabled
      if (options.includeSymbols && file.language) {
        const fullPath = path.join(repoPath, file.path);
        const symbols = await indexSymbolsInFile(
          file.id,
          fullPath,
          file.language
        );

        for (const symbol of symbols) {
          await this.db.run(
            `INSERT OR REPLACE INTO symbols
             (id, file_id, name, kind, qualified_name, start_line, end_line, signature, summary)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              symbol.id,
              symbol.file_id,
              symbol.name,
              symbol.kind,
              symbol.qualified_name,
              symbol.start_line,
              symbol.end_line,
              symbol.signature,
              symbol.summary,
            ]
          );
          indexedCount++;
        }
      }

      // Index tests if enabled
      if (options.includeTests && file.language) {
        const fullPath = path.join(repoPath, file.path);
        const tests = await discoverTestsInFile(
          repositoryId,
          file.id,
          fullPath,
          file.language
        );

        for (const test of tests) {
          await this.db.run(
            `INSERT OR REPLACE INTO tests
             (id, repository_id, file_id, name, framework, target)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              test.id,
              test.repository_id,
              test.file_id,
              test.name,
              test.framework,
              test.target,
            ]
          );
          indexedCount++;
        }
      }
    }

    // Index dependencies
    const deps = await indexDependencies(repositoryId, repoPath);
    for (const dep of deps) {
      await this.db.run(
        `INSERT OR REPLACE INTO dependencies
         (id, repository_id, source, target, dependency_type, version, resolved_path)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          dep.id,
          dep.repository_id,
          dep.source,
          dep.target,
          dep.dependency_type,
          dep.version,
          dep.resolved_path,
        ]
      );
      indexedCount++;
    }

    // Update repository status
    await this.db.run(
      "UPDATE repositories SET status = ?, last_indexed_at = ? WHERE id = ?",
      ["indexed", new Date().toISOString(), repositoryId]
    );

    return { repository, indexed: indexedCount };
  }

  /**
   * Index multiple repositories
   */
  async indexRepositories(
    repoPaths: string[],
    options: IndexingOptions = {}
  ): Promise<Array<{ repository: Repository; indexed: number }>> {
    const results: Array<{ repository: Repository; indexed: number }> = [];

    for (const repoPath of repoPaths) {
      try {
        const result = await this.indexRepository(repoPath, options);
        results.push(result);
      } catch (error) {
        console.error(
          `Failed to index ${repoPath}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return results;
  }

  /**
   * Get indexed repositories
   */
  async getRepositories(): Promise<Repository[]> {
    return this.db.query<Repository>(
      "SELECT * FROM repositories ORDER BY name"
    );
  }

  /**
   * Get files in a repository
   */
  async getRepositoryFiles(repositoryId: string): Promise<File[]> {
    return this.db.query<File>(
      "SELECT * FROM files WHERE repository_id = ? ORDER BY path",
      [repositoryId]
    );
  }

  /**
   * Search for symbols
   */
  async searchSymbols(query: string): Promise<Symbol[]> {
    const likeQuery = `%${query}%`;
    return this.db.query<Symbol>(
      "SELECT * FROM symbols WHERE name LIKE ? OR qualified_name LIKE ? LIMIT 50",
      [likeQuery, likeQuery]
    );
  }

  /**
   * Get dependencies for a repository
   */
  async getDependencies(repositoryId: string): Promise<Dependency[]> {
    return this.db.query<Dependency>(
      "SELECT * FROM dependencies WHERE repository_id = ? ORDER BY target",
      [repositoryId]
    );
  }

  /**
   * Get tests in a repository
   */
  async getTests(repositoryId: string): Promise<TestRecord[]> {
    return this.db.query<TestRecord>(
      "SELECT * FROM tests WHERE repository_id = ? ORDER BY name",
      [repositoryId]
    );
  }

  /**
   * Get test coverage for a file
   */
  async getTestsForFile(fileId: string): Promise<TestRecord[]> {
    return this.db.query<TestRecord>(
      "SELECT * FROM tests WHERE file_id = ?",
      [fileId]
    );
  }
}
