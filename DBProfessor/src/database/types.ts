export interface TableInfo {
  name: string;
  schema: string;
  type: string;
  columns?: ColumnInfo[];
  foreignKeys?: ForeignKeyInfo[];
  indexes?: IndexInfo[];
  sampleData?: SampleData;
}

export interface ColumnInfo {
  name: string;
  dataType: string;
  udtName?: string;
  columnType?: string;
  maxLength: number | null;
  precision: number | null;
  scale: number | null;
  nullable: boolean;
  defaultValue: string | null;
}

export interface ForeignKeyInfo {
  constraintName: string;
  columnName: string;
  foreignTableName: string;
  foreignColumnName: string;
}

export interface IndexInfo {
  name: string;
  tableName: string;
  definition: string;
}

export interface ViewInfo {
  name: string;
  definition: string | null;
}

export interface StoredProcedureInfo {
  name: string;
  type: string;
  returnType: string | null;
  definition: string | null;
}

export interface SampleData {
  tableName: string;
  rows: Record<string, unknown>[];
}

export interface SchemaInfo {
  databaseType: 'postgresql' | 'mysql';
  tables: TableInfo[];
  views: ViewInfo[];
  storedProcedures: StoredProcedureInfo[];
  introspectedAt: string;
}

export type DatabaseType = 'postgresql' | 'mysql';
