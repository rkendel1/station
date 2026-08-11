/**
 * Database schema and initialization
 */

export const SCHEMA_VERSION = 2;

/**
 * Initialize schema versioning table (works with both SQLite and PGlite)
 */
export const SCHEMA_INIT_SQL = `
CREATE TABLE IF NOT EXISTS schema_version (
  id INTEGER PRIMARY KEY,
  version INTEGER NOT NULL,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

export const migrations = {
  "1": `${SCHEMA_INIT_SQL}

-- Repositories table
CREATE TABLE IF NOT EXISTS repositories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  full_name TEXT UNIQUE NOT NULL,
  remote_url TEXT,
  local_path TEXT NOT NULL,
  default_branch TEXT DEFAULT 'main',
  language TEXT,
  framework TEXT,
  package_manager TEXT,
  status TEXT CHECK(status IN ('active', 'archived', 'indexed', 'failed')) DEFAULT 'active',
  last_indexed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Workspace repositories association
CREATE TABLE IF NOT EXISTS workspace_repositories (
  workspace_id TEXT NOT NULL,
  repository_id TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  PRIMARY KEY (workspace_id, repository_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
);

-- Files table
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL,
  path TEXT NOT NULL,
  language TEXT,
  size INTEGER,
  hash TEXT,
  last_modified TIMESTAMP,
  indexed_at TIMESTAMP,
  UNIQUE(repository_id, path),
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
);

-- Symbols table (functions, classes, methods, etc.)
CREATE TABLE IF NOT EXISTS symbols (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  qualified_name TEXT,
  start_line INTEGER,
  end_line INTEGER,
  signature TEXT,
  summary TEXT,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- Dependencies table
CREATE TABLE IF NOT EXISTS dependencies (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL,
  source TEXT NOT NULL,
  target TEXT NOT NULL,
  dependency_type TEXT,
  version TEXT,
  resolved_path TEXT,
  UNIQUE(repository_id, source, target),
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
);

-- Generic relationships table
CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  relationship TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  source TEXT CHECK(source IN ('OBSERVED', 'DECLARED', 'INFERRED', 'LEARNED')) DEFAULT 'OBSERVED',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Capabilities table
CREATE TABLE IF NOT EXISTS capabilities (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  confidence REAL DEFAULT 1.0,
  source TEXT CHECK(source IN ('OBSERVED', 'DECLARED', 'INFERRED', 'LEARNED')) DEFAULT 'OBSERVED',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL,
  path TEXT NOT NULL,
  document_type TEXT,
  title TEXT,
  content_hash TEXT,
  summary TEXT,
  indexed_at TIMESTAMP,
  UNIQUE(repository_id, path),
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
);

-- Decisions table
CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL,
  title TEXT NOT NULL,
  decision TEXT,
  rationale TEXT,
  status TEXT,
  source TEXT CHECK(source IN ('OBSERVED', 'DECLARED', 'INFERRED', 'LEARNED')) DEFAULT 'LEARNED',
  confidence REAL DEFAULT 1.0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
);

-- Tests table
CREATE TABLE IF NOT EXISTS tests (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL,
  file_id TEXT,
  name TEXT NOT NULL,
  framework TEXT,
  target TEXT,
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL
);

