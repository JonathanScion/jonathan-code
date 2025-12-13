# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ContextFreeSQL is a Python database scripting tool that extracts complete schema and data from PostgreSQL/MSSQL databases and generates standalone SQL scripts that can recreate the entire database from scratch. The generated scripts are "context-free" - they contain all necessary DDL (schema) and DML (data) statements with proper dependency ordering.

**Current Focus:** The project currently targets PostgreSQL (primary) with MSSQL support. Recent development has focused on HTML report generation for database comparisons and **security scripting** (roles, permissions, RLS policies).

## Development Commands

### Environment Setup
```bash
# Create virtual environment
py -m venv venv

# Activate virtual environment
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Deactivate when done
deactivate
```

### Running the Application
```bash
# Run with default config (src/config.json)
python -m src.main

# Run with custom config
python -m src.main path/to/config.json
```

**Output Location:** Generated SQL scripts are written to the path specified in `config.json` under `input_output.output_sql`

### Testing
The test suite is minimal and not actively maintained. Test files exist in `tests/` directory but are primarily used for output validation rather than automated testing.

```bash
# Run tests (if needed)
pytest tests/
```

## Architecture Overview

### Execution Pipeline
The application follows a linear pipeline architecture:

```
Config Loading → Schema Loading → Entity Filtering → Data Loading → Script Generation → File Output
```

### Key Architectural Patterns

1. **Configuration-Driven:** All behavior controlled via `config.json` or environment variables
2. **Pandas-Based Data Model:** All database metadata stored in pandas DataFrames for easy manipulation
3. **Multi-Database Abstraction:** `DBType` enum and `DBSyntax` dataclass provide syntax abstraction for different databases
4. **StringIO Buffering:** Script generation uses StringIO buffers to build SQL incrementally
5. **State Table Pattern:** Creates temporary state tables to track ADD/ALTER/DROP operations

### Main Execution Flow (src/main.py)

1. **Load Config:** Reads `config.json` (with optional environment variable overrides)
2. **Load Complete Schema:** Calls `load_all_schema()` to load all schemas, tables, columns, indexes, FKs, defaults
3. **Filter Entities:** If `db_ents_to_load.tables` is specified, loads only those entities; otherwise loads all
4. **Mark Data Tables:** Sets `scriptdata=True` flag for tables listed in `tables_data.tables`
5. **Load Table Data:** Calls `load_all_tables_data()` to fetch actual row data for marked tables
6. **Generate Script:** Orchestrates all generation modules via `generate_all_script()`
7. **Write Output:** Writes complete SQL script to `tests/sample_out.sql`

### Code Organization

#### Core Modules

**Data Loading (`src/data_load/from_db/`)**
- `load_from_db_pg.py`: PostgreSQL schema extraction using `information_schema` queries
  - Returns `DBSchema` dataclass containing multiple DataFrames (schemas, tables, columns, indexes, FKs, defaults, coded_ents)
- `load_from_db_mssql.py`: MSSQL equivalent using T-SQL system queries

**Data Definitions (`src/defs/script_defs.py`)**
- `DBType` enum: MSSQL, MySQL, PostgreSQL
- `DBSyntax`: Database-specific syntax (operators, variable prefixes, type names)
  - Example: PostgreSQL uses `:=` for assignment, MSSQL uses `=`
  - Example: PostgreSQL variables have no prefix, MSSQL uses `@` prefix
- `ConfigVals`: Complete configuration container
- `ScriptingOptions`: Global scripting flags (transaction mode, schema scripting, data options)
- `ScriptTableOptions`: Per-table options (identity, indexes, FKs, defaults, check constraints)

**Script Generation (`src/generate/`)**
- `generate_script.py`: Main orchestrator - coordinates all generation phases
  - Wraps output in `DO $$ BEGIN...END $$` block for PostgreSQL
  - Creates temp state tables for tracking entity changes
  - Manages StringIO buffers for each component (indexes, FKs, columns, tables, data)

