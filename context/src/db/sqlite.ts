/**
 * PGlite database backend (in-process PostgreSQL-compatible database)
 */

import { PGlite } from "@electric-sql/pglite";
import { getDBPath, ensureDBDirectory } from "./client.js";

export interface DatabaseInstance {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  close(): Promise<void>;
}

let pglite: PGlite | null = null;

/**
 * Lazy load PGlite
 */
async function getPGlite(): Promise<PGlite> {
  if (!pglite) {
    try {
      ensureDBDirectory();
      const dbPath = getDBPath();
      pglite = new PGlite(`file://${dbPath}`);
      await pglite.ready;
    } catch (error) {
      throw new Error(
        `PGlite initialization failed. Run: npm install @electric-sql/pglite\n${error}`
      );
    }
  }
  return pglite;
}

/**
 * Create PGlite database connection
 */
export async function createPGliteDatabase(): Promise<DatabaseInstance> {
  const db = await getPGlite();

  return {
    async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
      try {
        const result = await db.query(sql, params);
        return result.rows as T[];
      } catch (error) {
        throw new Error(
          `Query failed: ${error instanceof Error ? error.message : String(error)}\nSQL: ${sql}`
        );
      }
    },

    async run(sql: string, params?: unknown[]): Promise<{ changes: number }> {
      try {
        const result = await db.query(sql, params);
        return { changes: result.affectedRows || 0 };
      } catch (error) {
        throw new Error(
          `Run failed: ${error instanceof Error ? error.message : String(error)}\nSQL: ${sql}`
        );
      }
    },

    async close(): Promise<void> {
      if (pglite) {
        await pglite.close();
        pglite = null;
      }
    },
  };
}