-- Embeddings table (for semantic search)
CREATE TABLE IF NOT EXISTS embeddings (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  content TEXT,
  embedding BYTEA,
  model TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_files_repository ON files(repository_id);
CREATE INDEX IF NOT EXISTS idx_files_language ON files(language);
CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id);
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind);
CREATE INDEX IF NOT EXISTS idx_dependencies_repository ON dependencies(repository_id);
CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_capabilities_repository ON capabilities(repository_id);
CREATE INDEX IF NOT EXISTS idx_documents_repository ON documents(repository_id);
CREATE INDEX IF NOT EXISTS idx_decisions_repository ON decisions(repository_id);
CREATE INDEX IF NOT EXISTS idx_tests_repository ON tests(repository_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_entity ON embeddings(entity_type, entity_id);
`,

  "2": `
-- PR7: Live Engineering Graph & Incremental Workspace Intelligence

-- Enhanced workspaces with watch status
ALTER TABLE workspaces ADD COLUMN watch_status TEXT DEFAULT 'stopped' CHECK(watch_status IN ('active', 'paused', 'stopped'));
ALTER TABLE workspaces ADD COLUMN last_update TIMESTAMP;
ALTER TABLE workspaces ADD COLUMN index_queue INTEGER DEFAULT 0;

-- Enhanced workspace_repositories with git state tracking
ALTER TABLE workspace_repositories ADD COLUMN git_remote TEXT;
ALTER TABLE workspace_repositories ADD COLUMN default_branch TEXT DEFAULT 'main';
ALTER TABLE workspace_repositories ADD COLUMN current_branch TEXT;
ALTER TABLE workspace_repositories ADD COLUMN commit_sha TEXT;
ALTER TABLE workspace_repositories ADD COLUMN last_indexed_commit TEXT;
ALTER TABLE workspace_repositories ADD COLUMN watch_status TEXT DEFAULT 'stopped' CHECK(watch_status IN ('active', 'paused', 'stopped'));

-- Git state tracking table
CREATE TABLE IF NOT EXISTS git_states (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL,
  head TEXT NOT NULL,
  branch TEXT NOT NULL,
  remote TEXT,
  commit_sha TEXT NOT NULL,
  is_dirty BOOLEAN DEFAULT false,
  changed_files TEXT,
  staged_files TEXT,
  unstaged_files TEXT,
  untracked_files TEXT,
  captured_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
);

-- Context freshness tracking
CREATE TABLE IF NOT EXISTS context_freshness (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  source_commit TEXT NOT NULL,
  source_file_hash TEXT,
  freshness_status TEXT CHECK(freshness_status IN ('CURRENT', 'STALE', 'INVALID', 'UNKNOWN')) DEFAULT 'CURRENT',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entity_type, entity_id)
);

-- Context snapshots for commits
CREATE TABLE IF NOT EXISTS context_snapshots (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  snapshot_number INTEGER NOT NULL,
  symbol_count INTEGER DEFAULT 0,
  file_count INTEGER DEFAULT 0,
  capability_count INTEGER DEFAULT 0,
  relationship_count INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(repository_id, commit_sha),
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
);

-- Context events log
CREATE TABLE IF NOT EXISTS context_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK(event_type IN (
    'FILE_CHANGED', 'FILE_ADDED', 'FILE_DELETED',
    'COMMIT_CHANGED', 'BRANCH_CHANGED', 'DEPENDENCY_CHANGED',
    'SYMBOL_CHANGED', 'CAPABILITY_CHANGED', 'INDEX_COMPLETED',
    'CONTEXT_INVALIDATED'
  )),
  repository_id TEXT,
  entity_type TEXT,
  entity_id TEXT,
  data TEXT,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
);

-- Capability evidence mapping
CREATE TABLE IF NOT EXISTS capability_evidence (
  id TEXT PRIMARY KEY,
  capability_id TEXT NOT NULL,
  evidence_type TEXT NOT NULL CHECK(evidence_type IN ('IMPLEMENTED_BY', 'CONFIGURED_BY', 'TESTED_BY', 'DOCUMENTED_BY', 'DEPENDS_ON')),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (capability_id) REFERENCES capabilities(id) ON DELETE CASCADE
);

-- Enhanced relationships with provenance
ALTER TABLE relationships ADD COLUMN evidence_file TEXT;
ALTER TABLE relationships ADD COLUMN evidence_line INTEGER;

-- Enhanced files with change tracking
ALTER TABLE files ADD COLUMN change_type TEXT CHECK(change_type IN ('SOURCE', 'TEST', 'CONFIGURATION', 'DEPENDENCY', 'DOCUMENTATION', 'SCHEMA', 'MIGRATION', 'BUILD', 'INFRASTRUCTURE', 'UNKNOWN'));

-- Indexes for PR7 tables
CREATE INDEX IF NOT EXISTS idx_git_states_repository ON git_states(repository_id);
CREATE INDEX IF NOT EXISTS idx_context_freshness_entity ON context_freshness(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_context_freshness_status ON context_freshness(freshness_status);
CREATE INDEX IF NOT EXISTS idx_context_snapshots_repository ON context_snapshots(repository_id);
CREATE INDEX IF NOT EXISTS idx_context_snapshots_commit ON context_snapshots(commit_sha);
CREATE INDEX IF NOT EXISTS idx_context_events_type ON context_events(event_type);
CREATE INDEX IF NOT EXISTS idx_context_events_repository ON context_events(repository_id);
CREATE INDEX IF NOT EXISTS idx_context_events_timestamp ON context_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_capability_evidence_capability ON capability_evidence(capability_id);
CREATE INDEX IF NOT EXISTS idx_capability_evidence_target ON capability_evidence(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_files_change_type ON files(change_type);
`,
};

export function getMigrationSQL(version: number): string | null {
  const key = String(version);
  return migrations[key as keyof typeof migrations] || null;
}
