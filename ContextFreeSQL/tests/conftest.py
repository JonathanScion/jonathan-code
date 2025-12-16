"""
Pytest configuration and shared fixtures for ContextFreeSQL integration tests.

Test Pattern:
1. Set up desired state - Create test objects (tables, columns, indexes, etc.)
2. Generate script - Run ContextFreeSQL to capture the state
3. Introduce drift - Modify the database (add/drop/alter objects)
4. Run generated script - Execute the script against the modified database
5. Verify restoration - Assert database matches original desired state
"""
import json
import os
import sys
import uuid
import tempfile
from pathlib import Path
from typing import Generator, List, Optional
from dataclasses import dataclass

import pytest
import psycopg2

# Add the project root to the path so we can import src modules
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from src.defs.script_defs import (
    DBType, DBConnSettings, ScriptingOptions, ScriptTableOptions,
    ListTables, InputOutput, SQLScriptParams, ConfigVals
)
from src.data_load.from_db.load_from_db_pg import load_all_schema, load_all_db_ents, load_all_tables_data
from src.generate.generate_script import generate_all_script

from tests.utils import db_helpers


@dataclass
class TestDBSettings:
    """Test database connection settings."""
    host: str
    db_name: str
    user: str
    password: str
    port: str


def load_test_config() -> TestDBSettings:
    """Load test database configuration from test_config.json or environment variables."""
    config_path = Path(__file__).parent / "test_config.json"

    if config_path.exists():
        with open(config_path) as f:
            data = json.load(f)
            db_config = data.get('database', {})
    else:
        db_config = {}

    # Environment variables override config file
    return TestDBSettings(
        host=os.getenv('TEST_DB_HOST', db_config.get('host', 'localhost')),
        db_name=os.getenv('TEST_DB_NAME', db_config.get('db_name', 'Jonathan1')),
        user=os.getenv('TEST_DB_USER', db_config.get('user', 'postgres')),
        password=os.getenv('TEST_DB_PASSWORD', db_config.get('password', 'yonision')),
        port=os.getenv('TEST_DB_PORT', db_config.get('port', '5432'))
    )


@pytest.fixture(scope='session')
def test_db_settings() -> TestDBSettings:
    """Session-scoped fixture providing test database settings."""
    return load_test_config()


@pytest.fixture(scope='session')
def db_connection(test_db_settings: TestDBSettings) -> Generator[psycopg2.extensions.connection, None, None]:
    """
    Session-scoped database connection.
    Used for setup/teardown operations that persist across tests.
    """
    conn = psycopg2.connect(
        host=test_db_settings.host,
        database=test_db_settings.db_name,
        user=test_db_settings.user,
        password=test_db_settings.password,
        port=test_db_settings.port
    )
    conn.autocommit = True
    yield conn
    conn.close()


@pytest.fixture
def test_connection(test_db_settings: TestDBSettings) -> Generator[psycopg2.extensions.connection, None, None]:
    """
    Function-scoped database connection with autocommit.
    Each test gets a fresh connection.
    """
    conn = psycopg2.connect(
        host=test_db_settings.host,
        database=test_db_settings.db_name,
        user=test_db_settings.user,
        password=test_db_settings.password,
        port=test_db_settings.port
    )
    conn.autocommit = True
    yield conn
    conn.close()


@pytest.fixture
def unique_prefix() -> str:
    """
    Generate a unique prefix for test objects.
    Ensures test isolation by using UUID-based names.
    Example: 'test_a1b2c3d4_'
    """
    short_uuid = uuid.uuid4().hex[:8]
    return f"test_{short_uuid}_"


