/**
 * PR7: Change classifier - classifies file changes by type
 */

import path from "path";
import type { ChangeType, FileChange } from "../types/index.js";

/**
 * Patterns for classifying files by change type
 */
const CHANGE_PATTERNS: Record<ChangeType, RegExp[]> = {
  TEST: [
    /\.test\.[jt]sx?$/,
    /\.spec\.[jt]sx?$/,
    /_test\.[jt]sx?$/,
    /_spec\.[jt]sx?$/,
    /test_.*\.[jt]sx?$/,
    /spec_.*\.[jt]sx?$/,
    /tests?\//,
    /__tests__\//,
    /\.test\.py$/,
    /test_.*\.py$/,
    /.*_test\.py$/,
    /\.spec\.rb$/,
    /_spec\.rb$/,
    /\.test\.go$/,
    /_test\.go$/,
  ],
  DEPENDENCY: [
    /package\.json$/,
    /package-lock\.json$/,
    /pnpm-lock\.yaml$/,
    /yarn\.lock$/,
    /Cargo\.toml$/,
    /Cargo\.lock$/,
    /requirements\.txt$/,
    /pyproject\.toml$/,
    /poetry\.lock$/,
    /Pipfile$/,
    /Pipfile\.lock$/,
    /go\.mod$/,
    /go\.sum$/,
    /Gemfile$/,
    /Gemfile\.lock$/,
    /composer\.json$/,
    /composer\.lock$/,
  ],
  CONFIGURATION: [
    /\.env(\.\w+)?$/,
    /config\.[jt]sx?$/,
    /\.config\.[jt]sx?$/,
    /settings\.[jt]sx?$/,
    /\.eslintrc/,
    /\.prettierrc/,
    /tsconfig\.json$/,
    /jsconfig\.json$/,
    /\.babelrc/,
    /webpack\.config/,
    /vite\.config/,
    /rollup\.config/,
    /jest\.config/,
    /vitest\.config/,
    /\.yaml$/,
    /\.yml$/,
    /\.toml$/,
    /\.ini$/,
  ],
  DOCUMENTATION: [
    /\.md$/,
    /\.mdx$/,
    /\.rst$/,
    /\.txt$/,
    /docs?\//,
    /documentation\//,
    /README/i,
    /CHANGELOG/i,
    /CONTRIBUTING/i,
    /LICENSE/i,
    /\.adoc$/,
  ],
  SCHEMA: [
    /\.sql$/,
    /schema\.[jt]sx?$/,
    /\.prisma$/,
    /\.graphql$/,
    /\.gql$/,
    /models?\.[jt]sx?$/,
    /entities?\.[jt]sx?$/,
  ],
  MIGRATION: [
    /migrations?\//,
    /migrate\//,
    /db\/migrate/,
    /alembic\//,
    /flyway\//,
    /\.migration\.[jt]sx?$/,
  ],
  BUILD: [
    /Makefile$/,
    /Dockerfile$/,
    /\.dockerignore$/,
    /Jenkinsfile$/,
    /\.gitlab-ci\.yml$/,
    /\.travis\.yml$/,
    /azure-pipelines\.yml$/,
    /buildspec\.yml$/,
    /build\.[jt]sx?$/,
    /gulpfile/,
    /Gruntfile/,
  ],
  INFRASTRUCTURE: [
    /docker-compose/,
    /kubernetes\//,
    /k8s\//,
    /terraform\//,
    /\.tf$/,
    /cloudformation\//,
    /\.cfn\.ya?ml$/,
    /ansible\//,
    /\.ansible/,
    /helm\//,
    /charts?\//,
    /infra\//,
    /infrastructure\//,
    /deploy\//,
  ],
  SOURCE: [], // Default fallback
  UNKNOWN: [],
};

/**
 * Source file extensions
 */
