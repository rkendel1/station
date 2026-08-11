/**
 * Repository indexer - discovers and indexes git repositories
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import type { Repository } from "../types/index.js";

export interface RepositoryInfo {
  name: string;
  path: string;
  remoteUrl?: string;
  defaultBranch: string;
  language?: string;
}

/**
 * Detect language from file extensions
 */
function detectLanguage(dirPath: string): string | undefined {
  const extensions: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".py": "python",
    ".rs": "rust",
    ".go": "go",
    ".java": "java",
    ".cs": "csharp",
    ".cpp": "cpp",
    ".c": "c",
  };

  try {
    const files = fs.readdirSync(dirPath, { recursive: true });
    const fileList = Array.isArray(files) ? files : [files];

    for (const file of fileList) {
      if (typeof file === "string") {
        const ext = path.extname(file);
        if (extensions[ext]) {
          return extensions[ext];
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return undefined;
}

/**
 * Detect package manager from package files
 */
function detectPackageManager(dirPath: string): string | undefined {
  const packageFiles: Record<string, string> = {
    "package.json": "npm",
    "Cargo.toml": "cargo",
    "requirements.txt": "pip",
    "pyproject.toml": "python",
    "go.mod": "go",
    "pom.xml": "maven",
  };

  for (const [file, manager] of Object.entries(packageFiles)) {
    if (fs.existsSync(path.join(dirPath, file))) {
      return manager;
    }
  }

  return undefined;
}

/**
 * Get git repository information
 */
export async function getRepositoryInfo(dirPath: string): Promise<RepositoryInfo | null> {
  try {
    // Check if it's a git repository
    if (!fs.existsSync(path.join(dirPath, ".git"))) {
      return null;
    }

    const name = path.basename(dirPath);

    let remoteUrl: string | undefined;
    try {
      remoteUrl = execSync("git config --get remote.origin.url", {
        cwd: dirPath,
        encoding: "utf-8",
      }).trim();
    } catch {
      // Ignore if not available
    }

    let defaultBranch = "main";
    try {
      defaultBranch = execSync("git rev-parse --abbrev-ref HEAD", {
        cwd: dirPath,
        encoding: "utf-8",
      }).trim();
    } catch {
      // Use default
    }

    const language = detectLanguage(dirPath);
    const packageManager = detectPackageManager(dirPath);

    return {
      name,
      path: dirPath,
      remoteUrl,
      defaultBranch,
      language,
    };
  } catch {
    return null;
  }
}

/**
 * Generate repository ID from path and name
 */
export function generateRepositoryId(repoInfo: RepositoryInfo): string {
  const data = `${repoInfo.name}:${repoInfo.path}`;
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Convert repository info to database model
 */
export function repositoryInfoToModel(
  info: RepositoryInfo,
  id?: string
): Repository {
  return {
    id: id || generateRepositoryId(info),
    name: info.name,
    full_name: info.remoteUrl || info.name,
    remote_url: info.remoteUrl,
    local_path: info.path,
    default_branch: info.defaultBranch,
    language: info.language,
    package_manager: detectPackageManager(info.path),
    status: "active",
    created_at: new Date(),
    updated_at: new Date(),
  };
}

/**
 * Find git repositories in a directory
 */
export async function findRepositories(
  searchPath: string,
  maxDepth: number = 3
): Promise<RepositoryInfo[]> {
  const results: RepositoryInfo[] = [];
  const visited = new Set<string>();

  async function walk(dir: string, depth: number) {
    if (depth > maxDepth || visited.has(dir)) {
      return;
    }

    visited.add(dir);

    try {
      const files = fs.readdirSync(dir);

      for (const file of files) {
        if (file.startsWith(".")) {
          continue;
        }

        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          // Check if this is a git repo
          const repoInfo = await getRepositoryInfo(fullPath);
          if (repoInfo) {
            results.push(repoInfo);
            // Don't recurse into git repos
          } else if (depth < maxDepth) {
            // Recurse into non-repo directories
            await walk(fullPath, depth + 1);
          }
        }
      }
    } catch {
      // Ignore errors (permission denied, etc.)
    }
  }

  await walk(searchPath, 0);
  return results;
}
