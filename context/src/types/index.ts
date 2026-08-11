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
  | "extends";

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
}

export interface ContextSource {
  source: string;
  type: SourceType;
  reason: string;
}
