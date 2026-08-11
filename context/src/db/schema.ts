/**
 * Database schema and initialization
 */

export const SCHEMA_VERSION = 1;

export const migrations = {
  "1": `
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
  embedding BLOB,
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
};

export function getMigrationSQL(version: number): string | null {
  const key = String(version);
  return migrations[key as keyof typeof migrations] || null;
}
