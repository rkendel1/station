/**
 * Execution control plane
 * Orchestrates the AI execution pipeline
 */

import { ExecutionContext, ExecutionResult, TaskComplexity } from "./types/index.js";
import { TaskClassifier, ClassifierInput } from "./classifier/task-classifier.js";
import { ModelRouter } from "./router/model-router.js";
import { ExecutionEngine } from "./execution/execution-engine.js";
import { EscalationStrategy } from "./escalation/escalation-strategy.js";
import { ResultValidator } from "./validation/result-validator.js";
import { CostTracker } from "./cost/cost-tracker.js";
import { ExecutionHistory } from "./history/execution-history.js";
import { ContextIntegration } from "./context/context-integration.js";
import { ModelProvider, ModelProviderRegistry } from "./providers/model-provider.js";
import { ContextStore } from "@station/context";
import { randomUUID } from "crypto";

export class ControlPlane {
  private classifier: TaskClassifier;
  private router: ModelRouter;
  private engine: ExecutionEngine;
  private escalation: EscalationStrategy;
  private validator: ResultValidator;
  private costTracker: CostTracker;
  private history: ExecutionHistory;
  private contextIntegration: ContextIntegration;

  constructor(
    private contextStore: ContextStore,
    private modelProvider: ModelProvider,
    private providerRegistry: ModelProviderRegistry
  ) {
    this.classifier = new TaskClassifier(contextStore);
    this.router = new ModelRouter(providerRegistry);
    this.engine = new ExecutionEngine(modelProvider, contextStore);
    this.escalation = new EscalationStrategy(this.router, providerRegistry);
    this.validator = new ResultValidator();
    this.costTracker = new CostTracker();
    this.history = new ExecutionHistory();
    this.contextIntegration = new ContextIntegration(contextStore);
  }

  /**
   * Execute a coding task through the control plane
   */
  async execute(task: string, maxRetries: number = 3): Promise<ExecutionResult> {
    const taskId = randomUUID();

    try {
      // Step 1: Classify the task
      this.history.recordEvent(taskId, "CLASSIFY_START", `Classifying task: ${task}`);
      const classification = await this.classifier.classify({
        task,
        repositoryContext: "Retrieved from context store",
      });
      this.history.recordEvent(taskId, "CLASSIFY_COMPLETE", `Category: ${classification.category}, Complexity: ${classification.complexity}`);

      // Step 2: Route to appropriate model
      this.history.recordEvent(taskId, "ROUTE_START", "Routing to model");
      const routing = await this.router.route(classification);
      this.history.recordEvent(taskId, "ROUTE_COMPLETE", `Selected model: ${routing.selectedModel.name}`);

      // Step 3: Execute with retry loop
      let currentRetry = 0;
      let result: ExecutionResult | null = null;

      while (currentRetry < maxRetries) {
        this.history.recordEvent(taskId, "EXECUTE_START", `Attempt ${currentRetry + 1}/${maxRetries}`);

        const context: ExecutionContext = {
          taskId,
          task,
          classification,
          routing,
          maxRetries,
          currentRetry,
          timestamp: new Date(),
        };

        result = await this.engine.execute(context);

        // Step 4: Validate result
        const validation = this.validator.validate(result, classification.category);
        result.validationPassed = validation.passed;
        result.validationFeedback = validation.feedback;

        this.history.recordResult(result);

        if (validation.passed) {
          this.history.recordEvent(taskId, "VALIDATION_SUCCESS", "Output validated successfully");
          this.costTracker.recordExecution(result);
          return result;
        }

        // Step 5: Evaluate escalation
        const escalationDecision = await this.escalation.evaluate(context, result);

        if (!escalationDecision.shouldEscalate || currentRetry >= maxRetries - 1) {
          this.history.recordEvent(taskId, "COMPLETE", escalationDecision.reason, { escalated: false });
          this.costTracker.recordExecution(result);
          return result;
        }

        this.history.recordEvent(taskId, "ESCALATE", escalationDecision.reason);
        currentRetry++;
      }

      if (result) {
        this.costTracker.recordExecution(result);
        return result;
      }

      throw new Error("Execution failed");
    } catch (error) {
      this.history.recordEvent(taskId, "ERROR", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Get execution statistics
   */
  getStats() {
    return {
      costTracking: this.costTracker.getSummary(),
      recentHistory: this.history.getRecent(20),
    };
  }
}
