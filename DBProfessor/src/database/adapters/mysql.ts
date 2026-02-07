import mysql from 'mysql2/promise';
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

interface MySQLRow {
  [key: string]: unknown;
}

export class MySQLAdapter extends DatabaseAdapter {
  private connection: mysql.Connection | null = null;
  private databaseName: string = '';

  async connect(): Promise<void> {
    this.connection = await mysql.createConnection(this.connectionString);
    // Extract database name from connection
    const [rows] = await this.connection.execute('SELECT DATABASE() as db');
    this.databaseName = (rows as MySQLRow[])[0].db as string;
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected && this.connection !== null;
  }

  async getTables(): Promise<TableInfo[]> {
    const query = `
      SELECT table_name, table_schema, table_type
      FROM information_schema.tables
      WHERE table_schema = ?
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    const [rows] = await this.connection!.execute(query, [this.databaseName]);
    return (rows as MySQLRow[]).map((row) => ({
      name: (row.TABLE_NAME || row.table_name) as string,
      schema: (row.TABLE_SCHEMA || row.table_schema) as string,
      type: (row.TABLE_TYPE || row.table_type) as string,
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
        column_type
      FROM information_schema.columns
      WHERE table_name = ?
        AND table_schema = ?
      ORDER BY ordinal_position
    `;
    const [rows] = await this.connection!.execute(query, [tableName, this.databaseName]);
    return (rows as MySQLRow[]).map((row) => ({
      name: (row.COLUMN_NAME || row.column_name) as string,
      dataType: (row.DATA_TYPE || row.data_type) as string,
      columnType: (row.COLUMN_TYPE || row.column_type) as string,
      maxLength: (row.CHARACTER_MAXIMUM_LENGTH || row.character_maximum_length) as number | null,
      precision: (row.NUMERIC_PRECISION || row.numeric_precision) as number | null,
      scale: (row.NUMERIC_SCALE || row.numeric_scale) as number | null,
      nullable: (row.IS_NULLABLE || row.is_nullable) === 'YES',
      defaultValue: (row.COLUMN_DEFAULT || row.column_default) as string | null,
    }));
  }

  async getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
    const query = `
      SELECT
        constraint_name,
        column_name,
        referenced_table_name,
        referenced_column_name
      FROM information_schema.key_column_usage
      WHERE table_name = ?
        AND table_schema = ?
        AND referenced_table_name IS NOT NULL
    `;
    const [rows] = await this.connection!.execute(query, [tableName, this.databaseName]);
    return (rows as MySQLRow[]).map((row) => ({
      constraintName: (row.CONSTRAINT_NAME || row.constraint_name) as string,
      columnName: (row.COLUMN_NAME || row.column_name) as string,
      foreignTableName: (row.REFERENCED_TABLE_NAME || row.referenced_table_name) as string,
      foreignColumnName: (row.REFERENCED_COLUMN_NAME || row.referenced_column_name) as string,
    }));
  }

  async getIndexes(tableName: string): Promise<IndexInfo[]> {
    const safeTableName = tableName.replace(/`/g, '');
    const query = `SHOW INDEX FROM \`${safeTableName}\``;
    const [rows] = await this.connection!.execute(query);

    // Group by index name
    const indexMap = new Map<string, IndexInfo>();
    for (const row of rows as MySQLRow[]) {
      const indexName = row.Key_name as string;
      if (!indexMap.has(indexName)) {
        indexMap.set(indexName, {
          name: indexName,
          tableName,
          definition: `${row.Non_unique ? '' : 'UNIQUE '}INDEX on ${row.Column_name}`,
        });
      }
    }
    return Array.from(indexMap.values());
  }

  async getViews(): Promise<ViewInfo[]> {
    const query = `
      SELECT table_name, view_definition
      FROM information_schema.views
      WHERE table_schema = ?
    `;
    const [rows] = await this.connection!.execute(query, [this.databaseName]);
    return (rows as MySQLRow[]).map((row) => ({
      name: (row.TABLE_NAME || row.table_name) as string,
      definition: (row.VIEW_DEFINITION || row.view_definition) as string | null,
    }));
  }

  async getStoredProcedures(): Promise<StoredProcedureInfo[]> {
    const query = `
      SELECT
        routine_name,
        routine_type,
        data_type,
        routine_definition
      FROM information_schema.routines
      WHERE routine_schema = ?
    `;
    const [rows] = await this.connection!.execute(query, [this.databaseName]);
    return (rows as MySQLRow[]).map((row) => ({
      name: (row.ROUTINE_NAME || row.routine_name) as string,
      type: (row.ROUTINE_TYPE || row.routine_type) as string,
      returnType: (row.DATA_TYPE || row.data_type) as string | null,
      definition: (row.ROUTINE_DEFINITION || row.routine_definition) as string | null,
    }));
  }

  async getSampleData(tableName: string, limit: number = 5): Promise<SampleData> {
    const safeTableName = tableName.replace(/`/g, '');
    const query = `SELECT * FROM \`${safeTableName}\` LIMIT ${limit}`;
    try {
      const [rows] = await this.connection!.execute(query);
      return {
        tableName,
        rows: rows as Record<string, unknown>[],
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
    const [rows] = await this.connection!.execute(sql);
    return rows as unknown[];
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
      databaseType: 'mysql',
      tables: tablesWithDetails,
      views: await this.getViews(),
      storedProcedures: await this.getStoredProcedures(),
      introspectedAt: new Date().toISOString(),
    };
  }
}
