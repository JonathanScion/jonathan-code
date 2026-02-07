import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import fs from 'fs';

// Store data in user's home directory for persistence across npx runs
function getDataDir(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const dataDir = path.join(homeDir, '.db-professor');

  // Create directory if it doesn't exist
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  return dataDir;
}

function getDbPath(): string {
  return path.join(getDataDir(), 'knowledge.db');
}

let dbInstance: Database | null = null;

export async function initializeKnowledgeDB(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  const SQL = await initSqlJs();
  const dbPath = getDbPath();

  // Load existing database or create new one
  let db: Database;
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    -- Store database connection metadata
    CREATE TABLE IF NOT EXISTS connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      connection_hash TEXT UNIQUE NOT NULL,
      database_type TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      last_used_at TEXT DEFAULT (datetime('now'))
    );

    -- Store cached schema information
    CREATE TABLE IF NOT EXISTS schema_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      connection_id INTEGER NOT NULL,
      schema_json TEXT NOT NULL,
      introspected_at TEXT NOT NULL,
      FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
    );

    -- Store SQL + English example pairs
    CREATE TABLE IF NOT EXISTS examples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      connection_id INTEGER NOT NULL,
      english_description TEXT NOT NULL,
      sql_query TEXT NOT NULL,
      tables_involved TEXT,
      query_type TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      usage_count INTEGER DEFAULT 0,
      last_used_at TEXT,
      FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_examples_connection
      ON examples(connection_id);
    CREATE INDEX IF NOT EXISTS idx_examples_query_type
      ON examples(query_type);
    CREATE INDEX IF NOT EXISTS idx_examples_usage
      ON examples(usage_count DESC);
  `);

  dbInstance = db;

  // Save the database after initialization
  saveDatabase(db);

  return db;
}

export function saveDatabase(db: Database): void {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(getDbPath(), buffer);
}

export function getDatabase(): Database | null {
  return dbInstance;
}
