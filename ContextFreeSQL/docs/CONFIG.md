# ContextFreeSQL Configuration Reference

This document describes all configuration options available in `config.json`.

## Quick Start

```json
{
  "database": {
    "host": "localhost",
    "db_name": "mydb",
    "user": "postgres",
    "password": "",
    "port": "5432"
  },
  "scripting_options": {
    "remove_all_extra_ents": false
  },
  "input_output": {
    "output_sql": "C:/temp/output.sql"
  }
}
```

---

## Section: `database`

Database connection settings.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `host` | string | Yes | Database server hostname or IP address |
| `db_name` | string | Yes | Name of the database to script |
| `user` | string | Yes | Database username |
| `password` | string | No | Database password. Can be omitted and provided via `--password` flag |
| `port` | string | Yes | Database port (typically "5432" for PostgreSQL) |

**Example:**
```json
"database": {
  "host": "localhost",
  "db_name": "production_db",
  "user": "postgres",
  "password": "",
  "port": "5432"
}
```

**Environment Variables:**

You can override any database connection setting using PostgreSQL standard environment variables:

| Variable | Overrides |
|----------|-----------|
| `PGHOST` | `database.host` |
| `PGPORT` | `database.port` |
| `PGUSER` | `database.user` |
| `PGPASSWORD` | `database.password` |
| `PGDATABASE` | `database.db_name` |

**Priority (highest to lowest):**
1. Command line arguments (`--password`)
2. Environment variables (`PGPASSWORD`, etc.)
3. config.json values
4. Interactive prompt (for password only)

**Examples:**
```bash
# Windows
set PGPASSWORD=secret && contextfreesql config.json

# Linux/Mac
export PGPASSWORD=secret && contextfreesql config.json

# Or inline (Linux/Mac)
PGPASSWORD=secret PGHOST=prod-server contextfreesql config.json
```

---

## Section: `scripting_options`

Controls what gets scripted and how.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `remove_all_extra_ents` | bool | `false` | When `true`, generates DROP statements for entities that exist in the target database but not in the source. **Use with caution!** |
| `script_schemas` | bool | `true` | Include schema (namespace) DDL in output |
| `all_schemas` | bool | `true` | Script all schemas. If `false`, only scripts schemas used by selected entities |
| `script_security` | bool | `true` | Include security objects: roles, permissions, RLS policies |
| `column_collation` | bool | `true` | Include column collation settings |
| `code_compare_no_white_space` | bool | `true` | Ignore whitespace when comparing coded entities (functions, procedures) |
| `code_compare_no_whitespace` | bool | `false` | Alternative whitespace comparison flag |
| `pre_add_constraints_data_checks` | bool | `false` | Add data validation checks before adding constraints |
| `data_scripting_leave_report_fields_updated` | bool | `false` | Track which fields were updated in data comparison |
| `data_scripting_leave_report_fields_updated_save_old_value` | bool | `false` | Save old values when tracking field updates |
| `data_scripting_generate_dml_statements` | bool | `false` | Generate INSERT/UPDATE/DELETE statements for data |
| `data_comparison_include_equal_rows` | bool | `true` | Include unchanged rows in CSV/HTML comparison reports |
| `data_window_only` | bool | `false` | Only compare data within a specific window |
| `data_window_got_specific_cells` | bool | `false` | Exclude specific cells from data window |

**Example:**
```json
"scripting_options": {
  "remove_all_extra_ents": true,
  "script_schemas": true,
  "script_security": true,
  "code_compare_no_white_space": true
}
```

---

## Section: `table_script_ops`

Per-table scripting options for schema elements.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `column_identity` | bool | `true` | Script IDENTITY column properties |
| `indexes` | bool | `true` | Script table indexes |
| `foreign_keys` | bool | `true` | Script foreign key constraints |
| `defaults` | bool | `true` | Script column default values |
| `check_constraints` | bool | `true` | Script CHECK constraints |
| `extended_props` | bool | `true` | Script extended properties (comments/descriptions) |

**Example:**
```json
"table_script_ops": {
  "column_identity": true,
  "indexes": true,
  "foreign_keys": true,
  "defaults": true,
  "check_constraints": true,
  "extended_props": true
}
```

---

## Section: `db_ents_to_load`

Filter which database entities to include in the script.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `tables` | array | `[]` | List of entities to script. Format: `"schema.name"` |

**Behavior:**
- **Empty array `[]`**: Scripts ALL entities (tables, views, functions, procedures, triggers)
- **Specified list**: Only scripts the listed entities

