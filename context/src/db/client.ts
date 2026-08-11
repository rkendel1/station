/**
 * Database client initialization and connection management
 */

import fs from "fs";
import path from "path";
import { getEnv } from "../utils/env.js";
import { SCHEMA_VERSION, getMigrationSQL } from "./schema.js";

export interface Database {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  close(): Promise<void>;
}

let dbInstance: Database | null = null;

/**
 * Get or create database path
 */
export function getDBPath(): string {
  const envPath = getEnv("DEV_AI_CONTEXT_DB");
  if (envPath) {
    return envPath;
  }

  const homeDir = process.env.HOME || process.env.USERPROFILE || ".";
  return `${homeDir}/.dev-ai/context/context.db`;
}

/**
 * Ensure database directory exists
 */
export function ensureDBDirectory(): void {
  const dbPath = getDBPath();
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true, mode: 0o700 });
  }
}

/**
 * Get the database version
 */
export async function getSchemaVersion(db: Database): Promise<number> {
  try {
    const result = await db.query<{ version: number }>(
      "SELECT MAX(version) as version FROM schema_version"
    );
    return result[0]?.version || 0;
  } catch {
    return 0;
  }
}

/**
 * Set the database version
 */
export async function setSchemaVersion(
  db: Database,
  version: number
): Promise<void> {
  await db.run(
    "INSERT INTO schema_version (version) VALUES (?)",
    [version]
  );
}

/**
 * Run migrations up to the target version
 */
export async function runMigrations(
  db: Database,
  targetVersion: number = SCHEMA_VERSION
): Promise<void> {
  const currentVersion = await getSchemaVersion(db);

  if (currentVersion >= targetVersion) {
    return;
  }

  for (let v = currentVersion + 1; v <= targetVersion; v++) {
    const sql = getMigrationSQL(v);
    if (!sql) {
      throw new Error(`Migration ${v} not found`);
    }

    // Split by semicolon and execute each statement
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      await db.run(statement);
    }
  }

  await setSchemaVersion(db, targetVersion);
}

/**
 * Initialize database (create if needed, run migrations)
 */
export async function initializeDatabase(db: Database): Promise<void> {
  await runMigrations(db, SCHEMA_VERSION);
}

/**
 * Get or create the default ContextStore instance
 * Currently uses PGlite as the default backend
 */
export async function getDatabase(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  // Dynamically import based on availability
  try {
    const { createPGliteDatabase } = await import("./sqlite.js");
    dbInstance = await createPGliteDatabase();
    await initializeDatabase(dbInstance);
    return dbInstance;
  } catch (error) {
    throw new Error(
      `Failed to initialize database: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}
