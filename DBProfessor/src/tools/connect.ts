import { z } from 'zod';
import { ConnectionManager } from '../database/connection-manager.js';
import { KnowledgeStore } from '../knowledge/store.js';
import { logger } from '../utils/logger.js';
import type { DatabaseType } from '../database/types.js';

export const connectToolDefinition = {
  name: 'connect',
  description: 'Connect to a PostgreSQL or MySQL database using a connection string',
  inputSchema: {
    type: 'object' as const,
    properties: {
      connectionString: {
        type: 'string',
        description:
          'Database connection string (e.g., postgresql://user:pass@host:5432/db or mysql://user:pass@host:3306/db)',
      },
      databaseType: {
        type: 'string',
        enum: ['postgresql', 'mysql'],
        description: 'Type of database to connect to',
      },
    },
    required: ['connectionString', 'databaseType'],
  },
};

const inputSchema = z.object({
  connectionString: z.string(),
  databaseType: z.enum(['postgresql', 'mysql']),
});

export async function handleConnect(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  try {
    const { connectionString, databaseType } = inputSchema.parse(args);

    const connManager = ConnectionManager.getInstance();
    const knowledgeStore = KnowledgeStore.getInstance();

    await connManager.connect(connectionString, databaseType as DatabaseType);

    // Register connection in knowledge store
    const connectionId = await knowledgeStore.getOrCreateConnection(connectionString, databaseType);

    // Perform initial schema introspection
    const adapter = connManager.getAdapter();
    const schema = await adapter.introspect();

    // Cache the schema
    await knowledgeStore.cacheSchema(connectionId, schema);

    const tableCount = schema.tables.length;
    const viewCount = schema.views.length;
    const procCount = schema.storedProcedures.length;
    const exampleCount = await knowledgeStore.getExampleCount(connectionId);

    logger.info(`Connected to ${databaseType} database`);

    return {
      content: [
        {
          type: 'text',
          text:
            `Successfully connected to ${databaseType} database.\n\n` +
            `Schema Summary:\n` +
            `- Tables: ${tableCount}\n` +
            `- Views: ${viewCount}\n` +
            `- Stored Procedures/Functions: ${procCount}\n` +
            `- Learned Examples: ${exampleCount}\n\n` +
            `Use describe_schema to see the full schema, or add_example to teach me SQL patterns.`,
        },
      ],
    };
  } catch (error) {
    logger.error('Connection failed:', error);
    return {
      content: [
        {
          type: 'text',
          text: `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
}
