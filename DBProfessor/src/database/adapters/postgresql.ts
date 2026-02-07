import pg from 'pg';
import { DatabaseAdapter } from './base.js';
import type {
  SchemaInfo,
  TableInfo,
  ColumnInfo,
  ForeignKeyInfo,
  IndexInfo,
  ViewInfo,
  StoredProcedureInfo,
  SampleData,
} from '../types.js';

export class PostgreSQLAdapter extends DatabaseAdapter {
  private pool: pg.Pool | null = null;

  async connect(): Promise<void> {
    this.pool = new pg.Pool({ connectionString: this.connectionString });
    // Test connection
    const client = await this.pool.connect();
    client.release();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected && this.pool !== null;
  }

  async getTables(): Promise<TableInfo[]> {
    const query = `
      SELECT table_name, table_schema, table_type
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        AND table_type = 'BASE TABLE'
      ORDER BY table_schema, table_name
    `;
    const result = await this.pool!.query(query);
    return result.rows.map((row) => ({
      name: row.table_name,
      schema: row.table_schema,
      type: row.table_type,
    }));
  }

  async getColumns(tableName: string): Promise<ColumnInfo[]> {
    const query = `
      SELECT
        column_name,
        data_type,
        character_maximum_length,
        numeric_precision,
        numeric_scale,
        is_nullable,
        column_default,
        udt_name
      FROM information_schema.columns
      WHERE table_name = $1
        AND table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY ordinal_position
    `;
    const result = await this.pool!.query(query, [tableName]);
    return result.rows.map((row) => ({
      name: row.column_name,
      dataType: row.data_type,
      udtName: row.udt_name,
      maxLength: row.character_maximum_length,
      precision: row.numeric_precision,
      scale: row.numeric_scale,
      nullable: row.is_nullable === 'YES',
      defaultValue: row.column_default,
    }));
  }

  async getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
    const query = `
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = $1
    `;
    const result = await this.pool!.query(query, [tableName]);
    return result.rows.map((row) => ({
      constraintName: row.constraint_name,
      columnName: row.column_name,
      foreignTableName: row.foreign_table_name,
      foreignColumnName: row.foreign_column_name,
    }));
  }

  async getIndexes(tableName: string): Promise<IndexInfo[]> {
    const query = `
      SELECT
        indexname AS index_name,
        indexdef AS index_definition,
        tablename AS table_name
      FROM pg_indexes
      WHERE tablename = $1
        AND schemaname NOT IN ('pg_catalog', 'information_schema')
    `;
    const result = await this.pool!.query(query, [tableName]);
    return result.rows.map((row) => ({
      name: row.index_name,
      definition: row.index_definition,
      tableName: row.table_name,
    }));
  }

  async getViews(): Promise<ViewInfo[]> {
    const query = `
      SELECT table_name, view_definition
      FROM information_schema.views
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
    `;
    const result = await this.pool!.query(query);
    return result.rows.map((row) => ({
      name: row.table_name,
      definition: row.view_definition,
    }));
  }

  async getStoredProcedures(): Promise<StoredProcedureInfo[]> {
    const query = `
      SELECT
        routine_name,
        routine_type,
        data_type AS return_type,
        routine_definition
      FROM information_schema.routines
      WHERE routine_schema NOT IN ('pg_catalog', 'information_schema')
        AND routine_type IN ('FUNCTION', 'PROCEDURE')
    `;
    const result = await this.pool!.query(query);
    return result.rows.map((row) => ({
      name: row.routine_name,
      type: row.routine_type,
      returnType: row.return_type,
      definition: row.routine_definition,
    }));
  }

  async getSampleData(tableName: string, limit: number = 5): Promise<SampleData> {
    // Sanitize table name to prevent SQL injection
    const safeTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    const query = `SELECT * FROM "${safeTableName}" LIMIT ${limit}`;
    try {
      const result = await this.pool!.query(query);
      return {
        tableName,
        rows: result.rows,
      };
    } catch {
      // Return empty if table can't be sampled (permissions, etc.)
      return {
        tableName,
        rows: [],
      };
    }
  }

  async executeQuery(sql: string): Promise<unknown[]> {
    const result = await this.pool!.query(sql);
    return result.rows;
  }

  async introspect(): Promise<SchemaInfo> {
    const tables = await this.getTables();
    const tablesWithDetails = await Promise.all(
      tables.map(async (table) => ({
        ...table,
        columns: await this.getColumns(table.name),
        foreignKeys: await this.getForeignKeys(table.name),
        indexes: await this.getIndexes(table.name),
        sampleData: await this.getSampleData(table.name, 3),
      }))
    );

    return {
      databaseType: 'postgresql',
      tables: tablesWithDetails,
      views: await this.getViews(),
      storedProcedures: await this.getStoredProcedures(),
      introspectedAt: new Date().toISOString(),
    };
  }
}
