# ContextFreeSQL Integration Test Suite

This directory contains the integration test suite for ContextFreeSQL. The tests verify that generated SQL scripts correctly synchronize database schemas, data, and security configurations.

## Test Pattern

Each integration test follows this workflow:

1. **Set up desired state** - Create test objects (tables, columns, indexes, roles, etc.)
2. **Generate script** - Run ContextFreeSQL to capture the state
3. **Introduce drift** - Modify the database (add/drop/alter objects)
4. **Run generated script** - Execute the script against the modified database
5. **Verify restoration** - Assert database matches original desired state

## Directory Structure

```
tests/
├── README.md                      # This file
├── conftest.py                    # Shared fixtures, DB connection, script generator
├── pytest.ini                     # Pytest configuration and markers
├── test_config.json               # Test database settings
├── test_main.py                   # Basic framework verification tests
├── utils/
│   ├── __init__.py
│   ├── db_helpers.py              # SQL execution utilities
│   └── assertions.py              # Custom verification helpers
└── integration/
    ├── test_schema/
    │   ├── test_tables.py         # Table add/drop tests
    │   ├── test_columns.py        # Column add/alter/drop tests
    │   ├── test_indexes.py        # Index tests (unique, PK, composite)
    │   └── test_foreign_keys.py   # FK dependency tests
    ├── test_data/
    │   └── test_insert_scripting.py  # INSERT generation, NULL handling, special chars
    ├── test_coded_entities/
    │   └── test_functions.py      # Functions, procedures, views
    ├── test_security/
    │   ├── test_roles.py          # Role create/alter/drop
    │   └── test_table_permissions.py  # Table permissions
    └── test_complex/
        └── test_dependencies.py   # FK+index ordering, idempotency
```

## Running Tests

### Prerequisites

```bash
# Activate virtual environment
venv\Scripts\activate

# Install pytest (if not already installed)
pip install pytest
```

### Run Commands

```bash
# Run all tests
pytest tests/ -v

# Run all tests with short traceback
pytest tests/ -v --tb=short

# Run by category (using markers)
pytest tests/ -m schema -v      # Schema tests only
pytest tests/ -m data -v        # Data tests only
pytest tests/ -m security -v    # Security tests only
pytest tests/ -m complex -v     # Complex scenario tests
pytest tests/ -m coded_entities -v  # Function/view/procedure tests

# Run specific test file
pytest tests/integration/test_schema/test_tables.py -v

# Run specific test class
pytest tests/integration/test_schema/test_tables.py::TestTableOperations -v

# Run specific test
pytest tests/integration/test_schema/test_tables.py::TestTableOperations::test_add_missing_table -v

# Skip slow tests
pytest tests/ -m "not slow" -v

# Run with coverage (requires pytest-cov)
pytest tests/ --cov=src --cov-report=html
```

## Configuration

### test_config.json

```json
{
  "database": {
    "host": "localhost",
    "db_name": "Jonathan1",
    "user": "postgres",
    "password": "yonision",
    "port": "5432"
  },
  "test_settings": {
    "cleanup_on_success": true,
    "verbose_sql": false
  }
}
```

### Environment Variable Overrides

Environment variables take precedence over `test_config.json`:

- `TEST_DB_HOST` - Database host
- `TEST_DB_NAME` - Database name
- `TEST_DB_USER` - Database user
- `TEST_DB_PASSWORD` - Database password
- `TEST_DB_PORT` - Database port

## Test Markers

Tests are organized with pytest markers defined in `pytest.ini`:

| Marker | Description |
|--------|-------------|
| `schema` | Tests for schema operations (tables, columns, indexes, FKs) |
| `data` | Tests for data scripting operations |
| `coded_entities` | Tests for functions, procedures, views |
| `security` | Tests for roles, permissions, RLS policies |
| `complex` | Tests for complex scenarios (dependencies, idempotency) |
| `slow` | Tests that take a long time to run |

## Key Fixtures

### Database Fixtures

| Fixture | Scope | Description |
|---------|-------|-------------|
| `test_db_settings` | session | Database connection settings |
| `db_connection` | session | Persistent DB connection for setup/teardown |
| `test_connection` | function | Fresh connection per test with autocommit |

### Test Isolation Fixtures

