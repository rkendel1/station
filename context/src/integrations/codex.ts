/**
 * Codex integration - provides context to Codex AI agent
 */

import type { Database } from "../db/client.js";
import type { ContextPacket, Repository, File, Symbol, Capability } from "../types/index.js";
import { ContextRetriever } from "../retrieval/searcher.js";
import { ContextPlanner } from "../retrieval/planner.js";

/**
 * CodexContext - Clean interface for Codex to access engineering context
 */
export class CodexContext {
  private retriever: ContextRetriever;
  private planner: ContextPlanner;

  constructor(private db: Database) {
    this.retriever = new ContextRetriever(db);
    this.planner = new ContextPlanner(db);
  }

  /**
   * Search for a symbol or capability
   */
  async search(query: string): Promise<{
    symbols: Symbol[];
    files: File[];
    capabilities: Capability[];
  }> {
    const symbols = await this.retriever.searchSymbols(query);
    const files = await this.retriever.searchFiles(query);

    // Search capabilities through direct database query
    const result = await this.db.query<Capability>(
      `SELECT * FROM capabilities WHERE name LIKE ? LIMIT 10`,
      [`%${query}%`]
    );
    const capabilities = result;

    return { symbols, files, capabilities };
  }

  /**
   * Get repositories in workspace
   */
  async getRepositories(): Promise<Repository[]> {
    return this.retriever.getAllRepositories();
  }

  /**
   * Get context for a specific task
   */
  async getContextForTask(
    task: string,
    budget = 8000
  ): Promise<ContextPacket> {
    return this.planner.buildContextPacket(task, undefined, {
      budget,
      includeSymbols: true,
      includeTests: true,
      includeDecisions: true,
    });
  }

  /**
   * Get context for a file
   */
  async getContextForFile(fileId: string): Promise<{
    file: File | null;
    symbols: Symbol[];
    tests: any[];
    related: File[];
  }> {
    const fileResults = await this.db.query<File>(
      "SELECT * FROM files WHERE id = ?",
      [fileId]
    );
    const file = fileResults[0] || null;

    const symbols = await this.retriever.getFileSymbols(fileId);
    const tests = await this.retriever.getFileTests(fileId);
    const related = await this.retriever.getRelatedFiles(fileId);

    return { file, symbols, tests, related };
  }

  /**
   * Get dependencies for a repository
   */
  async getDependencies(repositoryId: string): Promise<any[]> {
    return this.retriever.getRepositoryDependencies(repositoryId);
  }

  /**
   * Get capabilities for a repository
   */
  async getCapabilities(repositoryId: string): Promise<Capability[]> {
    return this.retriever.getRepositoryCapabilities(repositoryId);
  }

  /**
   * Get decisions for a repository
   */
  async getDecisions(repositoryId: string): Promise<any[]> {
    return this.retriever.getRepositoryDecisions(repositoryId);
  }

  /**
   * Get all indexed information for a repository
   */
  async getRepositoryInfo(repositoryId: string): Promise<{
    repository: Repository | null;
    files: File[];
    dependencies: any[];
    capabilities: Capability[];
    decisions: any[];
  }> {
    const db = this.retriever.getDatabase();
    const repoResults = await db.query<Repository>(
      "SELECT * FROM repositories WHERE id = ?",
      [repositoryId]
    );
    const repository = repoResults[0] || null;

    const files = await this.retriever.getRepositoryFiles(repositoryId);
    const dependencies = await this.retriever.getRepositoryDependencies(repositoryId);
    const capabilities = await this.retriever.getRepositoryCapabilities(repositoryId);
    const decisions = await this.retriever.getRepositoryDecisions(repositoryId);

    return { repository, files, dependencies, capabilities, decisions };
  }

  /**
   * Export context as JSON (for integration with other systems)
   */
  async exportAsJSON(task?: string): Promise<string> {
    if (task) {
      const packet = await this.getContextForTask(task);
      return JSON.stringify(packet, null, 2);
    }

    const repos = await this.getRepositories();
    return JSON.stringify({ repositories: repos }, null, 2);
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.db.close();
  }
}

/**
 * Create Codex context from database
 */
export async function createCodexContext(db: Database): Promise<CodexContext> {
  return new CodexContext(db);
}

/**
 * Export context as injectable format for prompts
 */
export function formatContextForPrompt(packet: ContextPacket): string {
  let prompt = `## Engineering Context

**Task**: ${packet.task}

`;

  if (packet.repositories.length > 0) {
    prompt += `### Repositories\n`;
    for (const repo of packet.repositories) {
      prompt += `- **${repo.name}**: ${repo.full_name}\n`;
    }
    prompt += "\n";
  }

  if (packet.capabilities.length > 0) {
    prompt += `### Key Capabilities\n`;
    for (const cap of packet.capabilities) {
      prompt += `- **${cap.name}**: ${cap.description || "(no description)"}\n`;
    }
    prompt += "\n";
  }

  if (packet.files.length > 0) {
    prompt += `### Relevant Files\n`;
    for (const file of packet.files.slice(0, 5)) {
      prompt += `- ${file.path}`;
      if (file.language) {
        prompt += ` (${file.language})`;
      }
      prompt += "\n";
    }
    if (packet.files.length > 5) {
      prompt += `- ... and ${packet.files.length - 5} more files\n`;
    }
    prompt += "\n";
  }

  if (packet.symbols.length > 0) {
    prompt += `### Relevant Symbols\n`;
    for (const symbol of packet.symbols.slice(0, 5)) {
      prompt += `- **${symbol.name}** (${symbol.kind})\n`;
    }
    if (packet.symbols.length > 5) {
      prompt += `- ... and ${packet.symbols.length - 5} more symbols\n`;
    }
    prompt += "\n";
  }

  if (packet.decisions.length > 0) {
    prompt += `### Architectural Decisions\n`;
    for (const decision of packet.decisions) {
      prompt += `- **${decision.title}**: ${decision.decision || "(see details)"}\n`;
    }
    prompt += "\n";
  }

  return prompt;
}
