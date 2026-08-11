/**
 * PR7: Workspace module - Live Engineering Graph & Incremental Workspace Intelligence
 */

// Core workspace management
export {
  WorkspaceManager,
  createWorkspaceManager,
  type WorkspaceManagerOptions,
  type RepositoryRegistration,
  type WorkspaceStatus,
} from "./workspace-manager.js";

// Change classification
export {
  classifyChange,
  createFileChange,
  isDependencyFile,
  isLockfile,
  getChangeTypeDescription,
  classifyChanges,
  groupChangesByType,
} from "./change-classifier.js";

// Git state tracking
export {
  getGitState,
  getCurrentCommit,
  getCurrentBranch,
  isDirty,
  getDiff,
  getChangedFilesSinceCommit,
  getRemoteUrl,
  getDefaultBranch,
  compareGitStates,
  generateStableRepoId,
  type GitStateOptions,
} from "./git-tracker.js";

// Filesystem watching
export {
  WorkspaceWatcher,
  MultiRepositoryWatcher,
  createWatcher,
  type WatcherOptions,
  type FileChangeBatch,
} from "./watcher.js";

// Event system
export {
  ContextEventEmitter,
  ContextEvents,
  getGlobalEventEmitter,
  resetGlobalEventEmitter,
  type EventListener,
  type EventSubscription,
} from "./events.js";

// Incremental indexing
export {
  IncrementalIndexer,
  createIncrementalIndexer,
  type IncrementalIndexerOptions,
  type IndexResult,
} from "./incremental-indexer.js";

// Context freshness
export {
  FreshnessTracker,
  createFreshnessTracker,
  type FreshnessRecord,
} from "./freshness-tracker.js";

// Engineering graph
export {
  EngineeringGraph,
  createEngineeringGraph,
  type NodeType,
  type GraphRelationship,
  type GraphQueryOptions,
  type GraphTraversalResult,
} from "./engineering-graph.js";

// Context snapshots
export {
  SnapshotManager,
  createSnapshotManager,
  type SnapshotDiff,
} from "./snapshot-manager.js";

// Context cache
export {
  ContextCache,
  getGlobalCache,
  resetGlobalCache,
  type ContextCacheOptions,
} from "./context-cache.js";
