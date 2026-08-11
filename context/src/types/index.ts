/**
 * Common types for the context system
 */

export type SourceType = "OBSERVED" | "DECLARED" | "INFERRED" | "LEARNED";

export type RepositoryStatus = "active" | "archived" | "indexed" | "failed";

export type SymbolKind =
  | "function"
  | "class"
  | "method"
  | "property"
  | "variable"
  | "enum"
  | "interface"
  | "type"
  | "constant";

export type RelationshipType =
  | "contains"
  | "depends_on"
  | "imports"
  | "defines"
  | "tests"
  | "exposes"
  | "consumes"
  | "references"
  | "implements"
  | "extends"
  | "calls"
  | "uses"
  | "exports"
  | "configures"
  | "documents"
  | "generates"
  | "produces"
  | "tested_by";

/**
 * PR7: Change classification types
 */
export type ChangeType =
  | "SOURCE"
  | "TEST"
  | "CONFIGURATION"
  | "DEPENDENCY"
  | "DOCUMENTATION"
  | "SCHEMA"
  | "MIGRATION"
  | "BUILD"
  | "INFRASTRUCTURE"
  | "UNKNOWN";

/**
 * PR7: Context freshness status
 */
export type FreshnessStatus = "CURRENT" | "STALE" | "INVALID" | "UNKNOWN";

/**
 * PR7: Context change event types
 */
export type ContextEventType =
  | "FILE_CHANGED"
  | "FILE_ADDED"
  | "FILE_DELETED"
  | "COMMIT_CHANGED"
  | "BRANCH_CHANGED"
  | "DEPENDENCY_CHANGED"
  | "SYMBOL_CHANGED"
  | "CAPABILITY_CHANGED"
  | "INDEX_COMPLETED"
  | "CONTEXT_INVALIDATED";

/**
 * PR7: Git state tracking
 */
export interface GitState {
  head: string;
  branch: string;
  remote?: string;
  commitSha: string;
  isDirty: boolean;
  changedFiles: string[];
  stagedFiles: string[];
  unstagedFiles: string[];
  untrackedFiles: string[];
}

/**
 * PR7: Workspace state with live tracking
 */
