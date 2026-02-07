import { connectToolDefinition, handleConnect } from './connect.js';
import { describeSchemaToolDefinition, handleDescribeSchema } from './describe-schema.js';
import { addExampleToolDefinition, handleAddExample } from './add-example.js';
import { englishToSqlToolDefinition, handleEnglishToSql } from './english-to-sql.js';
import { sqlToEnglishToolDefinition, handleSqlToEnglish } from './sql-to-english.js';

export const tools = [
  connectToolDefinition,
  describeSchemaToolDefinition,
  addExampleToolDefinition,
  englishToSqlToolDefinition,
  sqlToEnglishToolDefinition,
];

export async function handleToolCall(
  name: string,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  switch (name) {
    case 'connect':
      return handleConnect(args);
    case 'describe_schema':
      return handleDescribeSchema(args);
    case 'add_example':
      return handleAddExample(args);
    case 'english_to_sql':
      return handleEnglishToSql(args);
    case 'sql_to_english':
      return handleSqlToEnglish(args);
    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
}
