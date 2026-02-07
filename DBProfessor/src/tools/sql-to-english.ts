import { z } from 'zod';
import { ConnectionManager } from '../database/connection-manager.js';
import { KnowledgeStore } from '../knowledge/store.js';
import type { SchemaInfo } from '../database/types.js';

export const sqlToEnglishToolDefinition = {
  name: 'sql_to_english',
  description: 'Explain what a SQL query does in plain English, using schema context',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sqlQuery: {
        type: 'string',
        description: 'The SQL query to explain',
      },
      detailed: {
        type: 'boolean',
        description:
          'Provide detailed explanation including column types and relationships (default: false)',
      },
    },
    required: ['sqlQuery'],
  },
};

const inputSchema = z.object({
  sqlQuery: z.string(),
  detailed: z.boolean().optional().default(false),
});

interface QueryAnalysis {
  type: string;
  tables: string[];
  columns: string[];
  conditions: string[];
  joins: string[];
  orderBy: string[];
  groupBy: string[];
  limit: number | null;
}

function analyzeQuery(sql: string): QueryAnalysis {
  const normalized = sql.trim().toUpperCase();

  let type = 'UNKNOWN';
  if (normalized.startsWith('SELECT')) type = 'SELECT';
  else if (normalized.startsWith('INSERT')) type = 'INSERT';
  else if (normalized.startsWith('UPDATE')) type = 'UPDATE';
  else if (normalized.startsWith('DELETE')) type = 'DELETE';

  // Extract tables
  const tableMatches = [
    ...sql.matchAll(/FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi),
    ...sql.matchAll(/JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi),
    ...sql.matchAll(/INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi),
    ...sql.matchAll(/UPDATE\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi),
  ];
  const tables = [...new Set(tableMatches.map((m) => m[1]))];

  // Extract joins
  const joinMatches = [...sql.matchAll(/(LEFT|RIGHT|INNER|OUTER|CROSS)?\s*JOIN\s+(\w+)/gi)];
  const joins = joinMatches.map((m) => `${m[1] || 'INNER'} JOIN ${m[2]}`);

  // Detect LIMIT
  const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
  const limit = limitMatch ? parseInt(limitMatch[1]) : null;

  // Extract WHERE conditions (simplified)
  const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER|GROUP|LIMIT|$)/is);
  const conditions = whereMatch ? [whereMatch[1].trim()] : [];

  // Extract ORDER BY
  const orderMatch = sql.match(/ORDER\s+BY\s+(.+?)(?:LIMIT|$)/is);
  const orderBy = orderMatch ? [orderMatch[1].trim()] : [];

  // Extract GROUP BY
  const groupMatch = sql.match(/GROUP\s+BY\s+(.+?)(?:HAVING|ORDER|LIMIT|$)/is);
  const groupBy = groupMatch ? [groupMatch[1].trim()] : [];

  return {
    type,
    tables,
    columns: [],
    conditions,
    joins,
    orderBy,
    groupBy,
    limit,
  };
}

function generatePlainEnglish(analysis: QueryAnalysis, _schema: SchemaInfo | null): string {
  let explanation = '';

  switch (analysis.type) {
    case 'SELECT':
      explanation = `Retrieves data from ${analysis.tables.join(' and ')}`;
      if (analysis.joins.length > 0) {
        explanation += `, combining related records using ${analysis.joins.length} join(s)`;
      }
      if (analysis.conditions.length > 0) {
        explanation += `, filtered by specific conditions`;
      }
      if (analysis.groupBy.length > 0) {
        explanation += `, grouped by ${analysis.groupBy.join(', ')}`;
      }
      if (analysis.orderBy.length > 0) {
        explanation += `, sorted by ${analysis.orderBy.join(', ')}`;
      }
      if (analysis.limit) {
        explanation += `, limited to ${analysis.limit} result(s)`;
      }
      break;
    case 'INSERT':
      explanation = `Adds new record(s) into ${analysis.tables.join(', ')}`;
      break;
    case 'UPDATE':
      explanation = `Modifies existing record(s) in ${analysis.tables.join(', ')}`;
      if (analysis.conditions.length > 0) {
        explanation += ` where specific conditions are met`;
      }
      break;
    case 'DELETE':
      explanation = `Removes record(s) from ${analysis.tables.join(', ')}`;
      if (analysis.conditions.length > 0) {
        explanation += ` where specific conditions are met`;
      }
      break;
    default:
      explanation = `Performs a ${analysis.type} operation`;
  }

  return explanation + '.';
}

export async function handleSqlToEnglish(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  try {
    const { sqlQuery, detailed } = inputSchema.parse(args);

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

    const schema = await knowledgeStore.getCachedSchema(connectionId);
    const examples = await knowledgeStore.getAllExamples(connectionId);

    // Parse and analyze the query
    const analysis = analyzeQuery(sqlQuery);

    let output = `# SQL Query Explanation\n\n`;
    output += `## Query\n\`\`\`sql\n${sqlQuery}\n\`\`\`\n\n`;

    output += `## Summary\n`;
    output += `This is a **${analysis.type}** query`;
    if (analysis.tables.length > 0) {
      output += ` involving the table(s): **${analysis.tables.join(', ')}**`;
    }
    output += `.\n\n`;

    // Plain English explanation
    output += `## Plain English\n`;
    output += generatePlainEnglish(analysis, schema);
    output += `\n\n`;

    if (detailed && schema) {
      output += `## Detailed Analysis\n`;

      for (const tableName of analysis.tables) {
        const table = schema.tables.find(
          (t) => t.name.toLowerCase() === tableName.toLowerCase()
        );
        if (table) {
          output += `\n### Table: ${table.name}\n`;
          output += `Columns:\n`;
          for (const col of table.columns || []) {
            output += `- ${col.name}: ${col.dataType}${col.nullable ? ' (nullable)' : ''}\n`;
          }
          if (table.foreignKeys?.length) {
            output += `\nRelationships:\n`;
            for (const fk of table.foreignKeys) {
              output += `- ${fk.columnName} references ${fk.foreignTableName}.${fk.foreignColumnName}\n`;
            }
          }
        }
      }
    }

    // Check for similar stored examples
    const matchingExamples = examples
      .filter((e) => e.sqlQuery.toLowerCase().includes(analysis.tables[0]?.toLowerCase() || ''))
      .slice(0, 3);

    if (matchingExamples.length > 0) {
      output += `\n## Related Examples\n`;
      for (const ex of matchingExamples) {
        output += `- "${ex.englishDescription}"\n`;
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