**Example - Script everything:**
```json
"db_ents_to_load": {
  "tables": []
}
```

**Example - Script specific tables:**
```json
"db_ents_to_load": {
  "tables": [
    "public.users",
    "public.orders",
    "inventory.products"
  ]
}
```

**Note:** Despite the name "tables", this filters ALL entity types including functions and procedures.

---

## Section: `tables_data`

Configure data scripting (INSERT statements).

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `tables` | array | `[]` | List of tables to script data for. Format: `"schema.name"` |
| `from_file` | bool | `false` | Load data from CSV files instead of database |

**Behavior:**
- **Empty array `[]`**: Scripts data for ALL tables (can be slow for large databases)
- **Specified list**: Only scripts data for listed tables

**Example - Script all table data:**
```json
"tables_data": {
  "tables": [],
  "from_file": false
}
```

**Example - Script specific table data:**
```json
"tables_data": {
  "tables": [
    "public.users",
    "public.settings"
  ],
  "from_file": false
}
```

---

## Section: `input_output`

File paths for templates and output.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `html_template_path` | string | (bundled) | Path to HTML report template. Uses bundled template if path doesn't exist |
| `html_output_path` | string | required | Where to write the HTML comparison report |
| `diff_template_path` | string | (bundled) | Path to code diff template. Uses bundled template if path doesn't exist |
| `diff_output_dir` | string | required | Directory for individual diff HTML files |
| `output_sql` | string | required | **Main output**: Path where the generated SQL script is written |

**Example:**
```json
"input_output": {
  "html_template_path": "C:/templates/db_compare_template.html",
  "html_output_path": "C:/output/database_report.html",
  "diff_template_path": "C:/templates/code_diff_template.html",
  "diff_output_dir": "C:/output/diffs",
  "output_sql": "C:/output/migration.sql"
}
```

**Note:** Template paths can point to non-existent files - bundled templates will be used as fallback.

---

## Section: `sql_script_params`

Runtime parameters embedded in the generated SQL script. These control script behavior when executed.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `print` | bool | `true` | Print descriptions (comments) as script runs |
| `print_exec` | bool | `true` | Print SQL statements before executing them |
| `exec_code` | bool | `true` | Actually execute DDL/DML statements. Set to `false` for dry-run |
| `html_report` | bool | `true` | Generate HTML comparison report |
| `export_csv` | bool | `false` | Export data comparison to CSV files |

**Example - Dry run (preview only):**
```json
"sql_script_params": {
  "print": true,
  "print_exec": true,
  "exec_code": false,
  "html_report": true,
  "export_csv": false
}
```

**Example - Silent execution:**
```json
"sql_script_params": {
  "print": false,
  "print_exec": false,
  "exec_code": true,
  "html_report": false,
  "export_csv": false
}
```

---

## Complete Example

```json
{
  "database": {
    "host": "localhost",
    "db_name": "production",
    "user": "postgres",
    "password": "",
    "port": "5432"
  },
  "scripting_options": {
    "remove_all_extra_ents": false,
    "column_collation": true,
    "code_compare_no_white_space": true,
    "pre_add_constraints_data_checks": false,
    "script_schemas": true,
    "all_schemas": true,
    "script_security": true,
    "data_scripting_leave_report_fields_updated": true,
    "data_scripting_leave_report_fields_updated_save_old_value": true,
    "data_scripting_generate_dml_statements": true,
    "data_comparison_include_equal_rows": false,
    "data_window_only": false,
    "data_window_got_specific_cells": false
  },
  "table_script_ops": {
    "column_identity": true,
    "indexes": true,
    "foreign_keys": true,
    "defaults": true,
    "check_constraints": true,
    "extended_props": true
  },
  "db_ents_to_load": {
    "tables": []
  },
  "tables_data": {
    "tables": [],
    "from_file": false
  },
  "input_output": {
    "html_template_path": "",
    "html_output_path": "C:/temp/ContextFreeSQL/database_report.html",
    "diff_template_path": "",
    "diff_output_dir": "C:/temp/ContextFreeSQL",
    "output_sql": "C:/temp/ContextFreeSQL/migration.sql"
  },
  "sql_script_params": {
    "print": true,
    "print_exec": true,
    "exec_code": false,
    "html_report": true,
    "export_csv": false
  }
}
```

---

## Command Line Usage

```bash
# Run with config file
contextfreesql config.json

# Run with password override
contextfreesql config.json --password=secret123

# Run with interactive password prompt
contextfreesql config.json --password

# Show this configuration documentation
contextfreesql --show-config

# Show version
contextfreesql --version
```
