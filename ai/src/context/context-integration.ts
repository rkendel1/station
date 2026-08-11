/**
 * Context integration for the AI control plane
 * Uses the ContextStore abstraction to retrieve engineering context
 */

import { ContextStore, Repository, Capability, File } from "@station/context";

export interface RelevantContext {
  repositories: Repository[];
  files: File[];
  capabilities: Capability[];
  technologiesUsed: string[];
  architecturePatterns: string[];
}

export class ContextIntegration {
  constructor(private contextStore: ContextStore) {}

  /**
   * Retrieve relevant engineering context for a task
   */
  async retrieveContext(taskDescription: string): Promise<RelevantContext> {
    // Get all repositories
    const repositories = await this.contextStore.listRepositories();

    if (repositories.length === 0) {
      return {
        repositories: [],
        files: [],
        capabilities: [],
        technologiesUsed: [],
        architecturePatterns: [],
      };
    }

    // Get files and capabilities from primary repository
    const primaryRepo = repositories[0];
    const files = await this.contextStore.listFilesByRepository(primaryRepo.id);
    const capabilities = await this.contextStore.listCapabilitiesByRepository(primaryRepo.id);

    // Extract technology patterns
    const technologiesUsed = this.extractTechnologies(files, capabilities);
    const architecturePatterns = this.extractArchitecturePatterns(capabilities);

    return {
      repositories,
      files: files.slice(0, 20), // Limit to top 20 files
      capabilities,
      technologiesUsed,
      architecturePatterns,
    };
  }

  private extractTechnologies(files: File[], capabilities: Capability[]): string[] {
    const techs: Set<string> = new Set();

    // Extract from file languages
    const languages = new Set(files.map((f) => f.language).filter((l) => l));
    languages.forEach((lang) => {
      if (lang) techs.add(lang);
    });

    // Extract from capabilities
    capabilities.forEach((cap) => {
      if (cap.category === "framework") techs.add(cap.name);
      if (cap.category === "technology") techs.add(cap.name);
    });

    return Array.from(techs);
  }

  private extractArchitecturePatterns(capabilities: Capability[]): string[] {
    return capabilities
      .filter((cap) => cap.category === "architecture" || cap.category === "pattern")
      .map((cap) => cap.name);
  }
}
