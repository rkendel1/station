/**
 * Environment variable utilities
 */

export function getEnv(key: string, defaultValue?: string): string | undefined {
  const value = process.env[key];
  return value || defaultValue;
}

export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable not set: ${key}`);
  }
  return value;
}

export function getEnvBoolean(key: string, defaultValue = false): boolean {
  const value = getEnv(key);
  if (value === undefined) {
    return defaultValue;
  }
  return value.toLowerCase() === "true" || value === "1";
}

export function getEnvNumber(key: string, defaultValue = 0): number {
  const value = getEnv(key);
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}