const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".kts",
  ".scala",
  ".c",
  ".cpp",
  ".cc",
  ".h",
  ".hpp",
  ".cs",
  ".fs",
  ".swift",
  ".m",
  ".mm",
  ".php",
  ".pl",
  ".pm",
  ".r",
  ".R",
  ".lua",
  ".ex",
  ".exs",
  ".erl",
  ".hrl",
  ".clj",
  ".cljs",
  ".cljc",
  ".elm",
  ".hs",
  ".lhs",
  ".ml",
  ".mli",
  ".v",
  ".sv",
  ".vhd",
  ".vhdl",
  ".dart",
  ".vue",
  ".svelte",
]);

/**
 * Classify a file path into a change type
 */
export function classifyChange(filePath: string): ChangeType {
  const normalizedPath = filePath.replace(/\\/g, "/");

  // Check patterns in priority order
  const priorityOrder: ChangeType[] = [
    "TEST",
    "MIGRATION",
    "DEPENDENCY",
    "SCHEMA",
    "INFRASTRUCTURE",
    "BUILD",
    "CONFIGURATION",
    "DOCUMENTATION",
  ];

  for (const changeType of priorityOrder) {
    const patterns = CHANGE_PATTERNS[changeType];
    for (const pattern of patterns) {
      if (pattern.test(normalizedPath)) {
        return changeType;
      }
    }
  }

  // Check if it's a source file by extension
  const ext = path.extname(normalizedPath).toLowerCase();
  if (SOURCE_EXTENSIONS.has(ext)) {
    return "SOURCE";
  }

  return "UNKNOWN";
}

/**
 * Create a FileChange object
 */
export function createFileChange(
  filePath: string,
  eventType: "add" | "change" | "unlink"
): FileChange {
  return {
    path: filePath,
    type: eventType,
    changeType: classifyChange(filePath),
    timestamp: new Date(),
  };
}

/**
 * Check if a file is a dependency manifest
 */
export function isDependencyFile(filePath: string): boolean {
  const dependencyPatterns = CHANGE_PATTERNS.DEPENDENCY;
  const normalizedPath = filePath.replace(/\\/g, "/");
  return dependencyPatterns.some((pattern) => pattern.test(normalizedPath));
}

/**
 * Check if a file is a lockfile
 */
export function isLockfile(filePath: string): boolean {
  const lockfilePatterns = [
    /package-lock\.json$/,
    /pnpm-lock\.yaml$/,
    /yarn\.lock$/,
    /Cargo\.lock$/,
    /poetry\.lock$/,
    /Pipfile\.lock$/,
    /go\.sum$/,
    /Gemfile\.lock$/,
    /composer\.lock$/,
  ];
  const normalizedPath = filePath.replace(/\\/g, "/");
  return lockfilePatterns.some((pattern) => pattern.test(normalizedPath));
}

/**
 * Get the category description for a change type
 */
export function getChangeTypeDescription(changeType: ChangeType): string {
  const descriptions: Record<ChangeType, string> = {
    SOURCE: "Source code file",
    TEST: "Test file",
    CONFIGURATION: "Configuration file",
    DEPENDENCY: "Dependency manifest or lockfile",
    DOCUMENTATION: "Documentation file",
    SCHEMA: "Database schema or model definition",
    MIGRATION: "Database migration",
    BUILD: "Build configuration",
    INFRASTRUCTURE: "Infrastructure as code",
    UNKNOWN: "Unknown file type",
  };
  return descriptions[changeType];
}

/**
 * Batch classify multiple file paths
 */
export function classifyChanges(
  filePaths: string[],
  eventType: "add" | "change" | "unlink" = "change"
): FileChange[] {
  return filePaths.map((filePath) => createFileChange(filePath, eventType));
}

/**
 * Group file changes by type
 */
export function groupChangesByType(
  changes: FileChange[]
): Record<ChangeType, FileChange[]> {
  const groups: Record<ChangeType, FileChange[]> = {
    SOURCE: [],
    TEST: [],
    CONFIGURATION: [],
    DEPENDENCY: [],
    DOCUMENTATION: [],
    SCHEMA: [],
    MIGRATION: [],
    BUILD: [],
    INFRASTRUCTURE: [],
    UNKNOWN: [],
  };

  for (const change of changes) {
    groups[change.changeType].push(change);
  }

  return groups;
}
