import { z } from 'zod';
import { ConnectionManager } from '../database/connection-manager.js';
import { KnowledgeStore } from '../knowledge/store.js';

export const englishToSqlToolDefinition = {
  name: 'english_to_sql',
  description:
    'Translate an English description to SQL using accumulated knowledge and schema context',
  inputSchema: {
    type: 'object' as const,
    properties: {
      englishQuery: {
        type: 'string',
        description:
          'Natural language description of the data you want to retrieve or operation to perform',
      },
      executeQuery: {
        type: 'boolean',
        description: 'If true, execute the generated query and return results (default: false)',
      },
    },
    required: ['englishQuery'],
  },
};

const inputSchema = z.object({
  englishQuery: z.string(),
  executeQuery: z.boolean().optional().default(false),
});

export async function handleEnglishToSql(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  try {
    const { englishQuery, executeQuery } = inputSchema.parse(args);

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

    // Retrieve similar examples
    const examples = await knowledgeStore.searchExamples(connectionId, englishQuery, 5);

    // Get schema context
    const schema = await knowledgeStore.getCachedSchema(connectionId);

    // Build context for response
    let output = `# English to SQL Translation\n\n`;
    output += `**Input:** "${englishQuery}"\n\n`;

    if (examples.length > 0) {
      output += `## Similar Examples Found (${examples.length})\n\n`;

      for (const example of examples) {
        output += `### Example (Relevance: ${example.relevanceScore.toFixed(2)})\n`;
        output += `- **Description:** ${example.englishDescription}\n`;
        output += `- **SQL:**\n\`\`\`sql\n${example.sqlQuery}\n\`\`\`\n`;
        output += `- **Tables:** ${example.tablesInvolved.join(', ')}\n\n`;

        // Increment usage for top result
        if (example === examples[0]) {
          await knowledgeStore.incrementUsage(example.id);
        }
      }

      // Suggest SQL based on top match
      const topMatch = examples[0];
      output += `## Suggested SQL (based on closest match)\n`;
      output += `\`\`\`sql\n${topMatch.sqlQuery}\n\`\`\`\n\n`;
      output += `*Note: You may need to modify this query to match your exact requirements.*\n`;

      if (executeQuery) {
        output += `\n## Query Execution\n`;
        try {
          const adapter = connManager.getAdapter();
          const results = await adapter.executeQuery(topMatch.sqlQuery);
          output += `Results (${results.length} rows):\n`;
          output += '```json\n' + JSON.stringify(results.slice(0, 10), null, 2) + '\n```\n';
          if (results.length > 10) {
            output += `\n*Showing first 10 of ${results.length} rows*\n`;
          }
        } catch (execError) {
          output += `Query execution failed: ${execError instanceof Error ? execError.message : 'Unknown error'}\n`;
        }
      }
    } else {
      output += `## No Similar Examples Found\n\n`;
      output += `I don't have any learned examples for this type of query yet.\n\n`;

      if (schema) {
        output += `### Available Tables\n`;
        output += `Here are the tables in your database that might be relevant:\n`;
        for (const table of schema.tables.slice(0, 10)) {
          output += `- **${table.name}**: ${(table.columns || []).map((c) => c.name).join(', ')}\n`;
        }
        output += `\n*Use add_example to teach me SQL patterns for this database.*\n`;
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
