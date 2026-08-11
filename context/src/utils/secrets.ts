/**
 * Secret detection and redaction - prevents sensitive data from being indexed
 */

import { createHash } from "crypto";

// Common secret patterns
const SECRET_PATTERNS = [
  // API Keys and tokens
  /api[_-]?key[:\s]*["\']?([a-zA-Z0-9\-_]{20,})["\']?/gi,
  /token[:\s]*["\']?([a-zA-Z0-9\-_]{20,})["\']?/gi,
  /secret[:\s]*["\']?([a-zA-Z0-9\-_]{20,})["\']?/gi,
  /password[:\s]*["\']([^"\']+)["\']?/gi,
  
  // AWS
  /AKIA[0-9A-Z]{16}/g,
  
  // Azure
  /[a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}/gi,
  
  // Private keys
  /-----BEGIN [A-Z ]+ PRIVATE KEY-----/g,
  /-----BEGIN [A-Z ]+ KEY-----/g,
  
  // SSH keys
  /ssh-rsa\s+[A-Za-z0-9+/]+={0,2}/g,
  
  // GitHub tokens
  /ghp_[a-zA-Z0-9]{36}/g,
  /gho_[a-zA-Z0-9]{36}/g,
  /ghu_[a-zA-Z0-9]{36}/g,
  /ghs_[a-zA-Z0-9]{36}/g,
  
  // Generic bearer tokens
  /bearer\s+[a-zA-Z0-9._\-]+/gi,
  
  // Database URLs
  /(postgres|mysql|mongodb):\/\/[a-zA-Z0-9:]+@[a-zA-Z0-9._-]+/gi,
];

export interface SecretDetectionResult {
  hasSecrets: boolean;
  secretCount: number;
  redacted: string;
  detectedTypes: string[];
}

/**
 * Detect if content contains secrets
 */
export function detectSecrets(content: string): SecretDetectionResult {
  const detectedTypes: Set<string> = new Set();
  let secretCount = 0;

  for (const pattern of SECRET_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      secretCount += matches.length;
      // Categorize the secret type
      if (pattern.toString().includes("password")) {
        detectedTypes.add("password");
      } else if (pattern.toString().includes("token")) {
        detectedTypes.add("token");
      } else if (pattern.toString().includes("AKIA")) {
        detectedTypes.add("aws-key");
      } else if (pattern.toString().includes("ghp")) {
        detectedTypes.add("github-token");
      } else if (pattern.toString().includes("PRIVATE KEY")) {
        detectedTypes.add("private-key");
      } else if (pattern.toString().includes("postgres|mysql")) {
        detectedTypes.add("database-url");
      } else {
        detectedTypes.add("secret");
      }
    }
  }

  return {
    hasSecrets: secretCount > 0,
    secretCount,
    redacted: redactSecrets(content),
    detectedTypes: Array.from(detectedTypes),
  };
}

/**
 * Redact secrets from content
 */
export function redactSecrets(content: string): string {
  let redacted = content;

  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, "[REDACTED]");
  }

  return redacted;
}

/**
 * Check if a file path should be excluded from indexing
 */
export function shouldExcludeFromIndexing(filePath: string): boolean {
  const excludePatterns = [
    ".env",
    ".env.",
    "*.key",
    "*.pem",
    "*.p12",
    "*-key.json",
    "*-credentials.json",
    ".aws",
    ".ssh",
    ".git/info/exclude",
  ];

  for (const pattern of excludePatterns) {
    if (pattern.includes("*")) {
      const regex = new RegExp(
        "^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$"
      );
      if (regex.test(filePath)) {
        return true;
      }
    } else if (filePath.includes(pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if content should be indexed based on secrets
 */
export function isSafeToIndex(content: string): boolean {
  const detection = detectSecrets(content);
  return !detection.hasSecrets;
}

/**
 * Create a content hash that can be used without storing the actual content
 */
export function createContentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}
