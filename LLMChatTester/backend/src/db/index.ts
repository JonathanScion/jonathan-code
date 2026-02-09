import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function initDatabase() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.warn('DATABASE_URL not set - database features will be disabled');
    return;
  }

  const client = postgres(connectionString, {
    ssl: 'require',
    max: 10, // Connection pool size
  });

  db = drizzle(client, { schema });
  console.log('Database connection initialized');
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function isDatabaseEnabled(): boolean {
  return db !== null;
}

// Re-export schema for convenience
export * from './schema.js';
