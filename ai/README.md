# AI Execution Control Plane

The AI Execution Control Plane (AIECP) is an intelligent routing and execution system that:

1. **Understands coding requests** through task classification
2. **Retrieves relevant engineering context** via the ContextStore abstraction
3. **Selects the optimal model** using cost/capability analysis
4. **Executes the task** through the selected model provider
5. **Validates results** with category-specific quality checks
6. **Escalates intelligently** when evidence indicates the model is struggling
7. **Tracks costs and outcomes** for continuous optimization
8. **Explains every decision** with complete audit trails

## Architecture

```
Developer Request
       │
       ▼
┌─────────────────────────┐
│  Task Classifier        │  ← Determines category & complexity
├─────────────────────────┤
│  Context Integration    │  ← Retrieves engineering context
├─────────────────────────┤
│  Model Router           │  ← Selects cheapest qualified model
├─────────────────────────┤
│  Execution Engine       │  ← Runs task through provider
├─────────────────────────┤
│  Result Validator       │  ← Validates output quality
├─────────────────────────┤
│  Escalation Strategy    │  ← Decides on retry/escalation
└─────────────────────────┘
       │
       ├── Cost Tracker (records every execution)
       ├── Execution History (audit log)
       └── Control Plane Orchestrator
              │
              ▼
          Model Providers
          ├── Qwen3-Coder-30B (cheap, capable)
          └── Frontier Models (expensive, most capable)
```

## Core Components

### Task Classifier (`classifier/task-classifier.ts`)

Analyzes incoming coding requests to:
- Classify into categories (bug_fix, feature, refactor, test, documentation, infrastructure, optimization)
- Assess complexity (SIMPLE → MODERATE → COMPLEX → FRONTIER)
- Identify required capabilities (testing, security, performance, etc.)
- Estimate token requirements

```typescript
const classifier = new TaskClassifier(contextStore);
const classification = await classifier.classify({
  task: "Fix the bug in the authentication module",
  repositoryContext: "..."
});
// Returns: { category: "bug_fix", complexity: "moderate", ... }
```

### Model Router (`router/model-router.ts`)

Selects the optimal model following the principle:
**"Use the cheapest qualified model that can reliably complete the task"**

```typescript
const router = new ModelRouter(providerRegistry);
const decision = await router.route(classification);
// Returns: { selectedModel, alternativeModels, estimatedCost, shouldEscalate, reasoning }
```

### Execution Engine (`execution/execution-engine.ts`)

Executes tasks through the selected model provider:
- Builds contextual prompts from task + engineering context
- Calls the model provider API
- Tracks tokens and costs
- Returns structured results

```typescript
const engine = new ExecutionEngine(modelProvider, contextStore);
const result = await engine.execute(executionContext);
// Returns: { success, output, model, tokensUsed, cost, validationPassed, ... }
```

### Result Validator (`validation/result-validator.ts`)

Validates execution output with category-specific checks:
- **Bug fixes**: Checks for problem/solution patterns
- **Tests**: Validates test framework syntax
- **All categories**: Checks for common error indicators

```typescript
const validator = new ResultValidator();
const validation = validator.validate(result, TaskCategory.BUG_FIX);
// Returns: { passed: boolean, feedback: string, severity: "error"|"warning"|"info" }
```

### Escalation Strategy (`escalation/escalation-strategy.ts`)

Decides whether to retry or escalate based on execution results:
- Retries with same model if validation failed
- Escalates to more capable model if execution failed
- Respects retry limits
- Provides detailed reasoning

```typescript
const escalation = new EscalationStrategy(router, providerRegistry);
const decision = await escalation.evaluate(context, result);
// Returns: { shouldEscalate, reason, nextModel }
```

### Cost Tracker (`cost/cost-tracker.ts`)

Tracks execution costs and provides analytics:
- Records cost for each execution
- Calculates total/average costs
- Breaks down costs by model
- Generates summary statistics

```typescript
const tracker = new CostTracker();
tracker.recordExecution(result);
const summary = tracker.getSummary();
// Returns: { totalTasks, totalCost, averageCostPerTask, modelCosts, ... }
```

### Execution History (`history/execution-history.ts`)

Maintains complete audit trail of all decisions and executions:
- Records execution results
- Tracks all events and decisions
- Supports history queries by task/action
- Can age out old entries

```typescript
const history = new ExecutionHistory();
history.recordResult(result);
const recentEvents = history.getRecent(10);
```

### Context Integration (`context/context-integration.ts`)

Retrieves relevant engineering context via ContextStore abstraction:
- Fetches repository information
- Gets relevant source files
- Extracts technology stack
- Identifies architecture patterns

```typescript
const integration = new ContextIntegration(contextStore);
const context = await integration.retrieveContext(taskDescription);
// Returns: { repositories, files, capabilities, technologiesUsed, ... }
```

## Storage Abstraction

The AI Control Plane uses the `ContextStore` interface to access all context data:

```typescript
export interface ContextStore {
  // Repository operations
  getRepository(id: string): Promise<Repository | null>;
  listRepositories(): Promise<Repository[]>;
  // ... and operations for Files, Symbols, Dependencies, etc.
}
```

This abstraction means:
- ✅ AI code is agnostic to storage backend (SQLite vs PGlite vs others)
- ✅ Can migrate storage without changing AI control plane code
- ✅ All database access goes through a clean, documented interface

