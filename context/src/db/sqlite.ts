/**
 * SQLite database backend using better-sqlite3
 */

import Database from "better-sqlite3";
import { getDBPath, ensureDBDirectory } from "./client.js";

export interface DatabaseInstance {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  close(): Promise<void>;
}

let sqlite3: typeof Database | null = null;

/**
 * Lazy load better-sqlite3
 */
async function getSqlite3() {
  if (!sqlite3) {
    try {
      // Dynamic import for better-sqlite3
      const module = await import("better-sqlite3");
      sqlite3 = module.default;
    } catch (error) {
      throw new Error(
        `better-sqlite3 not installed. Run: npm install better-sqlite3\n${error}`
      );
    }
  }
  return sqlite3;
}

/**
 * Create SQLite database connection
 */
export async function createSQLiteDatabase(): Promise<DatabaseInstance> {
  const SQLiteDb = await getSqlite3();
  if (!SQLiteDb) {
    throw new Error("Could not load better-sqlite3");
  }

  ensureDBDirectory();
  const dbPath = getDBPath();

  const db = new SQLiteDb(dbPath);

  // Enable foreign keys
  db.pragma("foreign_keys = ON");

  return {
    async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
      try {
        const stmt = db.prepare(sql);
        if (params && params.length > 0) {
          return stmt.all(...params) as T[];
        }
        return stmt.all() as T[];
      } catch (error) {
        throw new Error(
          `Query failed: ${error instanceof Error ? error.message : String(error)}\nSQL: ${sql}`
        );
      }
    },

    async run(sql: string, params?: unknown[]): Promise<{ changes: number }> {
      try {
        const stmt = db.prepare(sql);
        let result;
        if (params && params.length > 0) {
          result = stmt.run(...params);
        } else {
          result = stmt.run();
        }
        return { changes: result.changes };
      } catch (error) {
        throw new Error(
          `Run failed: ${error instanceof Error ? error.message : String(error)}\nSQL: ${sql}`
        );
      }
    },

    async close(): Promise<void> {
      db.close();
    },
  };
}
