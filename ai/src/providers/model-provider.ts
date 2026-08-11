/**
 * Provider-neutral model interface
 * All model providers must implement this interface
 */

import { Model } from "../types/index.js";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface ChatCompletionResponse {
  model: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
  finishReason: string;
}

/**
 * Provider-neutral interface for model access
 * Implementations should handle authentication, rate limiting, and error handling
 */
export interface ModelProvider {
  /**
   * Check health status of the provider
   */
  health(): Promise<{
    healthy: boolean;
    message: string;
  }>;

  /**
   * List available models from this provider
   */
  models(): Promise<Model[]>;

  /**
   * Execute a chat completion request
   */
  completions(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;

  /**
   * Get the cost per 1k tokens for a model
   */
  getCostPer1kTokens(modelId: string): Promise<number>;

  /**
   * Check if a specific model is available
   */
  isModelAvailable(modelId: string): Promise<boolean>;
}

/**
 * Registry of available model providers
 */
export class ModelProviderRegistry {
  private providers: Map<string, ModelProvider> = new Map();

  register(name: string, provider: ModelProvider): void {
    this.providers.set(name, provider);
  }

  get(name: string): ModelProvider | undefined {
    return this.providers.get(name);
  }

  getAll(): Map<string, ModelProvider> {
    return new Map(this.providers);
  }

  async getAllModels(): Promise<Model[]> {
    const models: Model[] = [];
    for (const provider of this.providers.values()) {
      const providerModels = await provider.models();
      models.push(...providerModels);
    }
    return models;
  }

  async findBestModel(
    category: string,
    maxCost: number
  ): Promise<Model | null> {
    const models = await this.getAllModels();
    return (
      models
        .filter((m) => m.available && m.costPer1kTokens <= maxCost)
        .sort((a, b) => a.costPer1kTokens - b.costPer1kTokens)[0] || null
    );
  }
}

export const defaultProviderRegistry = new ModelProviderRegistry();
