# DBProfessor MCP Server

An MCP (Model Context Protocol) server that connects to PostgreSQL and MySQL databases, learns your database schema, and helps translate between English and SQL.

## What is MCP?

Model Context Protocol (MCP) is a standard for connecting AI assistants like Claude to external data sources and tools. When you configure an MCP server, Claude Desktop can use its tools directly in conversation.

**Key concepts:**
- **MCP Server**: A program that exposes tools via the MCP protocol
- **Tools**: Functions that Claude can call (like `connect`, `describe_schema`, etc.)
- **Transport**: How Claude communicates with the server (stdio = standard input/output)

## Features

- **Database Connection**: Connect to PostgreSQL or MySQL via connection string
- **Schema Introspection**: Automatically learn tables, columns, foreign keys, indexes, views, and stored procedures
- **Knowledge Persistence**: Store SQL + English pairs in SQLite for learning
- **English-to-SQL**: Translate natural language to SQL using accumulated knowledge
- **SQL-to-English**: Explain SQL queries in plain English

## Quick Start

### 1. Install Dependencies

```bash
cd DBProfessor
npm install
npm run build
```

### 2. Configure Claude Desktop

Open your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add DBProfessor to the `mcpServers` section:

```json
{
  "mcpServers": {
    "db-professor": {
      "command": "node",
      "args": ["C:/Users/jonat/source/repos/jonathan-code/DBProfessor/dist/index.js"]
    }
  }
}
```

Replace the path with the actual path to your built `dist/index.js` if different.

**Alternative: Using npx (after publishing to npm)**

```json
{
  "mcpServers": {
    "db-professor": {
      "command": "npx",
      "args": ["db-professor"]
    }
  }
}
```

### 3. Restart Claude Desktop

Fully quit Claude Desktop (from system tray/menu bar) and restart it. The MCP server should now be available.

### 4. Verify Installation

In a new Claude conversation, you should be able to use DBProfessor tools. Try:

```
What tools do you have from db-professor?
```

## Usage Examples

### Connect to a Database

```
Use the connect tool with:
- connectionString: postgresql://user:password@localhost:5432/mydb
- databaseType: postgresql
```

Or for MySQL:

```
Connect to my MySQL database at mysql://user:password@localhost:3306/mydb
```

### Explore the Schema

```
Use describe_schema to show me all tables
```

For a specific table with details:

```
Use describe_schema with tableName "users" and includeSamples true
```

### Teach SQL Patterns

The more examples you add, the better DBProfessor becomes at translating English to SQL:

```
Use add_example with:
- englishDescription: "Find all active users who signed up this month"
- sqlQuery: "SELECT * FROM users WHERE status = 'active' AND created_at >= DATE_TRUNC('month', CURRENT_DATE)"
```

### Translate English to SQL

```
Use english_to_sql to help me find all orders placed in the last 7 days
```

### Explain SQL Queries

```
Use sql_to_english to explain:
SELECT u.name, COUNT(o.id)
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id
```

## Tools Reference

| Tool | Description | Required Parameters |
|------|-------------|---------------------|
| `connect` | Connect to a database | `connectionString`, `databaseType` |
| `describe_schema` | Show database structure | None (optional: `tableName`, `includeSamples`, `refresh`) |
| `add_example` | Teach a SQL pattern | `englishDescription`, `sqlQuery` |
| `english_to_sql` | Translate English to SQL | `englishQuery` (optional: `executeQuery`) |
| `sql_to_english` | Explain a SQL query | `sqlQuery` (optional: `detailed`) |

## Supported Databases

| Database | Connection String Format |
|----------|-------------------------|
| PostgreSQL | `postgresql://user:password@host:5432/database` |
| MySQL | `mysql://user:password@host:3306/database` |

## Data Storage

Knowledge is stored in SQLite at:
- **Windows**: `%USERPROFILE%\.db-professor\knowledge.db`
- **macOS/Linux**: `~/.db-professor/knowledge.db`

Each database connection has its own isolated knowledge base (identified by a hash of the connection string).

## Project Structure

```
DBProfessor/
├── src/
│   ├── index.ts                 # Entry point
│   ├── server.ts                # MCP server setup
│   ├── database/
│   │   ├── types.ts             # Type definitions
│   │   ├── connection-manager.ts
│   │   └── adapters/
│   │       ├── base.ts          # Abstract adapter
│   │       ├── postgresql.ts
│   │       └── mysql.ts
│   ├── knowledge/
│   │   ├── schema.ts            # SQLite tables
│   │   └── store.ts             # Knowledge persistence
│   ├── tools/
│   │   ├── index.ts
│   │   ├── connect.ts
│   │   ├── describe-schema.ts
│   │   ├── add-example.ts
│   │   ├── english-to-sql.ts
│   │   └── sql-to-english.ts
│   └── utils/
│       ├── logger.ts
│       └── errors.ts
├── dist/                        # Compiled output
├── data/                        # Local data (git-ignored)
├── package.json
├── tsconfig.json
└── README.md
```

## Troubleshooting

### Server not appearing in Claude Desktop

1. Check your `claude_desktop_config.json` syntax (must be valid JSON)
2. Ensure the path to `dist/index.js` is correct and absolute
3. Make sure you ran `npm run build` successfully
4. Fully restart Claude Desktop (quit from system tray, not just close window)

### Connection failures

1. Verify your connection string format matches the examples above
2. Check that the database is running and accessible
3. Ensure credentials are correct
4. For remote databases, check firewall/network access

### "Cannot find module" errors

1. Run `npm install` to ensure all dependencies are installed
2. Run `npm run build` to compile TypeScript
3. Check that `node_modules` exists

### View server logs

MCP servers log to stderr. In Claude Desktop, check:
- **macOS**: `~/Library/Logs/Claude/mcp*.log`
- **Windows**: Check Claude's log files or run the server manually to see output

### Manual testing

Run the server directly to see if it starts:

```bash
node dist/index.js
```

You should see: `[INFO] ... DBProfessor MCP Server running on stdio`

Press Ctrl+C to stop.

## Development

### Run in development mode (with hot reload)

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

### Type check without building

```bash
npm run typecheck
```

## How It Works

1. **Connection**: When you use `connect`, DBProfessor establishes a connection and automatically introspects the schema
2. **Schema Cache**: The schema is cached in SQLite so subsequent calls are fast
3. **Learning**: Each `add_example` stores an English-SQL pair with metadata (query type, tables involved)
4. **Retrieval**: `english_to_sql` uses SQLite FTS5 (full-text search) to find similar examples
5. **Translation**: The found examples provide context for generating SQL

## License

MIT


## To run\todo now
 Open in your browser:
  http://localhost:6274/?MCP_PROXY_AUTH_TOKEN=ee57306ab2da64b11d4e4cd18f1c8f9e51c45b32cc5f80e5d5aa7d7a5a399394

  The Inspector lets you:
  - See all available tools (connect, describe_schema, etc.)
  - Call tools interactively with custom arguments
  - View the JSON responses
  - Debug issues

  To test DBProfessor:
  1. Click on "Tools" in the sidebar
  2. Select connect
  3. Enter a connection string (e.g., postgresql://user:pass@localhost:5432/mydb)
  4. Click "Call Tool"

  When you're done testing, you can kill the inspector:

  # Press Ctrl+C in the terminal, or I can kill it for you

  Other testing options:
  - Claude Desktop - configure it in claude_desktop_config.json and use it naturally in chat
  - Direct stdin - send JSON-RPC messages manually (tedious but works)