Generation modules (called in order):
1. **Schemas:** `create_db_state_schemas()` - ADD/DROP schemas
2. **State Tables:** `create_db_state_temp_tables_for_tables()` - Track table states
3. **Coded Entities State:** `create_db_state_temp_tables_for_coded()` - Track functions/procedures
4. **Security State Tables:** `generate_security_state_tables()` - Track roles/permissions state
5. **Security Inserts:** `generate_security_inserts()` - Populate security desired state
6. **Security State Updates:** `generate_security_state_updates()` - Mark ADD/ALTER/DROP
7. **Security Phase 1:** `generate_create_roles()` - CREATE/ALTER roles (before tables)
8. **Indexes/FKs:** `generate_pre_drop_post_add_indexes_fks()` - Drop before changes, add after
9. **Tables:** `generate_drop_tables()` + `generate_add_tables()` - Handle table lifecycle
10. **Columns:** `generate_add_alter_drop_cols()` - Column definitions and ALTERs
11. **Security Phase 2:** `generate_grant_table_permissions()` - Table/column perms + RLS (after tables)
12. **Data:** `script_data()` - Generate INSERT statements with proper quoting
13. **Coded Entities:** `generate_coded_ents()` - Functions, procedures, triggers
14. **Security Phase 3:** `generate_grant_function_permissions()` - Function perms (after coded entities)
15. **Security Phase 4:** `generate_revoke_and_drop_extra_security()` - Cleanup extras (at end)
16. **HTML Report:** `generate_html_report()` - Comparison visualization

**Utilities (`src/utils/`)**
- `load_config.py`: Configuration loading with environment variable override support
  - Environment variables use format: `SECTION__KEY` (e.g., `DATABASE__HOST` overrides `database.host`)
- `funcs.py`: SQL formatting utilities and code generation helpers:
  - `quote_str_or_null()`: Escape string values for SQL
  - `bool_to_sql_bit_boolean_val()`: Convert booleans to SQL format
  - `add_print()`: Add print statement to output (for descriptions)
  - `add_exec_sql()`: Add SQL execution with optional print (for DDL statements)
- `code_funcs.py`: Code generation helpers

**Security Generation (`src/generate/generate_final_security.py`)**
- Phased security operations respecting dependencies
- State tables: ScriptRoles, ScriptRoleMemberships, ScriptTablePermissions, ScriptColumnPermissions, ScriptFunctionPermissions, ScriptRLSPolicies
- Each state table tracks `stat` column: 0=equal, 1=add, 2=drop, 3=alter

## Configuration System

### Primary Config: src/config.json

```json
{
  "database": {
    "host": "localhost",
    "db_name": "Jonathan1",
    "user": "postgres",
    "password": "yonision",
    "port": "5432"
  },
  "scripting_options": {
    "remove_all_extra_ents": false,           // Drop entities not in source
    "as_transaction": false,                   // Wrap in transaction
    "script_schemas": true,                    // Include schema DDL
    "script_security": true,                   // Include security (roles, permissions, RLS)
    "all_schemas": true,                       // Script all schemas or only used ones
    "data_scripting_leave_report_fields_updated_save_old_value": true,  // Track old values
    "data_scripting_generate_dml_statements": true  // Generate INSERT statements
  },
  "table_script_ops": {
    "column_identity": true,
    "indexes": true,
    "foreign_keys": true,
    "defaults": true,
    "check_constraints": true
  },
  "db_ents_to_load": {
    "tables": ["public.students"]  // Empty array = load all tables
  },
  "tables_data": {
    "tables": ["public.students"]  // Which tables to script data for
  },
  "input_output": {
    "html_template_path": "C:/path/to/template.html",     // HTML template for reports
    "html_output_path": "C:/temp/database_report.html",   // HTML report output location
    "output_sql": "C:/path/to/output.sql"                 // Generated SQL script output path
  },
  "sql_script_params": {
    "print": true,           // Print descriptions (e.g., "--Creating role: x")
    "print_exec": true,      // Print DDL statements before execution
    "exec_code": false,      // Actually execute DDL (false = dry run)
    "html_report": true,     // Generate HTML comparison report
    "export_csv": false      // Export data to CSV files
  }
}
```

### Environment Variable Overrides

The configuration system supports environment variable overrides using double-underscore notation:
- `DATABASE__HOST` overrides `database.host`
- `DATABASE__PASSWORD` overrides `database.password`
- `SCRIPTING_OPTIONS__AS_TRANSACTION` overrides `scripting_options.as_transaction`

This is handled by `src/utils/load_config.py` but is optional - all configuration can be managed through config.json alone.

### Critical Configuration Behavior

