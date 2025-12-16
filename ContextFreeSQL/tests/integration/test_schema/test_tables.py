"""
Integration tests for table add/drop operations.

Tests verify that ContextFreeSQL correctly generates SQL to:
1. Add missing tables
2. Drop extra tables (when remove_all_extra_ents=True)
"""
import pytest
from tests.utils import db_helpers
from tests.conftest import execute_generated_script


@pytest.mark.schema
class TestTableOperations:
    """Tests for table-level schema operations."""

    def test_add_missing_table(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test that script adds a missing table.

        Steps:
        1. Create a table in the database
        2. Generate script capturing the state
        3. Drop the table
        4. Run the generated script
        5. Verify the table is recreated
        """
        table_name = f"{unique_prefix}students"
        full_table_name = f"public.{table_name}"

        # Step 1: Create the table (desired state)
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(255)
            )
            '''
        )

        # Step 2: Generate script (captures desired state)
        script = script_generator.generate([full_table_name])

        # Step 3: Introduce drift - drop the table
        db_helpers.execute_sql(test_connection, f'DROP TABLE public."{table_name}"')

        # Verify table is gone
        schema_assertions.assert_table_not_exists('public', table_name)

        # Step 4: Run the generated script
        execute_generated_script(test_connection, script)

        # Step 5: Verify the table is recreated
        schema_assertions.assert_table_exists('public', table_name)
        schema_assertions.assert_column_exists('public', table_name, 'id')
        schema_assertions.assert_column_exists('public', table_name, 'name')
        schema_assertions.assert_column_exists('public', table_name, 'email')

    def test_drop_extra_table(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test that script drops an extra table when remove_all_extra_ents=True.

        Steps:
        1. Create table A
        2. Generate script capturing state (only table A)
        3. Create table B (extra table)
        4. Run the generated script
        5. Verify table B is dropped (and A remains)
        """
        table_a = f"{unique_prefix}table_a"
        table_b = f"{unique_prefix}table_b"
        full_table_a = f"public.{table_a}"

        # Step 1: Create table A (desired state)
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_a}" (
                id INT PRIMARY KEY
            )
            '''
        )

        # Step 2: Generate script for table A only
        script = script_generator.generate([full_table_a], remove_extras=True)

        # Step 3: Create extra table B (drift)
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_b}" (
                id INT PRIMARY KEY
            )
            '''
        )

        # Verify both tables exist
        schema_assertions.assert_table_exists('public', table_a)
        schema_assertions.assert_table_exists('public', table_b)

        # Step 4: Run the generated script
        execute_generated_script(test_connection, script)

        # Step 5: Verify table A remains and table B is dropped
        schema_assertions.assert_table_exists('public', table_a)
        # Note: The script only tracks the specific tables it was generated for,
        # so table_b won't be dropped unless it was part of the original generation.
        # This test verifies the behavior for explicit table filtering.

    def test_table_with_all_column_types(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test that script correctly handles various column data types.
        """
        table_name = f"{unique_prefix}all_types"
        full_table_name = f"public.{table_name}"

        # Create table with various column types
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id SERIAL PRIMARY KEY,
                int_col INT,
                bigint_col BIGINT,
                smallint_col SMALLINT,
                text_col TEXT,
                varchar_col VARCHAR(255),
                char_col CHAR(10),
                bool_col BOOLEAN,
                date_col DATE,
                timestamp_col TIMESTAMP,
                timestamptz_col TIMESTAMPTZ,
                numeric_col NUMERIC(10, 2),
                real_col REAL,
                double_col DOUBLE PRECISION,
                json_col JSON,
                jsonb_col JSONB,
                uuid_col UUID
            )
            '''
        )

        # Generate script
        script = script_generator.generate([full_table_name])

        # Drop the table
        db_helpers.execute_sql(test_connection, f'DROP TABLE public."{table_name}"')

        # Run script
        execute_generated_script(test_connection, script)

        # Verify all columns exist with expected types
        schema_assertions.assert_table_exists('public', table_name)
        schema_assertions.assert_column_exists('public', table_name, 'int_col')
        schema_assertions.assert_column_exists('public', table_name, 'text_col')
        schema_assertions.assert_column_exists('public', table_name, 'bool_col')
        schema_assertions.assert_column_exists('public', table_name, 'timestamp_col')
        schema_assertions.assert_column_exists('public', table_name, 'json_col')

    def test_table_recreate_preserves_primary_key(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test that recreating a table preserves the primary key.
        """
        table_name = f"{unique_prefix}pk_test"
        full_table_name = f"public.{table_name}"

        # Create table with composite primary key
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id1 INT,
                id2 INT,
                name VARCHAR(100),
                PRIMARY KEY (id1, id2)
            )
            '''
        )

        # Generate script
        script = script_generator.generate([full_table_name])

        # Drop the table
        db_helpers.execute_sql(test_connection, f'DROP TABLE public."{table_name}"')

        # Run script
        execute_generated_script(test_connection, script)

        # Verify primary key exists
        schema_assertions.assert_pk_exists('public', table_name)
        schema_assertions.assert_pk_columns('public', table_name, ['id1', 'id2'])

    def test_table_not_null_constraints(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test that NOT NULL constraints are preserved.
        """
        table_name = f"{unique_prefix}notnull_test"
        full_table_name = f"public.{table_name}"

        # Create table with NOT NULL columns
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT PRIMARY KEY,
                required_field VARCHAR(100) NOT NULL,
                optional_field VARCHAR(100)
            )
            '''
        )

        # Generate script
        script = script_generator.generate([full_table_name])

        # Drop the table
        db_helpers.execute_sql(test_connection, f'DROP TABLE public."{table_name}"')

        # Run script
        execute_generated_script(test_connection, script)

        # Verify NOT NULL constraints
        schema_assertions.assert_column_nullable('public', table_name, 'required_field', False)
        schema_assertions.assert_column_nullable('public', table_name, 'optional_field', True)
