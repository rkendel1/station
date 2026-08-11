/**
 * Code symbol extractor - extracts functions, classes, methods, etc.
 */

import fs from "fs";
import { createHash } from "crypto";
import type { Symbol, SymbolKind } from "../types/index.js";

export interface SymbolDefinition {
  name: string;
  kind: SymbolKind;
  line: number;
  endLine?: number;
  signature?: string;
  qualified_name?: string;
}

/**
 * Generate symbol ID
 */
function generateSymbolId(fileId: string, name: string, line: number): string {
  const data = `${fileId}:${name}:${line}`;
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Extract symbols from JavaScript/TypeScript
 */
function extractJavaScriptSymbols(content: string): SymbolDefinition[] {
  const symbols: SymbolDefinition[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*")) {
      continue;
    }

    // Function declarations
    let match = trimmed.match(/^(export\s+)?(async\s+)?function\s+(\w+)\s*\((.*)\)/);
    if (match) {
      symbols.push({
        name: match[3],
        kind: "function",
        line: i + 1,
        signature: `function ${match[3]}(${match[4]})`,
      });
      continue;
    }

    // Arrow functions (const x = () => {})
    match = trimmed.match(/^(export\s+)?(const|let|var)\s+(\w+)\s*=\s*(async\s+)?\((.*)\)\s*=>/);
    if (match) {
      symbols.push({
        name: match[3],
        kind: "function",
        line: i + 1,
        signature: `const ${match[3]} = (${match[5]}) =>`,
      });
      continue;
    }

    // Class declarations
    match = trimmed.match(/^(export\s+)?class\s+(\w+)(\s+extends\s+(\w+))?/);
    if (match) {
      symbols.push({
        name: match[2],
        kind: "class",
        line: i + 1,
      });
      continue;
    }

    // Interface declarations
    match = trimmed.match(/^(export\s+)?interface\s+(\w+)/);
    if (match) {
      symbols.push({
        name: match[2],
        kind: "interface",
        line: i + 1,
      });
      continue;
    }

    // Type declarations
    match = trimmed.match(/^(export\s+)?type\s+(\w+)\s*=/);
    if (match) {
      symbols.push({
        name: match[2],
        kind: "type",
        line: i + 1,
      });
      continue;
    }

    // Enum declarations
    match = trimmed.match(/^(export\s+)?enum\s+(\w+)/);
    if (match) {
      symbols.push({
        name: match[2],
        kind: "enum",
        line: i + 1,
      });
      continue;
    }

    // Variable/constant declarations
    match = trimmed.match(/^(export\s+)?(const|let|var)\s+(\w+)\s*=/);
    if (match && !trimmed.includes("=>")) {
      symbols.push({
        name: match[3],
        kind: "variable",
        line: i + 1,
      });
      continue;
    }
  }

  return symbols;
}

/**
 * Extract symbols from Python
 */
function extractPythonSymbols(content: string): SymbolDefinition[] {
  const symbols: SymbolDefinition[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    // Function definitions
    let match = trimmed.match(/^(async\s+)?def\s+(\w+)\s*\((.*)\):/);
    if (match) {
      symbols.push({
        name: match[2],
        kind: "function",
        line: i + 1,
        signature: `def ${match[2]}(${match[3]}):`,
      });
      continue;
    }

    // Class definitions
    match = trimmed.match(/^class\s+(\w+)(\s*\((.*)\))?:/);
    if (match) {
      symbols.push({
        name: match[1],
        kind: "class",
        line: i + 1,
      });
      continue;
    }

    // Top-level variable assignments
    match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=/);
    if (match) {
      symbols.push({
        name: match[1],
        kind: "constant",
        line: i + 1,
      });
      continue;
    }
  }

  return symbols;
}

/**
 * Extract symbols from Rust
 */
function extractRustSymbols(content: string): SymbolDefinition[] {
  const symbols: SymbolDefinition[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith("//")) {
      continue;
    }

    // Function definitions
    let match = trimmed.match(/^(pub\s+)?(async\s+)?fn\s+(\w+)\s*\(/);
    if (match) {
      symbols.push({
        name: match[3],
        kind: "function",
        line: i + 1,
      });
      continue;
    }

    // Struct definitions
    match = trimmed.match(/^(pub\s+)?struct\s+(\w+)/);
    if (match) {
      symbols.push({
        name: match[2],
        kind: "class",
        line: i + 1,
      });
      continue;
    }

    // Trait definitions
    match = trimmed.match(/^(pub\s+)?trait\s+(\w+)/);
    if (match) {
      symbols.push({
        name: match[2],
        kind: "interface",
        line: i + 1,
      });
      continue;
    }

    // Enum definitions
    match = trimmed.match(/^(pub\s+)?enum\s+(\w+)/);
    if (match) {
      symbols.push({
        name: match[2],
        kind: "enum",
        line: i + 1,
      });
      continue;
    }
  }

  return symbols;
}

/**
 * Extract symbols from source code based on language
 */
export function extractSymbols(
  content: string,
  language?: string
): SymbolDefinition[] {
  if (!language) {
    return [];
  }

  switch (language.toLowerCase()) {
    case "typescript":
    case "javascript":
    case "jsx":
    case "tsx":
      return extractJavaScriptSymbols(content);

    case "python":
      return extractPythonSymbols(content);

    case "rust":
      return extractRustSymbols(content);

    default:
      return [];
  }
}

/**
 * Index symbols in a file
 */
export async function indexSymbolsInFile(
  fileId: string,
  filePath: string,
  language?: string
): Promise<Symbol[]> {
  const symbols: Symbol[] = [];

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const definitions = extractSymbols(content, language);

    for (const def of definitions) {
      symbols.push({
        id: generateSymbolId(fileId, def.name, def.line),
        file_id: fileId,
        name: def.name,
        kind: def.kind,
        qualified_name: def.qualified_name,
        start_line: def.line,
        end_line: def.endLine,
        signature: def.signature,
      });
    }
  } catch {
    // Ignore file read errors
  }

  return symbols;
}