| Fixture | Scope | Description |
|---------|-------|-------------|
| `unique_prefix` | function | UUID-based prefix for test objects (e.g., `test_a1b2c3d4_`) |
| `test_schema` | function | Creates unique schema, cleans up after test |
| `cleanup_test_prefix` | function | Auto-cleanup of test objects (autouse) |

### Generator Fixtures

| Fixture | Description |
|---------|-------------|
| `script_generator` | Factory to generate ContextFreeSQL scripts |

### Assertion Fixtures

| Fixture | Description |
|---------|-------------|
| `schema_assertions` | Schema verification (tables, columns, indexes, FKs) |
| `security_assertions` | Security verification (roles, permissions) |
| `data_assertions` | Data verification (row counts, values) |

## Writing New Tests

### Basic Test Structure

```python
import pytest
from tests.utils import db_helpers
from tests.conftest import execute_generated_script

@pytest.mark.schema  # Add appropriate marker
class TestMyFeature:
    def test_something(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test description.
        """
        table_name = f"{unique_prefix}my_table"
        full_table_name = f"public.{table_name}"

        # Step 1: Create desired state
        db_helpers.execute_sql(
            test_connection,
            f'''CREATE TABLE public."{table_name}" (id INT PRIMARY KEY)'''
        )

        # Step 2: Generate script
        script = script_generator.generate([full_table_name])

        # Step 3: Introduce drift
        db_helpers.execute_sql(test_connection, f'DROP TABLE public."{table_name}"')

        # Step 4: Run script
        execute_generated_script(test_connection, script)

        # Step 5: Verify restoration
        schema_assertions.assert_table_exists('public', table_name)
```

### Script Generator Options

```python
script = script_generator.generate(
    tables=['public.my_table'],      # Tables to include
    script_data=False,               # Include INSERT statements
    script_security=False,           # Include roles/permissions
    remove_extras=True,              # Drop entities not in source
    script_schemas=True,             # Include schema DDL
    indexes=True,                    # Script indexes
    foreign_keys=True,               # Script foreign keys
    defaults=True,                   # Script column defaults
    exec_code=True                   # Execute DDL in generated script
)
```

### Available Assertions

#### Schema Assertions
```python
schema_assertions.assert_table_exists('public', 'table_name')
schema_assertions.assert_table_not_exists('public', 'table_name')
schema_assertions.assert_column_exists('public', 'table_name', 'column_name')
schema_assertions.assert_column_type('public', 'table_name', 'column_name', 'varchar')
schema_assertions.assert_column_nullable('public', 'table_name', 'column_name', True)
schema_assertions.assert_index_exists('public', 'table_name', 'index_name')
schema_assertions.assert_pk_exists('public', 'table_name')
schema_assertions.assert_pk_columns('public', 'table_name', ['id1', 'id2'])
schema_assertions.assert_fk_exists('public', 'fk_name')
schema_assertions.assert_function_exists('public', 'func_name', 'integer, text')
schema_assertions.assert_view_exists('public', 'view_name')
```

#### Security Assertions
```python
security_assertions.assert_role_exists('role_name')
security_assertions.assert_role_attributes('role_name', {'rolcanlogin': True})
security_assertions.assert_table_privilege('role', 'public', 'table', 'SELECT', has_privilege=True)
security_assertions.assert_rls_policy_exists('public', 'table_name', 'policy_name')
```

#### Data Assertions
```python
data_assertions.assert_row_count('public', 'table_name', 5)
data_assertions.assert_row_exists('public', 'table_name', {'id': 1, 'name': 'Alice'})
data_assertions.assert_data_matches('public', 'table_name', expected_rows, order_by='id')
```

### Database Helpers

```python
from tests.utils import db_helpers

# Execute SQL
db_helpers.execute_sql(conn, "SELECT * FROM table WHERE id = %s", (1,))
db_helpers.execute_script(conn, "DO $$ BEGIN ... END $$")

# Check existence
db_helpers.table_exists(conn, 'public', 'table_name')
db_helpers.column_exists(conn, 'public', 'table_name', 'column_name')
db_helpers.index_exists(conn, 'public', 'table_name', 'index_name')
db_helpers.fk_exists(conn, 'public', 'fk_name')
db_helpers.role_exists(conn, 'role_name')
db_helpers.function_exists(conn, 'public', 'func_name', 'integer')

# Get info
db_helpers.get_column_info(conn, 'public', 'table_name', 'column_name')
db_helpers.get_role_attributes(conn, 'role_name')
db_helpers.get_table_data(conn, 'public', 'table_name', order_by='id')
db_helpers.get_row_count(conn, 'public', 'table_name')

# Cleanup
db_helpers.cleanup_test_objects(conn, 'test_prefix_')
db_helpers.drop_table_if_exists(conn, 'public', 'table_name')
```

