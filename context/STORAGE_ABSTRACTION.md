# Context Storage Abstraction

The Personal Engineering Context Fabric now provides a clean, provider-neutral storage abstraction layer that enables the AI control plane and other systems to work with any backing database.

## Overview

The `ContextStore` interface defines all operations for accessing and managing engineering context data:

```typescript
export interface ContextStore {
  // Repository operations
  getRepository(id: string): Promise<Repository | null>;
  listRepositories(): Promise<Repository[]>;
  createRepository(repo: Omit<Repository, "created_at" | "updated_at">): Promise<Repository>;
  updateRepository(id: string, updates: Partial<Repository>): Promise<Repository>;
  deleteRepository(id: string): Promise<void>;

  // File operations
  getFile(id: string): Promise<File | null>;
  listFilesByRepository(repositoryId: string): Promise<File[]>;
  // ... similar for Symbols, Dependencies, Relationships, etc.

  // Connection management
  close(): Promise<void>;
}
```

## Architecture

```
AI Control Plane
       │
       │ (uses)
       ▼
  ContextStore Interface
       │
       │ (implements)
       ├─→ SQLiteContextStore (legacy, for compatibility)
       └─→ PGliteContextStore (current default)
       │
       ▼
Database Backend
├─ PGlite (in-process PostgreSQL)
└─ SQLite (file-based)
```

## Using the ContextStore

### Getting a ContextStore Instance

```typescript
import { getContextStore } from "@station/context";

// Get the default ContextStore (currently PGlite)
const contextStore = await getContextStore();

// Use it...
const repos = await contextStore.listRepositories();

// Close when done
await closeContextStore();
```

### Repository Operations

```typescript
// Get a repository
const repo = await contextStore.getRepository("repo-id-123");

// List all repositories
const allRepos = await contextStore.listRepositories();

// Create a new repository
const newRepo = await contextStore.createRepository({
  id: "new-repo",
  name: "My Project",
  full_name: "owner/my-project",
  local_path: "/path/to/repo",
  default_branch: "main",
  status: "active",
});

// Update a repository
const updated = await contextStore.updateRepository("repo-id", {
  status: "indexed",
  language: "typescript",
});

// Delete a repository
await contextStore.deleteRepository("repo-id");
```

### File Operations

```typescript
// Get a file
const file = await contextStore.getFile("file-id-123");

// List files in a repository
const repoFiles = await contextStore.listFilesByRepository("repo-id");

// Create a file
const newFile = await contextStore.createFile({
  id: "file-123",
  repository_id: "repo-id",
  path: "src/index.ts",
  language: "typescript",
  size: 1024,
});

// Update a file
const updated = await contextStore.updateFile("file-123", {
  indexed_at: new Date(),
});

// Delete a file
await contextStore.deleteFile("file-123");
```

### Symbol Operations

```typescript
// Get a symbol (function, class, etc.)
const symbol = await contextStore.getSymbol("symbol-id");

// List symbols in a file
const fileSymbols = await contextStore.listSymbolsByFile("file-id");

// List symbols in a repository
const repoSymbols = await contextStore.listSymbolsByRepository("repo-id");

// Search symbols by name
const searchResults = await contextStore.searchSymbols("ClassName");

// Create a symbol
const newSymbol = await contextStore.createSymbol({
  id: "sym-123",
  file_id: "file-id",
  name: "myFunction",
  kind: "function",
  start_line: 10,
  end_line: 25,
  signature: "function myFunction(arg: string): Promise<void>",
});
```

### Other Operations

The ContextStore also provides operations for:
- **Dependencies**: Track module dependencies and imports
- **Relationships**: Generic relationships between entities
- **Capabilities**: Capabilities and technologies used in the project
- **Documents**: Documentation files and their content
- **Decisions**: Architectural decisions and rationales
- **Tests**: Test files and test information
- **Embeddings**: Vector embeddings for semantic search

## Implementing a New Storage Backend

To implement a new storage backend (e.g., MongoDB, PostgreSQL), create a class that implements `ContextStore`:

```typescript
import { ContextStore } from "@station/context";

export class MyCustomContextStore implements ContextStore {
  async getRepository(id: string): Promise<Repository | null> {
    // Implement using your database
  }

  async listRepositories(): Promise<Repository[]> {
    // Implement using your database
  }

  // ... implement all other methods

  async close(): Promise<void> {
    // Close connections
  }
}
```

Then register it in the factory:

```typescript
import { getContextStore, resetContextStore } from "@station/context";

// Customize the factory to use your implementation
export async function getCustomContextStore(): Promise<ContextStore> {
  // Your initialization logic
  return new MyCustomContextStore();
}
```

## Current Database: PGlite

PR6 replaces the SQLite backend with **PGlite**, an in-process PostgreSQL-compatible database:

### Advantages of PGlite:
- ✅ PostgreSQL-compatible SQL syntax
- ✅ In-process (no external dependencies)
- ✅ WASM-based (works in Node.js and browsers)
- ✅ Small footprint
- ✅ Strong typing with TypeScript support
- ✅ Great performance for local development

### Configuration

The database path is determined by:
1. `DEV_AI_CONTEXT_DB` environment variable (if set)
2. Default: `~/.dev-ai/context/context.db`

```bash
# Use custom database location
export DEV_AI_CONTEXT_DB=/path/to/custom.db
```

## Schema

The context schema includes tables for:
- `repositories` - Project metadata
- `workspaces` - Development workspace groupings
- `files` - Source files
- `symbols` - Code symbols (functions, classes, etc.)
- `dependencies` - Module dependencies
- `relationships` - Generic relationships between entities
- `capabilities` - Project capabilities and technologies
- `documents` - Documentation
- `decisions` - Architectural decisions
- `tests` - Test files and metadata
- `embeddings` - Vector embeddings

Plus indexes for optimal query performance.

## Migration Notes

### From SQLite to PGlite

PGlite is PostgreSQL-compatible, so:
- All SQL syntax is compatible
- Schema migrations work the same way
- Performance is comparable for local development
- Data format is slightly different (BYTEA vs BLOB)

The abstraction layer ensures the AI control plane code doesn't need to change.

### Future Migrations

With the ContextStore abstraction in place:
- Can migrate to real PostgreSQL without changing AI code
- Can implement multi-database strategies
- Can add caching layers transparently
- Can implement read replicas

## Best Practices

1. **Always use the abstraction**: Never import database drivers directly in AI code
2. **Close connections**: Always call `closeContextStore()` when done
3. **Error handling**: Handle null returns from "get" operations
4. **Batch operations**: Use list operations instead of looping get calls
5. **Timestamps**: Let the database handle `created_at` and `updated_at`
6. **Search**: Use `searchSymbols()` for name-based lookups

## Testing

For testing, you can create in-memory implementations:

```typescript
export class MockContextStore implements ContextStore {
  private data: Map<string, any> = new Map();

  async getRepository(id: string): Promise<Repository | null> {
    return this.data.get(`repo:${id}`) || null;
  }

  // ... implement all methods with in-memory storage
}
```

## See Also

- [AI Control Plane](../ai/README.md) - Uses ContextStore for context retrieval
- [Context System](./README.md) - The context system using ContextStore
