import { PostgreSQLAdapter } from './adapters/postgresql.js';
import { MySQLAdapter } from './adapters/mysql.js';
import { DatabaseAdapter } from './adapters/base.js';
import { DatabaseConnectionError, UnsupportedDatabaseError } from '../utils/errors.js';
import type { DatabaseType } from './types.js';

export class ConnectionManager {
  private static instance: ConnectionManager;
  private currentAdapter: DatabaseAdapter | null = null;
  private currentType: DatabaseType | null = null;
  private currentConnectionString: string | null = null;

  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  async connect(connectionString: string, type: DatabaseType): Promise<void> {
    // Disconnect existing connection if any
    if (this.currentAdapter) {
      await this.disconnect();
    }

    try {
      switch (type) {
        case 'postgresql':
          this.currentAdapter = new PostgreSQLAdapter(connectionString);
          break;
        case 'mysql':
          this.currentAdapter = new MySQLAdapter(connectionString);
          break;
        default:
          throw new UnsupportedDatabaseError(`Unsupported database type: ${type}`);
      }

      await this.currentAdapter.connect();
      this.currentType = type;
      this.currentConnectionString = connectionString;
    } catch (error) {
      this.currentAdapter = null;
      this.currentType = null;
      this.currentConnectionString = null;

      if (error instanceof UnsupportedDatabaseError) {
        throw error;
      }

      throw new DatabaseConnectionError(
        `Failed to connect to ${type} database: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async disconnect(): Promise<void> {
    if (this.currentAdapter) {
      await this.currentAdapter.disconnect();
      this.currentAdapter = null;
      this.currentType = null;
      this.currentConnectionString = null;
    }
  }

  getAdapter(): DatabaseAdapter {
    if (!this.currentAdapter) {
      throw new DatabaseConnectionError(
        'No database connection established. Use the connect tool first.'
      );
    }
    return this.currentAdapter;
  }

  getDatabaseType(): DatabaseType | null {
    return this.currentType;
  }

  getConnectionString(): string | null {
    return this.currentConnectionString;
  }

  isConnected(): boolean {
    return this.currentAdapter?.isConnected() ?? false;
  }
}
