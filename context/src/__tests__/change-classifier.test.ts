/**
 * Tests for change classifier
 */

import { describe, it, expect } from "vitest";
import {
  classifyChange,
  createFileChange,
  isDependencyFile,
  isLockfile,
  groupChangesByType,
} from "../workspace/change-classifier.js";

describe("Change Classifier", () => {
  describe("classifyChange", () => {
    it("should classify TypeScript source files", () => {
      expect(classifyChange("src/auth/service.ts")).toBe("SOURCE");
      expect(classifyChange("src/components/Button.tsx")).toBe("SOURCE");
    });

    it("should classify test files", () => {
      expect(classifyChange("src/auth/service.test.ts")).toBe("TEST");
      expect(classifyChange("tests/auth.spec.ts")).toBe("TEST");
      expect(classifyChange("__tests__/auth.test.ts")).toBe("TEST");
    });

    it("should classify dependency files", () => {
      expect(classifyChange("package.json")).toBe("DEPENDENCY");
      expect(classifyChange("Cargo.toml")).toBe("DEPENDENCY");
      expect(classifyChange("requirements.txt")).toBe("DEPENDENCY");
      expect(classifyChange("go.mod")).toBe("DEPENDENCY");
    });

    it("should classify lockfiles as dependencies", () => {
      expect(classifyChange("package-lock.json")).toBe("DEPENDENCY");
      expect(classifyChange("yarn.lock")).toBe("DEPENDENCY");
      expect(classifyChange("Cargo.lock")).toBe("DEPENDENCY");
    });

    it("should classify configuration files", () => {
      expect(classifyChange("tsconfig.json")).toBe("CONFIGURATION");
      expect(classifyChange(".eslintrc.js")).toBe("CONFIGURATION");
      expect(classifyChange("config.ts")).toBe("CONFIGURATION");
    });

    it("should classify documentation files", () => {
      expect(classifyChange("README.md")).toBe("DOCUMENTATION");
      expect(classifyChange("docs/guide.md")).toBe("DOCUMENTATION");
      expect(classifyChange("CHANGELOG.md")).toBe("DOCUMENTATION");
    });

    it("should classify infrastructure files", () => {
      expect(classifyChange("docker-compose.yml")).toBe("INFRASTRUCTURE");
      expect(classifyChange("kubernetes/deployment.yaml")).toBe("INFRASTRUCTURE");
      expect(classifyChange("terraform/main.tf")).toBe("INFRASTRUCTURE");
    });

    it("should classify build files", () => {
      expect(classifyChange("Dockerfile")).toBe("BUILD");
      expect(classifyChange("Makefile")).toBe("BUILD");
    });

    it("should classify schema files", () => {
      expect(classifyChange("schema.sql")).toBe("SCHEMA");
      expect(classifyChange("schema.prisma")).toBe("SCHEMA");
    });

    it("should classify migration files", () => {
      expect(classifyChange("migrations/001_create_users.sql")).toBe("MIGRATION");
      expect(classifyChange("db/migrate/20230101_init.sql")).toBe("MIGRATION");
    });

    it("should return UNKNOWN for unrecognized files", () => {
      expect(classifyChange("data.csv")).toBe("UNKNOWN");
      expect(classifyChange("random.xyz")).toBe("UNKNOWN");
    });
  });

  describe("createFileChange", () => {
    it("should create a file change object", () => {
      const change = createFileChange("src/index.ts", "change");
      
      expect(change.path).toBe("src/index.ts");
      expect(change.type).toBe("change");
      expect(change.changeType).toBe("SOURCE");
      expect(change.timestamp).toBeInstanceOf(Date);
    });

    it("should handle add events", () => {
      const change = createFileChange("src/new-file.ts", "add");
      expect(change.type).toBe("add");
    });

    it("should handle unlink events", () => {
      const change = createFileChange("src/deleted.ts", "unlink");
      expect(change.type).toBe("unlink");
    });
  });

  describe("isDependencyFile", () => {
    it("should return true for dependency manifests", () => {
      expect(isDependencyFile("package.json")).toBe(true);
      expect(isDependencyFile("Cargo.toml")).toBe(true);
      expect(isDependencyFile("requirements.txt")).toBe(true);
    });

    it("should return false for non-dependency files", () => {
      expect(isDependencyFile("src/index.ts")).toBe(false);
      expect(isDependencyFile("README.md")).toBe(false);
    });
  });

  describe("isLockfile", () => {
    it("should return true for lockfiles", () => {
      expect(isLockfile("package-lock.json")).toBe(true);
      expect(isLockfile("yarn.lock")).toBe(true);
      expect(isLockfile("Cargo.lock")).toBe(true);
      expect(isLockfile("go.sum")).toBe(true);
    });

    it("should return false for non-lockfiles", () => {
      expect(isLockfile("package.json")).toBe(false);
      expect(isLockfile("src/index.ts")).toBe(false);
    });
  });

  describe("groupChangesByType", () => {
    it("should group changes by type", () => {
      const changes = [
        createFileChange("src/index.ts", "change"),
        createFileChange("src/test.test.ts", "change"),
        createFileChange("package.json", "change"),
        createFileChange("README.md", "change"),
      ];

      const grouped = groupChangesByType(changes);

      expect(grouped.SOURCE.length).toBe(1);
      expect(grouped.TEST.length).toBe(1);
      expect(grouped.DEPENDENCY.length).toBe(1);
      expect(grouped.DOCUMENTATION.length).toBe(1);
    });

    it("should handle empty changes", () => {
      const grouped = groupChangesByType([]);

      expect(grouped.SOURCE.length).toBe(0);
      expect(grouped.TEST.length).toBe(0);
    });
  });
});
