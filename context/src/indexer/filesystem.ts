/**
 * Filesystem indexer - discovers and catalogs files
 */

import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import type { File } from "../types/index.js";

const DEFAULT_EXCLUDE = [
  "node_modules",
  ".git",
  ".env",
  ".env.*",
  "dist",
  "build",
  "target",
  "coverage",
  ".cache",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  ".venv",
  "venv",
  ".DS_Store",
];

export interface FileIndexerOptions {
  exclude?: string[];
  maxFileSize?: number; // in bytes, default 10MB
}

/**
 * Detect file language from extension
 */
export function detectFileLanguage(filePath: string): string | undefined {
  const extensionMap: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".py": "python",
    ".pyx": "python",
    ".rs": "rust",
    ".go": "go",
    ".java": "java",
    ".cs": "csharp",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".c": "c",
    ".h": "c",
    ".hpp": "cpp",
    ".swift": "swift",
    ".kt": "kotlin",
    ".scala": "scala",
    ".rb": "ruby",
    ".php": "php",
    ".sql": "sql",
    ".md": "markdown",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".xml": "xml",
    ".html": "html",
    ".css": "css",
    ".scss": "scss",
    ".sass": "sass",
    ".less": "less",
  };

  const ext = path.extname(filePath).toLowerCase();
  return extensionMap[ext];
}

/**
 * Calculate file hash
 */
export function calculateFileHash(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath);
    return createHash("sha256").update(content).digest("hex");
  } catch {
    return "";
  }
}

/**
 * Check if file should be indexed
 */
function shouldIndexFile(
  filePath: string,
  excludePatterns: string[]
): boolean {
  const relPath = path.normalize(filePath);
  const parts = relPath.split(path.sep);

  // Check against exclude patterns
  for (const pattern of excludePatterns) {
    // Simple pattern matching: exact match or contains
    if (parts.includes(pattern) || relPath.includes(pattern)) {
      return false;
    }
  }

  return true;
}

/**
 * Generate file ID
 */
export function generateFileId(repositoryId: string, filePath: string): string {
  const data = `${repositoryId}:${filePath}`;
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Index files in a directory
 */
export async function indexFiles(
  repositoryId: string,
  dirPath: string,
  options: FileIndexerOptions = {}
): Promise<File[]> {
  const files: File[] = [];
  const excludePatterns = [
    ...DEFAULT_EXCLUDE,
    ...(options.exclude || []),
  ];
  const maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB default

  function walk(dir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (!shouldIndexFile(fullPath, excludePatterns)) {
          continue;
        }

        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          try {
            const stat = fs.statSync(fullPath);

            // Skip files that are too large
            if (stat.size > maxFileSize) {
              continue;
            }

            const relPath = path.relative(dirPath, fullPath);
            const language = detectFileLanguage(fullPath);
            const hash = calculateFileHash(fullPath);

            files.push({
              id: generateFileId(repositoryId, relPath),
              repository_id: repositoryId,
              path: relPath,
              language,
              size: stat.size,
              hash,
              last_modified: stat.mtime,
              indexed_at: new Date(),
            });
          } catch {
            // Ignore files we can't stat
          }
        }
      }
    } catch {
      // Ignore directory access errors
    }
  }

  walk(dirPath);
  return files;
}
