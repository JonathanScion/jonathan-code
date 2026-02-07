import { z } from 'zod';
import { ConnectionManager } from '../database/connection-manager.js';
import { KnowledgeStore } from '../knowledge/store.js';

export const addExampleToolDefinition = {
  name: 'add_example',
  description:
    'Store a SQL query paired with its English description to teach the system SQL patterns',
  inputSchema: {
    type: 'object' as const,
    properties: {
      englishDescription: {
        type: 'string',
        description:
          'Natural language description of what the query does (e.g., "Find all users who signed up last month")',
      },
      sqlQuery: {
        type: 'string',
        description: 'The SQL query that accomplishes the described task',
      },
      tablesInvolved: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of table names used in the query (auto-detected if not provided)',
      },
    },
    required: ['englishDescription', 'sqlQuery'],
  },
};

const inputSchema = z.object({
  englishDescription: z.string(),
  sqlQuery: z.string(),
  tablesInvolved: z.array(z.string()).optional(),
});

function detectQueryType(sql: string): string {
  const normalized = sql.trim().toUpperCase();
  if (normalized.startsWith('SELECT')) return 'SELECT';
  if (normalized.startsWith('INSERT')) return 'INSERT';
  if (normalized.startsWith('UPDATE')) return 'UPDATE';
  if (normalized.startsWith('DELETE')) return 'DELETE';
  if (normalized.startsWith('CREATE')) return 'CREATE';
  if (normalized.startsWith('ALTER')) return 'ALTER';
  if (normalized.startsWith('DROP')) return 'DROP';
  return 'OTHER';
}

function extractTableNames(sql: string): string[] {
  // Simple regex-based table extraction
  const patterns = [
    /FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /UPDATE\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
  ];

  const tables = new Set<string>();
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(sql)) !== null) {
      tables.add(match[1].toLowerCase());
    }
  }
  return Array.from(tables);
}

export async function handleAddExample(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  try {
    const { englishDescription, sqlQuery, tablesInvolved } = inputSchema.parse(args);

    const connManager = ConnectionManager.getInstance();
    const knowledgeStore = KnowledgeStore.getInstance();

    if (!connManager.isConnected()) {
      return {
        content: [{ type: 'text', text: 'No database connected. Use the connect tool first.' }],
        isError: true,
      };
    }

    const connectionString = connManager.getConnectionString();
    const databaseType = connManager.getDatabaseType();

    if (!connectionString || !databaseType) {
      return {
        content: [{ type: 'text', text: 'Connection information not available.' }],
        isError: true,
      };
    }

    const connectionId = await knowledgeStore.getOrCreateConnection(connectionString, databaseType);

    // Auto-detect query type
    const queryType = detectQueryType(sqlQuery);

    // Auto-detect tables if not provided
    const tables = tablesInvolved || extractTableNames(sqlQuery);

    const exampleId = await knowledgeStore.addExample(
      connectionId,
      englishDescription,
      sqlQuery,
      tables,
      queryType
    );

    const exampleCount = await knowledgeStore.getExampleCount(connectionId);

    return {
      content: [
        {
          type: 'text',
          text:
            `Example added successfully (ID: ${exampleId}).\n\n` +
            `- Description: "${englishDescription}"\n` +
            `- Query Type: ${queryType}\n` +
            `- Tables: ${tables.join(', ') || 'none detected'}\n\n` +
            `Total examples for this database: ${exampleCount}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        { type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      ],
      isError: true,
    };
  }
}