@pytest.fixture
def test_schema(test_connection, unique_prefix: str) -> Generator[str, None, None]:
    """
    Create a unique test schema and clean it up after the test.
    Returns the schema name.
    """
    schema_name = f"{unique_prefix}schema"

    # Create schema
    db_helpers.execute_sql(test_connection, f'CREATE SCHEMA IF NOT EXISTS "{schema_name}"')

    yield schema_name

    # Cleanup - drop schema cascade
    try:
        db_helpers.execute_sql(test_connection, f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE')
    except Exception:
        pass


class ScriptGenerator:
    """
    Helper class to generate ContextFreeSQL scripts for testing.
    Wraps the main script generation logic with test-friendly defaults.
    """

    def __init__(self, db_settings: TestDBSettings, output_dir: str):
        self.db_settings = db_settings
        self.output_dir = output_dir
        self.db_conn = DBConnSettings(
            host=db_settings.host,
            db_name=db_settings.db_name,
            user=db_settings.user,
            password=db_settings.password,
            port=db_settings.port
        )

    def generate(
        self,
        tables: List[str],
        script_data: bool = False,
        script_security: bool = False,
        remove_extras: bool = True,
        script_schemas: bool = True,
        indexes: bool = True,
        foreign_keys: bool = True,
        defaults: bool = True,
        exec_code: bool = True
    ) -> str:
        """
        Generate a ContextFreeSQL script for the specified tables.

        Args:
            tables: List of table names in 'schema.table' format
            script_data: Whether to script table data (INSERT statements)
            script_security: Whether to script security (roles, permissions)
            remove_extras: Whether to drop entities not in source
            script_schemas: Whether to include schema DDL
            indexes: Whether to script indexes
            foreign_keys: Whether to script foreign keys
            defaults: Whether to script column defaults
            exec_code: Whether generated script should execute DDL

        Returns:
            The generated SQL script as a string
        """
        # Create scripting options
        script_ops = ScriptingOptions(
            remove_all_extra_ents=remove_extras,
            script_schemas=script_schemas,
            script_security=script_security,
            data_scripting_generate_dml_statements=script_data
        )

        # Create table script options
        table_script_ops = ScriptTableOptions(
            indexes=indexes,
            foreign_keys=foreign_keys,
            defaults=defaults
        )

        # Set up input/output paths
        src_dir = project_root / "src"
        input_output = InputOutput(
            html_template_path=str(src_dir / "templates" / "db_compare.html"),
            html_output_path=os.path.join(self.output_dir, "database_report.html"),
            diff_template_path=str(src_dir / "templates" / "code_diff_template.html"),
            diff_output_dir=self.output_dir,
            output_sql=os.path.join(self.output_dir, "output.sql")
        )

        # SQL script params - for testing we typically want exec_code=True
        sql_script_params = SQLScriptParams(
            print=False,
            print_exec=False,
            exec_code=exec_code,
            html_report=False,
            export_csv=False
        )

        # Load schema
        schema = load_all_schema(self.db_conn, load_security=script_security)

        # Load entities
        if tables:
            tbl_ents = load_all_db_ents(self.db_conn, entity_filter=tables)
        else:
            tbl_ents = load_all_db_ents(self.db_conn)

        # Mark tables for data scripting if requested
        tables_data = ListTables(tables=tables if script_data else [])
        if script_data and tables:
            table_filter = tbl_ents['entschema'] + '.' + tbl_ents['entname']
            tbl_ents.loc[table_filter.isin(tables), 'scriptdata'] = True
            load_all_tables_data(self.db_conn, db_all=schema, table_names=tables)

        # Generate script
        db_ents_to_load = ListTables(tables=tables)
        script = generate_all_script(
            schema,
            db_type=DBType.PostgreSQL,
            tbl_ents=tbl_ents,
            scrpt_ops=script_ops,
            input_output=input_output,
            got_specific_tables=(len(tables) >= 1),
            tables_data=tables_data,
            sql_script_params=sql_script_params
        )

        return script


@pytest.fixture
def script_generator(test_db_settings: TestDBSettings, tmp_path: Path) -> ScriptGenerator:
    """
    Factory fixture that creates a ScriptGenerator for generating test scripts.

    Usage:
        def test_something(script_generator, test_connection):
            script = script_generator.generate(['public.my_table'])
            db_helpers.execute_script(test_connection, script)
    """
    return ScriptGenerator(test_db_settings, str(tmp_path))


@pytest.fixture
def schema_assertions(test_connection):
    """Fixture providing SchemaAssertions bound to the test connection."""
    from tests.utils.assertions import SchemaAssertions
    return SchemaAssertions(test_connection)


@pytest.fixture
def security_assertions(test_connection):
    """Fixture providing SecurityAssertions bound to the test connection."""
    from tests.utils.assertions import SecurityAssertions
    return SecurityAssertions(test_connection)


@pytest.fixture
def data_assertions(test_connection):
    """Fixture providing DataAssertions bound to the test connection."""
    from tests.utils.assertions import DataAssertions
    return DataAssertions(test_connection)


@pytest.fixture(autouse=True)
def cleanup_test_prefix(test_connection, unique_prefix: str):
    """
    Auto-cleanup fixture that runs after each test.
    Cleans up any objects created with the test's unique prefix.
    """
    yield
    # Cleanup after test
    try:
        db_helpers.cleanup_test_objects(test_connection, unique_prefix)
    except Exception:
        pass  # Best effort cleanup


def execute_generated_script(conn, script: str) -> None:
    """
    Execute a generated ContextFreeSQL script.

    The generated scripts are wrapped in DO $$ BEGIN...END $$ blocks,
    which execute as a single atomic transaction.
    """
    with conn.cursor() as cur:
        cur.execute(script)


# Helper functions available to tests

def create_test_table(conn, schema: str, table_name: str, columns: str,
                      primary_key: str = None, unique_indexes: List[str] = None) -> None:
    """
    Create a test table with optional primary key and unique indexes.

    Args:
        conn: Database connection
        schema: Schema name
        table_name: Table name
        columns: Column definitions (e.g., "id INT, name VARCHAR(100)")
        primary_key: Primary key column(s) (e.g., "id")
        unique_indexes: List of unique index definitions
    """
    sql = f'CREATE TABLE "{schema}"."{table_name}" ({columns}'
    if primary_key:
        sql += f', PRIMARY KEY ({primary_key})'
    sql += ')'

    db_helpers.execute_sql(conn, sql)

    if unique_indexes:
        for idx, cols in enumerate(unique_indexes):
            idx_name = f"{table_name}_idx_{idx}"
            db_helpers.execute_sql(
                conn,
                f'CREATE UNIQUE INDEX "{idx_name}" ON "{schema}"."{table_name}" ({cols})'
            )


def create_test_function(conn, schema: str, function_name: str,
                         args: str, returns: str, body: str,
                         language: str = 'plpgsql') -> None:
    """Create a test function."""
    sql = f'''
        CREATE OR REPLACE FUNCTION "{schema}"."{function_name}"({args})
        RETURNS {returns}
        LANGUAGE {language}
        AS $function$
        {body}
        $function$
    '''
    db_helpers.execute_sql(conn, sql)


def create_test_view(conn, schema: str, view_name: str, query: str) -> None:
    """Create a test view."""
    sql = f'CREATE OR REPLACE VIEW "{schema}"."{view_name}" AS {query}'
    db_helpers.execute_sql(conn, sql)


def create_test_role(conn, role_name: str, **attributes) -> None:
    """
    Create a test role with specified attributes.

    Args:
        conn: Database connection
        role_name: Role name
        **attributes: Role attributes (login, createdb, superuser, etc.)
    """
    attr_parts = []
    for attr, value in attributes.items():
        if isinstance(value, bool):
            attr_parts.append(attr.upper() if value else f'NO{attr.upper()}')
        elif attr == 'password':
            attr_parts.append(f"PASSWORD '{value}'")

    attr_str = ' '.join(attr_parts)
    sql = f'CREATE ROLE "{role_name}" {attr_str}'
    db_helpers.execute_sql(conn, sql)


# Export commonly used items
__all__ = [
    'test_db_settings',
    'db_connection',
    'test_connection',
    'unique_prefix',
    'test_schema',
    'script_generator',
    'schema_assertions',
    'security_assertions',
    'data_assertions',
    'execute_generated_script',
    'create_test_table',
    'create_test_function',
    'create_test_view',
    'create_test_role',
    'ScriptGenerator',
    'TestDBSettings',
]