export interface WorkspaceState {
  id: string;
  name: string;
  path: string;
  repositories: WorkspaceRepository[];
  watchStatus: "active" | "paused" | "stopped";
  lastUpdate: Date;
  indexQueue: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * PR7: Repository within a workspace
 */
export interface WorkspaceRepository {
  id: string;
  repositoryId: string;
  absolutePath: string;
  relativePath: string;
  gitRemote?: string;
  defaultBranch: string;
  currentBranch: string;
  commitSha: string;
  lastIndexedCommit?: string;
  watchStatus: "active" | "paused" | "stopped";
  language?: string;
  packageManager?: string;
  framework?: string;
  active: boolean;
}

/**
 * PR7: Classified file change
 */
export interface FileChange {
  path: string;
  type: "add" | "change" | "unlink";
  changeType: ChangeType;
  timestamp: Date;
}

/**
 * PR7: Context freshness tracking
 */
export interface ContextFreshness {
  id: string;
  entityType: string;
  entityId: string;
  sourceCommit: string;
  sourceFileHash?: string;
  freshnessStatus: FreshnessStatus;
  created_at: Date;
  updated_at: Date;
}

/**
 * PR7: Context snapshot for commits
 */
export interface ContextSnapshot {
  id: string;
  repositoryId: string;
  commitSha: string;
  snapshotNumber: number;
  symbolCount: number;
  fileCount: number;
  capabilityCount: number;
  relationshipCount: number;
  created_at: Date;
}

/**
 * PR7: Context change event
 */
export interface ContextEvent {
  id: string;
  eventType: ContextEventType;
  repositoryId?: string;
  entityType?: string;
  entityId?: string;
  data?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * PR7: Capability with implementation evidence
 */
export interface CapabilityEvidence {
  capabilityId: string;
  implementedBy: string[];
  configuredBy: string[];
  testedBy: string[];
  documentedBy: string[];
  dependencies: string[];
}

/**
 * PR7: Working tree diff context
 */
export interface WorktreeDiff {
  repositoryId: string;
  indexedCommit: string;
  currentCommit: string;
  isDirty: boolean;
  uncommittedFiles: number;
  changedSymbols: string[];
  affectedCapabilities: string[];
  affectedTests: string[];
}

/**
 * PR7: Context explain result
 */
export interface ContextExplanation {
  task: string;
  relevantRepositories: string[];
  relevantCapabilities: CapabilityEvidence[];
  relevantComponents: string[];
  relevantTests: string[];
  dependencies: string[];
  architecture: string;
  confidence: number;
  evidenceCounts: {
    observed: number;
    declared: number;
    inferred: number;
  };
}

/**
 * PR7: Impact assessment for routing
 */
export interface ImpactAssessment {
  symbolCount: number;
  testCount: number;
  capabilityCount: number;
  repositoryCount: number;
  moduleCount: number;
  databaseCount: number;
  crossRepositoryImpact: boolean;
  workingTreeComplexity: "LOW" | "MEDIUM" | "HIGH";
}

export interface Repository {
  id: string;
  name: string;
  full_name: string;
  remote_url?: string;
  local_path: string;
  default_branch: string;
  language?: string;
  framework?: string;
  package_manager?: string;
  status: RepositoryStatus;
  last_indexed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Workspace {
  id: string;
  name: string;
  path: string;
  created_at: Date;
  updated_at: Date;
}

export interface File {
  id: string;
  repository_id: string;
  path: string;
  language?: string;
  size?: number;
  hash?: string;
  last_modified?: Date;
  indexed_at?: Date;
}

export interface Symbol {
  id: string;
  file_id: string;
  name: string;
  kind: SymbolKind;
  qualified_name?: string;
  start_line?: number;
  end_line?: number;
  signature?: string;
  summary?: string;
}

export interface Dependency {
  id: string;
  repository_id: string;
  source: string;
  target: string;
  dependency_type?: string;
  version?: string;
  resolved_path?: string;
}

export interface Relationship {
  id: string;
  source_type: string;
  source_id: string;
  relationship: RelationshipType;
  target_type: string;
  target_id: string;
  confidence: number;
  source: SourceType;
  created_at: Date;
  updated_at: Date;
}

export interface Capability {
  id: string;
  repository_id: string;
  name: string;
  description?: string;
  category?: string;
  confidence: number;
  source: SourceType;
  created_at: Date;
  updated_at: Date;
}

export interface Document {
  id: string;
  repository_id: string;
  path: string;
  document_type?: string;
  title?: string;
  content_hash?: string;
  summary?: string;
  indexed_at?: Date;
}

export interface Decision {
  id: string;
  repository_id: string;
  title: string;
  decision?: string;
  rationale?: string;
  status?: string;
  source: SourceType;
  confidence: number;
  created_at: Date;
  updated_at: Date;
}

export interface TestRecord {
  id: string;
  repository_id: string;
  file_id?: string;
  name: string;
  framework?: string;
  target?: string;
}

export interface Embedding {
  id: string;
  entity_type: string;
  entity_id: string;
  content?: string;
  embedding?: Buffer;
  model?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ContextPacket {
  task: string;
  repositories: Repository[];
  instructions: string[];
  architecture: string[];
  files: File[];
  symbols: Symbol[];
  dependencies: Dependency[];
  capabilities: Capability[];
  tests: TestRecord[];
  decisions: Decision[];
  history: string[];
  sources: ContextSource[];
  // PR7: Extended context
  currentBranch?: string;
  currentCommit?: string;
  worktreeDiff?: WorktreeDiff;
  affectedSymbols?: string[];
  affectedTests?: string[];
  relevantCapabilities?: string[];
  freshnessStatus?: FreshnessStatus;
  impactAssessment?: ImpactAssessment;
}

export interface ContextSource {
  source: string;
  type: SourceType;
  reason: string;
  evidence?: {
    file?: string;
    line?: number;
    confidence?: number;
  };
}
