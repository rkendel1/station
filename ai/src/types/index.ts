/**
 * Core types for the AI Execution Control Plane
 */

/**
 * Task classification levels
 */
export enum TaskComplexity {
  SIMPLE = "simple",
  MODERATE = "moderate",
  COMPLEX = "complex",
  FRONTIER = "frontier",
}

/**
 * Task category for routing decisions
 */
export enum TaskCategory {
  BUG_FIX = "bug_fix",
  FEATURE = "feature",
  REFACTOR = "refactor",
  TEST = "test",
  DOCUMENTATION = "documentation",
  INFRASTRUCTURE = "infrastructure",
  OPTIMIZATION = "optimization",
  UNKNOWN = "unknown",
}

/**
 * Model provider types
 */
export enum ModelProviderType {
  QWEN_CODER = "qwen-coder",
  FRONTIER_API = "frontier-api",
  LOCAL = "local",
}

/**
 * Task classification result
 */
export interface TaskClassification {
  category: TaskCategory;
  complexity: TaskComplexity;
  confidence: number;
  reasoning: string;
  estimatedTokens: number;
  requiredCapabilities: string[];
  // PR7: Impact-based classification enhancements
  impactAssessment?: {
    symbolCount: number;
    testCount: number;
    capabilityCount: number;
    repositoryCount: number;
    crossRepositoryImpact: boolean;
    workingTreeComplexity: "LOW" | "MEDIUM" | "HIGH";
  };
}

/**
 * Model information
 */
export interface Model {
  id: string;
  name: string;
  provider: ModelProviderType;
  costPer1kTokens: number;
  maxContextLength: number;
  capabilities: string[];
  available: boolean;
  recommendedForComplexity: TaskComplexity[];
}

/**
 * Routing decision
 */
export interface RoutingDecision {
  selectedModel: Model;
  alternativeModels: Model[];
  estimatedCost: number;
  confidence: number;
  reasoning: string;
  shouldEscalate: boolean;
  // PR7: Context-aware routing enhancements
  contextFreshness?: "CURRENT" | "STALE" | "INVALID" | "UNKNOWN";
  graphSize?: number;
  affectedComponentCount?: number;
}

/**
 * Execution context
 */
export interface ExecutionContext {
  taskId: string;
  task: string;
  classification: TaskClassification;
  routing: RoutingDecision;
  maxRetries: number;
  currentRetry: number;
  timestamp: Date;
  // PR7: Workspace context
  currentBranch?: string;
  currentCommit?: string;
  worktreeState?: "clean" | "dirty";
}

/**
 * Execution result
 */
export interface ExecutionResult {
  taskId: string;
  success: boolean;
  output: string;
  model: Model;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  cost: number;
  validationPassed: boolean;
  validationFeedback: string;
  duration: number;
  escalated: boolean;
}

/**
 * Cost tracking record
 */
export interface CostRecord {
  id: string;
  taskId: string;
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
  costPerToken: number;
  totalCost: number;
  timestamp: Date;
}

/**
 * Execution history entry
 */
export interface HistoryEntry {
  id: string;
  taskId: string;
  timestamp: Date;
  action: string;
  result: string;
  metadata: Record<string, unknown>;
}