- **Empty `db_ents_to_load.tables`**: Loads ALL entities from database
- **Empty `tables_data.tables`**: Scripts data for ALL tables (can be slow)
- **Filtering:** When specifying tables, use format `schema.tablename` (e.g., `"public.students"`)

## Database Connection

**Infrastructure:** `src/infra/database.py`
- Uses `psycopg2-binary` for PostgreSQL connections
- Connection created via `Database.connect_to_database(DBConnSettings)`
- Credentials from config.json (or environment variable overrides)

**Schema Queries:** Reads from `information_schema` views:
- `information_schema.schemata` - Schemas
- `information_schema.tables` - Tables
- `information_schema.columns` - Column definitions
- `pg_indexes` - Index definitions
- `pg_constraint` - Foreign keys and check constraints

**Security Queries:** Reads from PostgreSQL system catalogs:
- `pg_roles` / `pg_authid` - Role definitions and attributes
- `pg_auth_members` - Role memberships (GRANT role TO role)
- `information_schema.table_privileges` - Table-level permissions
- `information_schema.column_privileges` - Column-level permissions (filtered to exclude those covered by table-level)
- `information_schema.routine_privileges` - Function/procedure permissions
- `pg_policies` - Row-Level Security (RLS) policy definitions

**System Schema Filtering:** Automatically excludes PostgreSQL system schemas:
- `pg_catalog`, `information_schema`, `pg_temp%`, `pg_toast%`

**System Role Filtering:** Excludes system roles:
- `pg_%` prefixed roles, `postgres` superuser, `PUBLIC`

## Important Implementation Details

### Data Type Handling
- PostgreSQL types mapped in `DBSyntax`: `character varying`, `boolean`, `integer`, etc.
- MSSQL types mapped separately: `nvarchar`, `BIT`, `int`, etc.
- Data type conversion handled in `generate_final_columns.py`

### Dependency Ordering
The script generation order is critical:
1. Create/Alter roles (must exist before granting permissions)
2. Drop indexes/FKs first (prevent constraint violations)
3. Drop/Add/Alter tables
4. Add/Alter columns
5. Grant table/column permissions + RLS (tables must exist)
6. Insert data
7. Re-add indexes/FKs
8. Add coded entities (functions/procedures depend on tables)
9. Grant function permissions (functions must exist)
10. Revoke extra permissions and drop extra roles (cleanup at end)

### Quote Handling
- String values: Single-quote escaped via `quote_str_or_null()` in `src/utils/funcs.py`
- NULL handling: Explicit `NULL` keyword, not `'NULL'` string
- Boolean values: `true`/`false` for PostgreSQL, `1`/`0` for MSSQL

### Transaction Control
- When `as_transaction: true`, wraps script in BEGIN/COMMIT block
- PostgreSQL scripts always wrapped in `DO $$ BEGIN...END $$` procedural block
- Individual operations not transactional unless explicitly enabled

### Code Generation Conventions

**Print Statements (`add_print`):**
- Used for descriptions/comments in output
- Quoting convention: Use `'Text '` for strings starting with text, `''` prefix for expressions like CASE WHEN
- Example: `add_print(db_type, 2, sql_buffer, "'Creating role: ' || temprow.rolname")`
- Example: `add_print(db_type, 2, sql_buffer, "'' || CASE WHEN x THEN 'A' ELSE 'B' END")`

**SQL Execution (`add_exec_sql`):**
- Used for DDL statements that should be printed (printExec) and optionally executed (execCode)
- Pattern: Build SQL into `v_sql` variable, then call `add_exec_sql(db_type, indent, sql_buffer, "v_sql")`
- Always print DDL statements before executing them

**Drop-If-Exists Pattern for Temp Tables:**
```sql
perform n.nspname, c.relname
FROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname like 'pg_temp_%' AND c.relname='tablename' AND pg_catalog.pg_table_is_visible(c.oid);
IF FOUND THEN
    DROP TABLE TableName;
END IF;
```
This pattern ensures scripts can be run repeatedly without errors.

**State Table Pattern:**
- Create temp tables to hold "desired state" from script
- INSERT rows for each entity in desired state
- UPDATE to mark status: 1=add (missing in DB), 2=drop (extra in DB), 3=alter (different)
- Loop through marked rows and execute appropriate DDL

## Common Development Scenarios

