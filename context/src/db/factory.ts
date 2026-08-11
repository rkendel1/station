/**
 * Factory for creating ContextStore instances
 * Manages the singleton instance
 */

import { ContextStore } from "./store.js";
import { SQLiteContextStore } from "./sqlite-store.js";
import { getDatabase } from "./client.js";

let storeInstance: ContextStore | null = null;

/**
 * Get or create the default ContextStore instance
 * Currently uses SQLite as the default backend
 */
export async function getContextStore(): Promise<ContextStore> {
  if (storeInstance) {
    return storeInstance;
  }

  const db = await getDatabase();
  storeInstance = new SQLiteContextStore(db);
  return storeInstance;
}

/**
 * Close the ContextStore instance
 */
export async function closeContextStore(): Promise<void> {
  if (storeInstance) {
    await storeInstance.close();
    storeInstance = null;
  }
}

/**
 * Reset the ContextStore instance (for testing)
 */
export function resetContextStore(): void {
  storeInstance = null;
}
