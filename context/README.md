# Personal Engineering Context Fabric (PR5)

## Overview

The Personal Engineering Context Fabric is a local-first, persistent system for maintaining and accessing engineering context about your repositories. It enables AI coding agents like Codex to understand your workspace structure, dependencies, capabilities, and architectural decisions without requiring the entire repository to be sent to the model each time.

## Architecture

```
Repositories
     ↓
Context Indexer
     ↓
SQLite Database (~/.dev-ai/context/context.db)
 ┌───────────────────────────────────┐
 │ Repositories, Files, Symbols      │
 │ Dependencies, Relationships       │
 │ Capabilities, Decisions, Tests    │
 │ Documents, Embeddings             │
 └───────────────────────────────────┘
     ↓
Context Retrieval & Ranking
     ↓
Context Planner
     ↓
Context Packet
     ↓
Codex / AI Coding Agent
```

## Quick Start

### 1. Initialize the Database

```bash
dev context init
```

Creates the local database at `~/.dev-ai/context/context.db`.

### 2. Index Your Repositories

```bash
dev context index /path/to/workspace
```

Discovers and indexes all git repositories in the path.

### 3. Search for Context

```bash
dev context search "authentication"
```

Searches for symbols, files, and repositories matching your query.

### 4. Explain Context for a Task

```bash
dev context explain "Add OAuth support to the API"
```

Shows what context would be provided to Codex for this task.

## CLI Commands

### `dev context init`

Initialize the engineering context database.

**Options:**
- None

**Example:**
```bash
dev context init
```

### `dev context status`

Show the status of the context database.

**Options:**
- None

**Example:**
```bash
dev context status
```

Output includes:
- Database location
- Initialization status
- File size
- Last modification time

### `dev context index [path]`

Index repositories and update the context database.

**Options:**
- `-f, --force`: Force full re-indexing (skip cache)
- `--symbols`: Include symbol extraction (default: true)
- `--tests`: Include test discovery (default: true)

**Example:**
```bash
dev context index /home/user/projects --force
dev context index . --symbols --tests
```

### `dev context search <query>`

Search for symbols, files, and repositories.

**Options:**
- `-t, --type <type>`: Search type (symbols, files, repositories, all)

**Example:**
```bash
dev context search "authenticate"
dev context search "jwt" --type symbols
dev context search "middleware" --type files
```

### `dev context explain <task>`

Explain what context would be selected for a task.

**Options:**
- `-b, --budget <budget>`: Token budget (default: 8000)

**Example:**
```bash
dev context explain "Add rate limiting to API"
dev context explain "Fix authentication bug" --budget 4000
```

## Workspace Configuration

Create a `.dev-ai/context.yaml` file in your workspace root:

```yaml
workspace:
  name: my-project
  repositories:
    - ./backend
    - ./frontend
    - ./shared

context:
  database: ~/.dev-ai/context/context.db
  embeddings: false
  watch: false

exclude:
  - node_modules
  - dist
  - build
  - .env*
  - __pycache__

include_symbols: true
include_tests: true

secret_patterns:
  - password
  - api_key
  - token
  - secret
```

## Database Schema

The context system stores:

- **Repositories**: Git repository metadata
- **Files**: Source code files with language detection
- **Symbols**: Functions, classes, methods, types (extracted via AST)
- **Dependencies**: Package dependencies from package.json, Cargo.toml, etc.
- **Relationships**: Connections between entities (imports, contains, depends_on, etc.)
- **Capabilities**: High-level capabilities exposed by repositories
- **Documents**: Markdown files, READMEs, architecture docs
- **Decisions**: Recorded architectural decisions
- **Tests**: Test files and test cases
- **Embeddings**: Semantic embeddings for similarity search (future)

## Privacy & Security

The context system respects your privacy:

- ✓ Local storage only (no cloud upload)
- ✓ Secret detection and redaction (passwords, tokens, keys)
- ✓ .gitignore respect
- ✓ Exclusion of sensitive files (.env, .aws, .ssh, etc.)
- ✓ Configurable exclusion patterns