### Adding Support for a New Database Type
1. Add enum value to `DBType` in `src/defs/script_defs.py`
2. Add case in `DBSyntax.get_syntax()` with database-specific syntax
3. Create new loader in `src/data_load/from_db/load_from_db_<dbtype>.py`
4. Update generation modules to handle new syntax differences

### Modifying Script Generation
- **Add new component:** Create new function in `src/generate/`, add StringIO buffer in `generate_script.py`, call in proper order
- **Change output format:** Modify specific generation module (e.g., `generate_final_data.py` for INSERT statements)
- **Add configuration option:** Update `ScriptingOptions` or `ScriptTableOptions` dataclass, add to config.json schema

### Debugging Script Output
1. Generated SQL written to `tests/sample_out.sql` (hardcoded path)
2. Compare with `tests/old_sample_out.sql` to see differences
3. Each generation phase writes comments like `--Iterate tables, generate all code----------------`
4. Enable `as_transaction: false` to prevent rollback on errors during testing

## Data Model

### DBSchema Dataclass (returned by load_all_schema)
Contains pandas DataFrames:
- `schemas`: DataFrame of schema definitions
- `tables`: Table metadata (name, schema, type)
- `columns`: Column definitions (name, type, nullable, max_length, default)
- `indexes`: Index definitions with columns
- `foreign_keys`: FK relationships with columns
- `defaults`: Column default constraints
- `coded_ents`: Stored procedures, functions, triggers (code as string)
- `roles`: Role definitions (rolname, rolsuper, rolinherit, rolcreatedb, rolcanlogin, etc.)
- `role_memberships`: Role-to-role grants (role_name, member_name, admin_option)
- `table_permissions`: Table-level GRANT permissions
- `column_permissions`: Column-level GRANT permissions (excludes those covered by table-level)
- `function_permissions`: Function/procedure EXECUTE permissions
- `rls_policies`: Row-Level Security policy definitions

### Table Entity DataFrame (tbl_ents)
Tracks entities to script with columns:
- `entschema`: Schema name
- `entname`: Entity name
- `enttype`: 'Table', 'View', 'Function', etc.
- `scriptdata`: Boolean flag - whether to generate INSERT statements
- Additional state tracking columns added during generation

## Known Issues and Limitations

1. **Limited Test Coverage:** Test suite is minimal and not actively maintained
2. **Single Database Connection:** No support for multi-database comparisons
3. **No Incremental Scripting:** Always generates complete schema, no delta mode
4. **Large Dataset Performance:** Loading all table data can be slow for large databases
5. **MySQL Support:** Defined but not fully implemented

## Security Scripting

### Supported Security Features (PostgreSQL)
- **Roles:** CREATE, ALTER, DROP roles with all attributes (LOGIN, SUPERUSER, CREATEDB, etc.)
- **Role Memberships:** GRANT role TO role (with ADMIN OPTION)
- **Table Permissions:** GRANT SELECT, INSERT, UPDATE, DELETE, etc. on tables
- **Column Permissions:** GRANT on specific columns (only when not covered by table-level)
- **Function Permissions:** GRANT EXECUTE on functions/procedures
- **RLS Policies:** CREATE/ALTER/DROP Row-Level Security policies

### Security Operation Phases
Security operations are split into phases based on dependencies:
1. **Phase 1 (Early):** CREATE/ALTER roles - must exist before granting permissions
2. **Phase 2 (After Tables):** Table/column permissions + RLS policies
3. **Phase 3 (After Coded Entities):** Function/procedure permissions
4. **Phase 4 (End):** REVOKE extra permissions, DROP extra roles

### Column Permissions Filtering
Column-level permissions that are already covered by table-level permissions are automatically excluded. For example, if a role has `SELECT` on a table, the individual column `SELECT` grants are not scripted (they're redundant).

### Testing Security Scripts
1. Generate script (captures current state as "desired")
2. Make changes to database (add/remove roles, grant/revoke)
3. Run script - should detect and fix differences
4. With `exec_code: false`, script shows what WOULD be done without executing

## Recent Development Areas (from git history)

- **Security scripting:** Roles, permissions, RLS policies (phased operations)
- HTML report generation for database comparisons
- Filtering specific tables and entities (db_ents_to_load)
- Data scripting with historical value preservation (save_old_value option)
- Coded entities handling (functions/procedures/triggers)
- Column permissions filtering (exclude redundant grants)
