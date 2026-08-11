/**
 * Result validation - validates execution output
 */

import { ExecutionResult, TaskCategory } from "../types/index.js";

export interface ValidationResult {
  passed: boolean;
  feedback: string;
  severity: "error" | "warning" | "info";
}

export class ResultValidator {
  /**
   * Validate execution result
   */
  validate(
    result: ExecutionResult,
    expectedCategory: TaskCategory
  ): ValidationResult {
    if (!result.success) {
      return {
        passed: false,
        feedback: result.validationFeedback || "Execution failed",
        severity: "error",
      };
    }

    // Basic validation checks
    if (result.output.length === 0) {
      return {
        passed: false,
        feedback: "Model returned empty output",
        severity: "error",
      };
    }

    if (this.hasCommonErrors(result.output)) {
      return {
        passed: false,
        feedback: "Output contains common error indicators",
        severity: "error",
      };
    }

    if (expectedCategory === TaskCategory.TEST && !this.looksLikeTest(result.output)) {
      return {
        passed: false,
        feedback: "Output does not appear to be valid test code",
        severity: "warning",
      };
    }

    if (
      expectedCategory === TaskCategory.BUG_FIX &&
      !this.looksLikeFix(result.output)
    ) {
      return {
        passed: false,
        feedback: "Output does not appear to contain a complete fix",
        severity: "warning",
      };
    }

    return {
      passed: true,
      feedback: "Output validation passed",
      severity: "info",
    };
  }

  private hasCommonErrors(output: string): boolean {
    const errorPatterns = [
      /error:/i,
      /undefined/,
      /cannot read property/i,
      /is not defined/i,
      /syntax error/i,
    ];

    return errorPatterns.some((pattern) => pattern.test(output));
  }

  private looksLikeTest(output: string): boolean {
    const testPatterns = [
      /describe\s*\(/i,
      /it\s*\(/i,
      /test\s*\(/i,
      /def test_/,
      /unittest/i,
      /@Test/,
      /#\[test\]/,
    ];

    return testPatterns.some((pattern) => pattern.test(output));
  }

  private looksLikeFix(output: string): boolean {
    const fixPatterns = [
      /fix/i,
      /issue/i,
      /bug/i,
      /change.*from/i,
      /replace/i,
      /should be/i,
    ];

    return fixPatterns.some((pattern) => pattern.test(output));
  }
}