## Model Provider Interface

The AI Control Plane uses the `ModelProvider` interface for model access:

```typescript
export interface ModelProvider {
  health(): Promise<{ healthy: boolean; message: string }>;
  models(): Promise<Model[]>;
  completions(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  getCostPer1kTokens(modelId: string): Promise<number>;
  isModelAvailable(modelId: string): Promise<boolean>;
}
```

Implementations can wrap:
- Local models (Qwen3-Coder-30B via RunPod/vLLM)
- API-based models (OpenAI, Claude, Frontier models)
- Any other inference provider

## Control Plane Orchestration

The `ControlPlane` class orchestrates the entire pipeline:

```typescript
const plane = new ControlPlane(contextStore, modelProvider, providerRegistry);

const result = await plane.execute(
  "Fix the bug in the authentication module",
  maxRetries = 3
);

// Result includes:
// - Execution success/failure
// - Model used and token usage
// - Cost
// - Validation results
// - Full history of decisions
```

## Usage Example

```typescript
import { getContextStore } from "@station/context";
import { ControlPlane, defaultProviderRegistry } from "@station/ai";

// Initialize
const contextStore = await getContextStore();
const modelProvider = /* your model provider implementation */;

// Create control plane
const plane = new ControlPlane(
  contextStore,
  modelProvider,
  defaultProviderRegistry
);

// Execute task
try {
  const result = await plane.execute(
    "Add comprehensive error handling to the payment service",
    maxRetries = 3
  );
  
  console.log(`Task: ${result.taskId}`);
  console.log(`Model: ${result.model.name}`);
  console.log(`Cost: $${result.cost.toFixed(4)}`);
  console.log(`Validation: ${result.validationPassed ? "PASSED" : "FAILED"}`);
  console.log(`Output:\n${result.output}`);
  
  // Get statistics
  const stats = plane.getStats();
  console.log(`Total Cost: $${stats.costTracking.totalCost.toFixed(4)}`);
  console.log(`Average Cost: $${stats.costTracking.averageCostPerTask.toFixed(4)}`);
} finally {
  await closeContextStore();
}
```

## Task Classification

Tasks are automatically classified into categories:

- **bug_fix**: Keywords like "bug", "fix", "error"
- **feature**: Keywords like "add", "feature", "implement"
- **refactor**: Keywords like "refactor", "restructure", "reorganize"
- **test**: Keywords like "test", "spec", "coverage"
- **documentation**: Keywords like "doc", "readme", "comment"
- **infrastructure**: Keywords like "infrastructure", "deploy", "config"
- **optimization**: Keywords like "performance", "optimize", "speed"

## Complexity Assessment

Tasks are assessed on a scale from simple to frontier:

- **SIMPLE**: Quick tasks with minimal context requirements (< 1k tokens)
- **MODERATE**: Standard coding tasks (1-5k tokens)
- **COMPLEX**: Difficult refactoring or new features (5-20k tokens)
- **FRONTIER**: Requires the most capable model

The complexity affects:
- Which models are eligible for the task
- Estimated token requirements
- Cost estimation
- Escalation thresholds

## Routing Decision Process

When routing a task to a model:

1. Filter available models to those capable of the complexity level
2. Apply budget constraints if specified
3. Sort by cost (ascending)
4. Select the cheapest qualified model
5. Set up alternatives in case escalation is needed
6. Determine if escalation is likely needed based on complexity/confidence

Example:
```
Task: "Simple bug fix" (SIMPLE complexity)
Available models:
  - Qwen3-Coder-30B: $0.001/1k tokens ✓ Can handle SIMPLE
  - Frontier Model: $0.01/1k tokens ✓ Can handle SIMPLE

Decision: Select Qwen3-Coder-30B (cheapest)
Cost: $0.0003 (estimated)
```

## Validation Rules

Result validation is category-specific:

- **Bug Fix**: Looks for "fix", "issue", "bug", "change from/to", "replace", "should be"
- **Test**: Looks for test framework keywords (describe, it, test, @Test, #[test])
- **All Categories**: Checks for error indicators and empty output

Validation severity levels:
- **error**: Output fails validation, will trigger retry/escalation
- **warning**: Output likely invalid but may be salvageable
- **info**: Validation passed

## Escalation Strategy

When validation fails:

1. If retries remain, retry with same model
2. If no retries remain or execution failed, try more capable model
3. Continue until success or out of escalation options
4. Report final result with escalation history

## Cost Optimization

The control plane optimizes costs through:

1. **Model Selection**: Always uses cheapest qualified model
2. **Token Estimation**: Estimates requirements based on task complexity
3. **Intelligent Escalation**: Only escalates when evidence warrants it
4. **Cost Tracking**: Monitors actual costs to inform future decisions
5. **Analytics**: Provides breakdown by model for optimization

## Audit Trail

Complete execution history includes:
- Task ID and description
- Classification details
- Model routing decisions
- Execution results
- Validation results
- Cost records
- Escalation decisions
- Timestamps for all events

## Future Enhancements

Potential future improvements:
- Fine-tuned models based on project context
- Learning from execution history to improve routing
- Multi-model ensembles for complex tasks
- Streaming responses for long-running tasks
- Interactive retry loops with developer feedback
- A/B testing of model routing strategies
