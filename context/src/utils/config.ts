/**
 * Workspace configuration loader and schema
 */

import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { z } from "zod";

// Configuration schema
const ContextConfigSchema = z.object({
  workspace: z.object({
    name: z.string(),
    repositories: z.array(z.string()).optional(),
  }).optional(),
  context: z.object({
    database: z.string().optional(),
    embeddings: z.boolean().optional(),
    watch: z.boolean().optional(),
  }).optional(),
  exclude: z.array(z.string()).optional(),
  include_symbols: z.boolean().optional().default(true),
  include_tests: z.boolean().optional().default(true),
  secret_patterns: z.array(z.string()).optional(),
});

export type ContextConfig = z.infer<typeof ContextConfigSchema>;

const DEFAULT_CONFIG: ContextConfig = {
  workspace: {
    name: "default",
    repositories: [],
  },
  context: {
    embeddings: false,
    watch: false,
  },
  exclude: [
    "node_modules",
    "dist",
    "build",
    ".env",
    ".env.*",
    "target",
    ".git",
    "__pycache__",
  ],
  include_symbols: true,
  include_tests: true,
  secret_patterns: [
    "password",
    "token",
    "api_key",
    "secret",
    "private_key",
    "credentials",
  ],
};

/**
 * Find workspace config file
 */
export function findConfigFile(startPath = process.cwd()): string | null {
  let currentPath = startPath;

  while (currentPath !== path.dirname(currentPath)) {
    // Check for .dev-ai/context.yaml
    const devAiPath = path.join(currentPath, ".dev-ai", "context.yaml");
    if (fs.existsSync(devAiPath)) {
      return devAiPath;
    }

    // Check for .dev-ai/context.yml
    const devAiYmlPath = path.join(currentPath, ".dev-ai", "context.yml");
    if (fs.existsSync(devAiYmlPath)) {
      return devAiYmlPath;
    }

    currentPath = path.dirname(currentPath);
  }

  return null;
}

/**
 * Load configuration from file
 */
export function loadConfig(configPath?: string): ContextConfig {
  const loadFrom = configPath || findConfigFile();

  if (!loadFrom || !fs.existsSync(loadFrom)) {
    return DEFAULT_CONFIG;
  }

  try {
    const content = fs.readFileSync(loadFrom, "utf-8");
    const parsed = yaml.load(content);
    return ContextConfigSchema.parse(parsed);
  } catch (error) {
    console.warn(
      `Failed to load config from ${loadFrom}: ${error instanceof Error ? error.message : String(error)}`
    );
    return DEFAULT_CONFIG;
  }
}

/**
 * Save configuration to file
 */
export function saveConfig(config: ContextConfig, configPath: string): void {
  const dir = path.dirname(configPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const yaml_str = yaml.dump(config, { indent: 2 });
  fs.writeFileSync(configPath, yaml_str, { mode: 0o600 });
}

/**
 * Create default config in workspace
 */
export function createDefaultConfig(workspacePath = process.cwd()): ContextConfig {
  const config: ContextConfig = {
    ...DEFAULT_CONFIG,
    workspace: {
      name: path.basename(workspacePath),
      repositories: [],
    },
  };

  const configPath = path.join(workspacePath, ".dev-ai", "context.yaml");
  saveConfig(config, configPath);

  return config;
}
