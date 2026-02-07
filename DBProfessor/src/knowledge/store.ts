import type { Database } from 'sql.js';
import crypto from 'crypto';
import { initializeKnowledgeDB, saveDatabase } from './schema.js';
import type { SchemaInfo } from '../database/types.js';

export interface Example {
  id: number;
  englishDescription: string;
  sqlQuery: string;
  tablesInvolved: string[];
  queryType: string;
  createdAt: string;
  usageCount: number;
}

export interface RetrievedExample extends Example {
  relevanceScore: number;
}

export class KnowledgeStore {
  private static instance: KnowledgeStore;
  private db: Database | null = null;
  private initialized: boolean = false;

  private constructor() {}

  static getInstance(): KnowledgeStore {
    if (!KnowledgeStore.instance) {
      KnowledgeStore.instance = new KnowledgeStore();
    }
    return KnowledgeStore.instance;
  }

  async ensureInitialized(): Promise<Database> {
    if (!this.initialized || !this.db) {
      this.db = await initializeKnowledgeDB();
      this.initialized = true;
    }
    return this.db;
  }

  private hashConnection(connectionString: string): string {
    return crypto.createHash('sha256').update(connectionString).digest('hex').slice(0, 16);
  }

  async getOrCreateConnection(connectionString: string, databaseType: string): Promise<number> {
    const db = await this.ensureInitialized();
    const hash = this.hashConnection(connectionString);

    // Check for existing connection
    const existing = db.exec('SELECT id FROM connections WHERE connection_hash = ?', [hash]);

    if (existing.length > 0 && existing[0].values.length > 0) {
      const id = existing[0].values[0][0] as number;
      db.run('UPDATE connections SET last_used_at = datetime("now") WHERE id = ?', [id]);
      saveDatabase(db);
      return id;
    }

    // Create new connection
    db.run('INSERT INTO connections (connection_hash, database_type) VALUES (?, ?)', [
      hash,
      databaseType,
    ]);
    saveDatabase(db);

    // Get the last inserted ID
    const result = db.exec('SELECT last_insert_rowid()');
    return result[0].values[0][0] as number;
  }

  async cacheSchema(connectionId: number, schema: SchemaInfo): Promise<void> {
    const db = await this.ensureInitialized();

    // Remove old cache
    db.run('DELETE FROM schema_cache WHERE connection_id = ?', [connectionId]);

    // Insert new cache
    db.run(
      'INSERT INTO schema_cache (connection_id, schema_json, introspected_at) VALUES (?, ?, ?)',
      [connectionId, JSON.stringify(schema), schema.introspectedAt]
    );

    saveDatabase(db);
  }

  async getCachedSchema(connectionId: number): Promise<SchemaInfo | null> {
    const db = await this.ensureInitialized();

    const result = db.exec(
      'SELECT schema_json FROM schema_cache WHERE connection_id = ? ORDER BY introspected_at DESC LIMIT 1',
      [connectionId]
    );

    if (result.length > 0 && result[0].values.length > 0) {
      return JSON.parse(result[0].values[0][0] as string);
    }

    return null;
  }

  async addExample(
    connectionId: number,
    englishDescription: string,
    sqlQuery: string,
    tablesInvolved: string[] = [],
    queryType: string = 'UNKNOWN'
  ): Promise<number> {
    const db = await this.ensureInitialized();

    db.run(
      'INSERT INTO examples (connection_id, english_description, sql_query, tables_involved, query_type) VALUES (?, ?, ?, ?, ?)',
      [
        connectionId,
        englishDescription,
        sqlQuery,
        JSON.stringify(tablesInvolved),
        queryType.toUpperCase(),
      ]
    );

    saveDatabase(db);

    // Get the last inserted ID
    const result = db.exec('SELECT last_insert_rowid()');
    return result[0].values[0][0] as number;
  }

  async searchExamples(
    connectionId: number,
    query: string,
    limit: number = 10
  ): Promise<RetrievedExample[]> {
    const db = await this.ensureInitialized();

    // Simple LIKE-based search (sql.js doesn't support FTS5)
    const searchPattern = `%${query.toLowerCase()}%`;

    const result = db.exec(
      `
      SELECT
        id, english_description, sql_query, tables_involved,
        query_type, created_at, usage_count
      FROM examples
      WHERE connection_id = ?
        AND LOWER(english_description) LIKE ?
      ORDER BY usage_count DESC, created_at DESC
      LIMIT ?
    `,
      [connectionId, searchPattern, limit]
    );

    if (result.length === 0) {
      return [];
    }

    const columns = result[0].columns;
    return result[0].values.map((row, index) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });

      return {
        id: obj.id as number,
        englishDescription: obj.english_description as string,
        sqlQuery: obj.sql_query as string,
        tablesInvolved: JSON.parse((obj.tables_involved as string) || '[]'),
        queryType: obj.query_type as string,
        createdAt: obj.created_at as string,
        usageCount: obj.usage_count as number,
        relevanceScore: 1 / (index + 1), // Simple relevance based on position
      };
    });
  }

  async getAllExamples(connectionId: number): Promise<Example[]> {
    const db = await this.ensureInitialized();

    const result = db.exec(
      `
      SELECT
        id, english_description, sql_query, tables_involved,
        query_type, created_at, usage_count
      FROM examples
      WHERE connection_id = ?
      ORDER BY usage_count DESC, created_at DESC
    `,
      [connectionId]
    );

    if (result.length === 0) {
      return [];
    }

    const columns = result[0].columns;
    return result[0].values.map((row) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });

      return {
        id: obj.id as number,
        englishDescription: obj.english_description as string,
        sqlQuery: obj.sql_query as string,
        tablesInvolved: JSON.parse((obj.tables_involved as string) || '[]'),
        queryType: obj.query_type as string,
        createdAt: obj.created_at as string,
        usageCount: obj.usage_count as number,
      };
    });
  }

  async incrementUsage(exampleId: number): Promise<void> {
    const db = await this.ensureInitialized();

    db.run(
      'UPDATE examples SET usage_count = usage_count + 1, last_used_at = datetime("now") WHERE id = ?',
      [exampleId]
    );

    saveDatabase(db);
  }

  async getExampleCount(connectionId: number): Promise<number> {
    const db = await this.ensureInitialized();

    const result = db.exec('SELECT COUNT(*) as count FROM examples WHERE connection_id = ?', [
      connectionId,
    ]);

    if (result.length > 0 && result[0].values.length > 0) {
      return result[0].values[0][0] as number;
    }

    return 0;
  }

  close(): void {
    if (this.db) {
      saveDatabase(this.db);
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }
}