### Secret Redaction

The system automatically detects and redacts:
- API keys and tokens
- Passwords
- Private keys
- Database URLs
- GitHub tokens
- AWS credentials

If secrets are detected during indexing, they're marked as redacted and not stored.

## Codex Integration

### Using Context with Codex

The Personal Engineering Context integrates seamlessly with Codex:

```javascript
import { getDatabase } from "@station/context";
import { CodexContext, formatContextForPrompt } from "@station/context/integrations/codex";

const db = await getDatabase();
const codexContext = new CodexContext(db);

// Get context for a task
const contextPacket = await codexContext.getContextForTask(
  "Add authentication to the API",
  8000  // token budget
);

// Format for injection into prompt
const promptContext = formatContextForPrompt(contextPacket);

// Use with Codex
const completion = await codex.complete(promptContext + userPrompt);
```

### Context Packet Format

```javascript
{
  task: "Add authentication to the API",
  repositories: [...],
  instructions: [...],
  architecture: [...],
  files: [...],
  symbols: [...],
  dependencies: [...],
  capabilities: [...],
  tests: [...],
  decisions: [...],
  history: [...],
  sources: [
    {
      source: "project-a/src/auth/service.ts",
      type: "OBSERVED",
      reason: "directly referenced by authentication capability"
    }
  ]
}
```

## Context Retrieval

The system uses multi-strategy retrieval:

1. **Exact Match**: Direct symbol, file, or repository name matches
2. **Graph Traversal**: Follows dependency relationships
3. **Semantic Search**: Similarity-based matching (future)
4. **Ranking**: Combines:
   - Exact relevance
   - Proximity in dependency graph
   - Repository relevance
   - Path relevance
   - Recency
   - Source confidence

## Source Classification

Every indexed fact is classified by source:

- **OBSERVED**: Structural fact from code analysis (imports, exports, dependencies)
- **DECLARED**: Explicit metadata (package.json, AGENTS.md, comments)
- **INFERRED**: Derived from analysis (potential consumers, related capabilities)
- **LEARNED**: Human-provided context (architectural decisions, notes)

## Token Budgeting

The context planner respects token budgets:

```bash
dev context explain "Add feature" --budget 4000
```

The planner prioritizes context within the budget:
1. Repositories (highest priority)
2. Capabilities
3. Relevant files
4. Symbols
5. Decisions
6. Tests

## Performance

- **Index Speed**: ~50-100 files/second
- **Search Latency**: <50ms for 1000+ items
- **Database Size**: ~0.5-1MB per 1000 files indexed
- **Memory**: <100MB runtime

## Troubleshooting

### Database not found

```bash
dev context init
```

### Repositories not discovered

Check that they contain `.git` directories:

```bash
dev context index /path/to/workspace -v
```

### No search results

Verify repositories are indexed:

```bash
dev context status
dev context index /path/to/workspace
```

### Slow indexing

For large repositories, exclude non-essential directories:

```yaml
exclude:
  - node_modules
  - .git
  - dist
  - build
  - __pycache__
  - .venv
```

## Development

### Building

```bash
cd context
npm install
npm run build
```

### Testing

```bash
npm test
```

### TypeScript Compilation

```bash
npm run type-check
```

## Contributing

The context system is designed to be extended:

- **Indexers**: Add support for new languages and package managers
- **Retrievers**: Implement new search strategies
- **Integrations**: Connect to other tools and agents

## Future Work

- Semantic search with embeddings (pgvector)
- Incremental indexing (watch mode)
- Caching layer
- Multi-workspace support
- Web UI for context exploration
- Export to various formats (JSON, markdown, etc.)

## References

- Problem Statement: PR5 — Personal Engineering Context Fabric
- Database: SQLite (PGlite compatible)
- Package Manager: npm with pnpm
- Language: TypeScript
- CLI: Commander.js