## Test Coverage by Feature

### Phase 1: Schema Operations
| Test | Description | Status |
|------|-------------|--------|
| `test_add_missing_table` | Script adds missing table | Pass |
| `test_drop_extra_table` | Script drops table not in source | Pass |
| `test_add_missing_column` | Script adds missing column | Pass |
| `test_drop_extra_column` | Script drops extra column | Pass |
| `test_alter_column_type_varchar_length` | Script restores column type | Bug Found |
| `test_alter_column_nullable_to_not_null` | Script restores NOT NULL | Pass |
| `test_add_missing_index` | Script creates missing index | Pass |
| `test_drop_extra_index` | Script drops extra index | Pass |
| `test_add_missing_foreign_key` | Script creates missing FK | Pass |
| `test_drop_extra_fk` | Script drops extra FK | Pass |

### Phase 2: Data Operations
| Test | Description | Status |
|------|-------------|--------|
| `test_restore_deleted_rows` | Script restores deleted rows | Pass |
| `test_null_values` | NULL preserved correctly | Bug Found |
| `test_special_characters_quotes` | Quotes escaped correctly | Bug Found |
| `test_schema_and_data_together` | Schema + data work together | Pass |

### Phase 3: Coded Entities
| Test | Description | Status |
|------|-------------|--------|
| `test_create_missing_function` | Script creates function | Pass |
| `test_update_function_body` | Script updates function body | Pass |
| `test_create_view` | Script creates view | Bug Found |
| `test_create_procedure` | Script creates procedure | Bug Found |

### Phase 4: Security
| Test | Description | Status |
|------|-------------|--------|
| `test_create_missing_role` | Script creates role | Pass |
| `test_alter_role_attributes` | Script restores role settings | Pass |
| `test_grant_table_permission` | Script grants permission | Pass |
| `test_revoke_extra_permission` | Script revokes extra permission | Bug Found |

### Phase 5: Complex Scenarios
| Test | Description | Status |
|------|-------------|--------|
| `test_column_change_with_index` | Drops index, alters, recreates | Bug Found |
| `test_column_change_with_fk` | Handles FK dependencies | Bug Found |
| `test_script_runs_twice_no_error` | Idempotency test | Pass |
| `test_complete_table_workflow` | End-to-end scenario | Pass |

## Known Issues Found by Tests

The test suite has identified these bugs in the code generator:

1. **SET NULL syntax** - Generator outputs `SET NULL` instead of `DROP NOT NULL` for nullable columns
2. **Numeric precision** - `numeric(10.0,2.0)` should be `numeric(10,2)` (precision/scale as integers)
3. **Composite FK array issue** - Pandas array truth value error with composite foreign keys
4. **Coded entity recreation** - Functions/views/procedures not being recreated properly in some cases
5. **Data scripting KeyError** - Missing 'name' key for certain table structures
6. **Permission revoke** - Extra permissions not being revoked when `remove_extras=True`

## Troubleshooting

### Common Issues

**"No module named pytest"**
```bash
pip install pytest
```

**Database connection errors**
- Check `test_config.json` settings
- Verify PostgreSQL is running
- Check firewall/connection settings

**Tests leave objects behind**
- Each test uses a unique prefix (`test_<uuid>_`)
- Auto-cleanup runs after each test
- Manual cleanup: `db_helpers.cleanup_test_objects(conn, 'test_')`

**Tests are slow**
- Run specific test categories: `pytest -m schema`
- Skip slow tests: `pytest -m "not slow"`
- Use `--tb=line` for shorter output

### Debugging Tips

```bash
# Show full traceback
pytest tests/ -v --tb=long

# Stop on first failure
pytest tests/ -x

# Show print statements
pytest tests/ -s

# Run with debugging
pytest tests/ --pdb
```
