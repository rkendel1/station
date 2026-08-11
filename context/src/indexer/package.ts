/**
 * Dependency indexer for package.json, Cargo.toml, requirements.txt, etc.
 */

import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import type { Dependency } from "../types/index.js";

interface PackageDependencies {
  [name: string]: string;
}

interface PythonRequirements {
  [name: string]: string;
}

/**
 * Parse package.json dependencies
 */
export function parsePackageJson(content: string): PackageDependencies {
  try {
    const pkg = JSON.parse(content);
    const deps: PackageDependencies = {};

    for (const [key, value] of Object.entries(pkg.dependencies || {})) {
      deps[key] = String(value);
    }

    for (const [key, value] of Object.entries(pkg.devDependencies || {})) {
      deps[key] = String(value);
    }

    return deps;
  } catch {
    return {};
  }
}

/**
 * Parse Cargo.toml dependencies
 */
export function parseCargoToml(content: string): PackageDependencies {
  const deps: PackageDependencies = {};
  const lines = content.split("\n");
  let inDeps = false;
  let inDevDeps = false;

  for (const line of lines) {
    if (line.trim() === "[dependencies]") {
      inDeps = true;
      inDevDeps = false;
      continue;
    }
    if (line.trim() === "[dev-dependencies]") {
      inDevDeps = true;
      inDeps = false;
      continue;
    }
    if (line.startsWith("[")) {
      inDeps = false;
      inDevDeps = false;
      continue;
    }

    if (inDeps || inDevDeps) {
      const match = line.match(/^\s*(\w+)\s*=\s*"([^"]+)"/);
      if (match) {
        deps[match[1]] = match[2];
      }
    }
  }

  return deps;
}

/**
 * Parse Python requirements.txt or pyproject.toml
 */
export function parsePythonRequirements(
  content: string,
  filePath?: string
): PackageDependencies {
  const deps: PackageDependencies = {};

  if (filePath?.endsWith("pyproject.toml")) {
    // Simple pyproject.toml parsing
    const lines = content.split("\n");
    let inDeps = false;

    for (const line of lines) {
      if (line.includes("dependencies")) {
        inDeps = true;
        continue;
      }
      if (inDeps) {
        const match = line.match(/"([^"]+)"/);
        if (match) {
          const dep = match[1];
          if (dep.startsWith("#")) {
            inDeps = false;
          } else {
            deps[dep.split(/[<>=]/)[0].trim()] = dep;
          }
        }
      }
    }
  } else {
    // requirements.txt parsing
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      // Remove comments
      const dep = trimmed.split("#")[0].trim();
      if (!dep) {
        continue;
      }

      // Parse package name and version
      const match = dep.match(/^([a-zA-Z0-9._-]+)/);
      if (match) {
        deps[match[1]] = dep;
      }
    }
  }

  return deps;
}

/**
 * Generate dependency ID
 */
function generateDependencyId(
  repositoryId: string,
  source: string,
  target: string
): string {
  const data = `${repositoryId}:${source}:${target}`;
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Index dependencies from package files
 */
export async function indexDependencies(
  repositoryId: string,
  dirPath: string
): Promise<Dependency[]> {
  const deps: Dependency[] = [];

  // Check package.json
  const packageJsonPath = path.join(dirPath, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    try {
      const content = fs.readFileSync(packageJsonPath, "utf-8");
      const dependencies = parsePackageJson(content);

      for (const [name, version] of Object.entries(dependencies)) {
        deps.push({
          id: generateDependencyId(repositoryId, "package.json", name),
          repository_id: repositoryId,
          source: "package.json",
          target: name,
          dependency_type: "npm",
          version,
        });
      }
    } catch {
      // Ignore parsing errors
    }
  }

  // Check Cargo.toml
  const cargoTomlPath = path.join(dirPath, "Cargo.toml");
  if (fs.existsSync(cargoTomlPath)) {
    try {
      const content = fs.readFileSync(cargoTomlPath, "utf-8");
      const dependencies = parseCargoToml(content);

      for (const [name, version] of Object.entries(dependencies)) {
        deps.push({
          id: generateDependencyId(repositoryId, "Cargo.toml", name),
          repository_id: repositoryId,
          source: "Cargo.toml",
          target: name,
          dependency_type: "cargo",
          version,
        });
      }
    } catch {
      // Ignore parsing errors
    }
  }

  // Check requirements.txt
  const requirementsPath = path.join(dirPath, "requirements.txt");
  if (fs.existsSync(requirementsPath)) {
    try {
      const content = fs.readFileSync(requirementsPath, "utf-8");
      const dependencies = parsePythonRequirements(content, "requirements.txt");

      for (const [name, version] of Object.entries(dependencies)) {
        deps.push({
          id: generateDependencyId(repositoryId, "requirements.txt", name),
          repository_id: repositoryId,
          source: "requirements.txt",
          target: name,
          dependency_type: "pip",
          version,
        });
      }
    } catch {
      // Ignore parsing errors
    }
  }

  // Check pyproject.toml
  const pyprojectPath = path.join(dirPath, "pyproject.toml");
  if (fs.existsSync(pyprojectPath)) {
    try {
      const content = fs.readFileSync(pyprojectPath, "utf-8");
      const dependencies = parsePythonRequirements(content, "pyproject.toml");

      for (const [name, version] of Object.entries(dependencies)) {
        // Skip if already added from requirements.txt
        if (!deps.some((d) => d.target === name)) {
          deps.push({
            id: generateDependencyId(repositoryId, "pyproject.toml", name),
            repository_id: repositoryId,
            source: "pyproject.toml",
            target: name,
            dependency_type: "python",
            version,
          });
        }
      }
    } catch {
      // Ignore parsing errors
    }
  }

  return deps;
}
