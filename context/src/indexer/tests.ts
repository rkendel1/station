/**
 * Test discovery - finds and indexes test files
 */

import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import type { TestRecord } from "../types/index.js";

interface TestFrameworkPattern {
  extensions: string[];
  patterns: RegExp[];
  framework: string;
}

const TEST_FRAMEWORKS: Record<string, TestFrameworkPattern> = {
  jest: {
    extensions: [".test.ts", ".test.tsx", ".test.js", ".test.jsx"],
    patterns: [/jest/, /describe\(/, /it\(/, /test\(/],
    framework: "jest",
  },
  vitest: {
    extensions: [".test.ts", ".test.tsx"],
    patterns: [/vitest/, /describe\(/, /it\(/, /test\(/],
    framework: "vitest",
  },
  mocha: {
    extensions: [".test.js", ".test.ts", ".spec.js", ".spec.ts"],
    patterns: [/mocha/, /describe\(/, /it\(/],
    framework: "mocha",
  },
  pytest: {
    extensions: [".test.py", "_test.py", "test_*.py"],
    patterns: [/def test_/, /def setUp/, /def tearDown/],
    framework: "pytest",
  },
  unittest: {
    extensions: ["_test.py", "test_*.py"],
    patterns: [/class Test/, /unittest\.TestCase/],
    framework: "unittest",
  },
  cargo: {
    extensions: [".rs"],
    patterns: [/#\[test\]/, /#\[cfg\(test\)\]/],
    framework: "cargo",
  },
  go: {
    extensions: ["_test.go"],
    patterns: [/func Test/, /func Benchmark/],
    framework: "go",
  },
};

/**
 * Generate test ID
 */
function generateTestId(
  repositoryId: string,
  testName: string,
  filePath: string
): string {
  const data = `${repositoryId}:${testName}:${filePath}`;
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Detect test framework from file content
 */
function detectTestFramework(content: string, filePath: string): string | undefined {
  for (const [, fw] of Object.entries(TEST_FRAMEWORKS)) {
    // Check file extension
    for (const ext of fw.extensions) {
      if (filePath.endsWith(ext)) {
        // Check content patterns to confirm
        for (const pattern of fw.patterns) {
          if (pattern.test(content)) {
            return fw.framework;
          }
        }
      }
    }
  }

  return undefined;
}

/**
 * Extract test functions from JavaScript/TypeScript
 */
function extractJavaScriptTests(content: string): string[] {
  const tests: string[] = [];

  // Match test() calls
  let match;
  const testPattern = /(?:test|it)\s*\(\s*['"](.*?)['"]/g;

  while ((match = testPattern.exec(content)) !== null) {
    tests.push(match[1]);
  }

  return tests;
}

/**
 * Extract test functions from Python
 */
function extractPythonTests(content: string): string[] {
  const tests: string[] = [];

  // Match def test_* functions
  let match;
  const testPattern = /def\s+(test_\w+)\s*\(/g;

  while ((match = testPattern.exec(content)) !== null) {
    tests.push(match[1]);
  }

  return tests;
}

/**
 * Extract test functions from Rust
 */
function extractRustTests(content: string): string[] {
  const tests: string[] = [];

  // Match #[test] functions
  let match;
  const testPattern = /#\[test\]\s+(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/g;

  while ((match = testPattern.exec(content)) !== null) {
    tests.push(match[1]);
  }

  return tests;
}

/**
 * Extract test functions from Go
 */
function extractGoTests(content: string): string[] {
  const tests: string[] = [];

  // Match func Test* functions
  let match;
  const testPattern = /func\s+(Test\w+)\s*\(/g;

  while ((match = testPattern.exec(content)) !== null) {
    tests.push(match[1]);
  }

  return tests;
}

/**
 * Check if file is a test file
 */
export function isTestFile(filePath: string): boolean {
  const fileName = path.basename(filePath).toLowerCase();
  const extensions = [
    ".test.ts",
    ".test.tsx",
    ".test.js",
    ".test.jsx",
    ".spec.ts",
    ".spec.tsx",
    ".spec.js",
    ".spec.jsx",
    "_test.py",
    "test_",
    "_test.go",
  ];

  for (const ext of extensions) {
    if (fileName.includes(ext) || fileName.endsWith(ext)) {
      return true;
    }
  }

  return false;
}

/**
 * Discover tests in a file
 */
export async function discoverTestsInFile(
  repositoryId: string,
  fileId: string,
  filePath: string,
  language?: string
): Promise<TestRecord[]> {
  const tests: TestRecord[] = [];

  if (!isTestFile(filePath)) {
    return tests;
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const framework = detectTestFramework(content, filePath);

    let testNames: string[] = [];

    if (language === "typescript" || language === "javascript") {
      testNames = extractJavaScriptTests(content);
    } else if (language === "python") {
      testNames = extractPythonTests(content);
    } else if (language === "rust") {
      testNames = extractRustTests(content);
    } else if (language === "go") {
      testNames = extractGoTests(content);
    }

    for (const testName of testNames) {
      tests.push({
        id: generateTestId(repositoryId, testName, filePath),
        repository_id: repositoryId,
        file_id: fileId,
        name: testName,
        framework: framework,
        target: undefined,
      });
    }
  } catch {
    // Ignore file read errors
  }

  return tests;
}

/**
 * Discover all tests in a repository
 */
export async function discoverTests(
  repositoryId: string,
  dirPath: string,
  files: Array<{ id: string; path: string; language?: string }>
): Promise<TestRecord[]> {
  const allTests: TestRecord[] = [];

  for (const file of files) {
    const fullPath = path.join(dirPath, file.path);
    const fileTests = await discoverTestsInFile(
      repositoryId,
      file.id,
      fullPath,
      file.language
    );
    allTests.push(...fileTests);
  }

  return allTests;
}
