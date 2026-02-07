import { z } from 'zod';
import { ConnectionManager } from '../database/connection-manager.js';
import { KnowledgeStore } from '../knowledge/store.js';

export const describeSchemaToolDefinition = {
  name: 'describe_schema',
  description:
    'Return the learned database structure including tables, columns, relationships, views, and stored procedures',
  inputSchema: {
    type: 'object' as const,
    properties: {
      tableName: {
        type: 'string',
        description: 'Optional: specific table name to describe in detail',
      },
      includeSamples: {
        type: 'boolean',
        description: 'Include sample data rows (default: false)',
      },
      refresh: {
        type: 'boolean',
        description: 'Force refresh schema from database (default: false, uses cached)',
      },
    },
    required: [],
  },
};

const inputSchema = z.object({
  tableName: z.string().optional(),
  includeSamples: z.boolean().optional().default(false),
  refresh: z.boolean().optional().default(false),
});

export async function handleDescribeSchema(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  try {
    const { tableName, includeSamples, refresh } = inputSchema.parse(args);

    const connManager = ConnectionManager.getInstance();
    const knowledgeStore = KnowledgeStore.getInstance();

    if (!connManager.isConnected()) {
      return {
        content: [{ type: 'text', text: 'No database connected. Use the connect tool first.' }],
        isError: true,
      };
    }

    const adapter = connManager.getAdapter();
    const connectionString = connManager.getConnectionString();
    const databaseType = connManager.getDatabaseType();

    if (!connectionString || !databaseType) {
      return {
        content: [{ type: 'text', text: 'Connection information not available.' }],
        isError: true,
      };
    }

    const connectionId = await knowledgeStore.getOrCreateConnection(connectionString, databaseType);

    let schema = refresh ? null : await knowledgeStore.getCachedSchema(connectionId);

    if (!schema) {
      schema = await adapter.introspect();
      await knowledgeStore.cacheSchema(connectionId, schema);
    }

    // Format output
    let output = `# Database Schema (${schema.databaseType})\n`;
    output += `Introspected at: ${schema.introspectedAt}\n\n`;

    if (tableName) {
      // Detailed view of specific table
      const table = schema.tables.find(
        (t) => t.name.toLowerCase() === tableName.toLowerCase()
      );
      if (!table) {
        return {
          content: [{ type: 'text', text: `Table "${tableName}" not found.` }],
          isError: true,
        };
      }

      output += `## Table: ${table.name}\n\n`;
      output += `### Columns:\n`;
      for (const col of table.columns || []) {
        output += `- **${col.name}**: ${col.dataType}${col.maxLength ? `(${col.maxLength})` : ''}`;
        output += col.nullable ? ' (nullable)' : ' (NOT NULL)';
        if (col.defaultValue) output += ` DEFAULT ${col.defaultValue}`;
        output += '\n';
      }

      if (table.foreignKeys?.length) {
        output += `\n### Foreign Keys:\n`;
        for (const fk of table.foreignKeys) {
          output += `- ${fk.columnName} -> ${fk.foreignTableName}.${fk.foreignColumnName}\n`;
        }
      }

      if (table.indexes?.length) {
        output += `\n### Indexes:\n`;
        for (const idx of table.indexes) {
          output += `- ${idx.name}: ${idx.definition}\n`;
        }
      }

      if (includeSamples && table.sampleData?.rows.length) {
        output += `\n### Sample Data (${table.sampleData.rows.length} rows):\n`;
        output += '```json\n' + JSON.stringify(table.sampleData.rows, null, 2) + '\n```\n';
      }
    } else {
      // Overview of all tables
      output += `## Tables (${schema.tables.length})\n`;
      for (const table of schema.tables) {
        output += `\n### ${table.name}\n`;
        const colSummary = (table.columns || []).map((c) => `${c.name} (${c.dataType})`).join(', ');
        output += `Columns: ${colSummary}\n`;

        if (table.foreignKeys?.length) {
          output += `Foreign Keys: ${table.foreignKeys.map((fk) => `${fk.columnName}->${fk.foreignTableName}`).join(', ')}\n`;
        }
      }

      if (schema.views.length) {
        output += `\n## Views (${schema.views.length})\n`;
        for (const view of schema.views) {
          output += `- ${view.name}\n`;
        }
      }

      if (schema.storedProcedures.length) {
        output += `\n## Stored Procedures/Functions (${schema.storedProcedures.length})\n`;
        for (const proc of schema.storedProcedures) {
          output += `- ${proc.name} (${proc.type})\n`;
        }
      }
    }

    return {
      content: [{ type: 'text', text: output }],
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
