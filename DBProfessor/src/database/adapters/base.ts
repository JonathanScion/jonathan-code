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

export abstract class DatabaseAdapter {
  protected connectionString: string;
  protected connected: boolean = false;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract isConnected(): boolean;

  // Introspection methods
  abstract getTables(): Promise<TableInfo[]>;
  abstract getColumns(tableName: string): Promise<ColumnInfo[]>;
  abstract getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]>;
  abstract getIndexes(tableName: string): Promise<IndexInfo[]>;
  abstract getViews(): Promise<ViewInfo[]>;
  abstract getStoredProcedures(): Promise<StoredProcedureInfo[]>;
  abstract getSampleData(tableName: string, limit?: number): Promise<SampleData>;

  // Query execution
  abstract executeQuery(sql: string): Promise<unknown[]>;

  // Full schema introspection
  abstract introspect(): Promise<SchemaInfo>;
}
