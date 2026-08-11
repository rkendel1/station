/**
 * Context integration for the AI control plane
 * Uses the ContextStore abstraction to retrieve engineering context
 * PR7: Enhanced with live workspace context
 */

import {
  ContextStore,
  Repository,
  Capability,
  File,
  WorktreeDiff,
  ImpactAssessment,
  FreshnessStatus,
} from "@station/context";

export interface RelevantContext {
  repositories: Repository[];
  files: File[];
  capabilities: Capability[];
  technologiesUsed: string[];
  architecturePatterns: string[];
  // PR7: Enhanced context fields
  currentBranch?: string;
  currentCommit?: string;
  worktreeDiff?: WorktreeDiff;
  affectedSymbols?: string[];
  affectedTests?: string[];
  impactAssessment?: ImpactAssessment;
  freshnessStatus?: FreshnessStatus;
}

/**
 * PR7: Git state for context
 */
export interface GitContextState {
  branch: string;
  commit: string;
  isDirty: boolean;
  changedFiles: string[];
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

  /**
   * PR7: Retrieve context with live workspace state
   */
  async retrieveContextWithWorkspaceState(
    taskDescription: string,
    gitState?: GitContextState
  ): Promise<RelevantContext> {
    // Get base context
    const context = await this.retrieveContext(taskDescription);

    if (!gitState) {
      return context;
    }

    // Add git state to context
    context.currentBranch = gitState.branch;
    context.currentCommit = gitState.commit;

    // If there are uncommitted changes, add worktree diff
    if (gitState.isDirty && gitState.changedFiles.length > 0) {
      const repositories = await this.contextStore.listRepositories();
      const primaryRepo = repositories[0];

      if (primaryRepo) {
        context.worktreeDiff = {
          repositoryId: primaryRepo.id,
          indexedCommit: primaryRepo.last_indexed_at?.toISOString() || "",
          currentCommit: gitState.commit,
          isDirty: gitState.isDirty,
          uncommittedFiles: gitState.changedFiles.length,
          changedSymbols: [], // Would need symbol analysis
          affectedCapabilities: [],
          affectedTests: [],
        };

        // Estimate impact
        context.impactAssessment = this.estimateImpact(
          gitState.changedFiles.length
        );
      }
    }

    return context;
  }

  /**
   * PR7: Estimate impact from changed file count
   */
  private estimateImpact(changedFileCount: number): ImpactAssessment {
    let complexity: "LOW" | "MEDIUM" | "HIGH" = "LOW";
    if (changedFileCount > 20) {
      complexity = "HIGH";
    } else if (changedFileCount > 5) {
      complexity = "MEDIUM";
    }

    return {
      symbolCount: changedFileCount * 5, // Rough estimate
      testCount: Math.ceil(changedFileCount / 3),
      capabilityCount: Math.ceil(changedFileCount / 10),
      repositoryCount: 1,
      moduleCount: changedFileCount,
      databaseCount: 0,
      crossRepositoryImpact: false,
      workingTreeComplexity: complexity,
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
