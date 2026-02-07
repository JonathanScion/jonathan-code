export class DatabaseConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseConnectionError';
  }
}

export class UnsupportedDatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedDatabaseError';
  }
}

export class SchemaIntrospectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchemaIntrospectionError';
  }
}

export class KnowledgeStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KnowledgeStoreError';
  }
}
