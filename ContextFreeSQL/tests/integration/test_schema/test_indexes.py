"""
Integration tests for index operations.

Tests verify that ContextFreeSQL correctly generates SQL to:
1. Add missing indexes
2. Drop extra indexes
3. Handle unique indexes
4. Handle composite indexes
"""
import pytest
from tests.utils import db_helpers
from tests.conftest import execute_generated_script


@pytest.mark.schema
class TestIndexOperations:
    """Tests for index-level schema operations."""

    def test_add_missing_index(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test that script adds a missing index.

        Steps:
        1. Create table with an index
        2. Generate script
        3. Drop the index
        4. Run script
        5. Verify index is restored
        """
        table_name = f"{unique_prefix}idx_add"
        index_name = f"{unique_prefix}idx_name"
        full_table_name = f"public.{table_name}"

        # Step 1: Create table with index
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT PRIMARY KEY,
                name VARCHAR(100),
                email VARCHAR(255)
            )
            '''
        )
        db_helpers.execute_sql(
            test_connection,
            f'CREATE INDEX "{index_name}" ON public."{table_name}" (name)'
        )

        # Step 2: Generate script
        script = script_generator.generate([full_table_name])

        # Step 3: Drop the index
        db_helpers.execute_sql(test_connection, f'DROP INDEX public."{index_name}"')

        # Verify index is gone
        schema_assertions.assert_index_not_exists('public', table_name, index_name)

        # Step 4: Run script
        execute_generated_script(test_connection, script)

        # Step 5: Verify index is restored
        schema_assertions.assert_index_exists('public', table_name, index_name)

    def test_drop_extra_index(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test that script drops an extra index.

        Steps:
        1. Create table without extra index
        2. Generate script
        3. Add extra index
        4. Run script
        5. Verify extra index is dropped
        """
        table_name = f"{unique_prefix}idx_drop"
        extra_index_name = f"{unique_prefix}idx_extra"
        full_table_name = f"public.{table_name}"

        # Step 1: Create table (no extra index)
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT PRIMARY KEY,
                name VARCHAR(100)
            )
            '''
        )

        # Step 2: Generate script
        script = script_generator.generate([full_table_name], remove_extras=True)

        # Step 3: Add extra index
        db_helpers.execute_sql(
            test_connection,
            f'CREATE INDEX "{extra_index_name}" ON public."{table_name}" (name)'
        )

        # Verify extra index exists
        schema_assertions.assert_index_exists('public', table_name, extra_index_name)

        # Step 4: Run script
        execute_generated_script(test_connection, script)

        # Step 5: Verify extra index is dropped
        schema_assertions.assert_index_not_exists('public', table_name, extra_index_name)

    def test_unique_index(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test that script correctly handles unique indexes.
        """
        table_name = f"{unique_prefix}idx_unique"
        index_name = f"{unique_prefix}idx_email_unique"
        full_table_name = f"public.{table_name}"

        # Create table with unique index
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT PRIMARY KEY,
                email VARCHAR(255)
            )
            '''
        )
        db_helpers.execute_sql(
            test_connection,
            f'CREATE UNIQUE INDEX "{index_name}" ON public."{table_name}" (email)'
        )

        # Generate script
        script = script_generator.generate([full_table_name])

        # Drop index
        db_helpers.execute_sql(test_connection, f'DROP INDEX public."{index_name}"')

        # Run script
        execute_generated_script(test_connection, script)

        # Verify unique index is restored
        schema_assertions.assert_index_exists('public', table_name, index_name)

        # Verify it's actually unique by checking the index definition
        idx_info = db_helpers.get_index_info(test_connection, 'public', index_name)
        assert 'UNIQUE' in idx_info['index_def'].upper()

    def test_composite_index(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test that script correctly handles composite (multi-column) indexes.
        """
        table_name = f"{unique_prefix}idx_composite"
        index_name = f"{unique_prefix}idx_name_email"
        full_table_name = f"public.{table_name}"

        # Create table with composite index
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT PRIMARY KEY,
                first_name VARCHAR(100),
                last_name VARCHAR(100),
                email VARCHAR(255)
            )
            '''
        )
        db_helpers.execute_sql(
            test_connection,
            f'CREATE INDEX "{index_name}" ON public."{table_name}" (first_name, last_name)'
        )

        # Generate script
        script = script_generator.generate([full_table_name])

        # Drop index
        db_helpers.execute_sql(test_connection, f'DROP INDEX public."{index_name}"')

        # Run script
        execute_generated_script(test_connection, script)

        # Verify composite index is restored
        schema_assertions.assert_index_exists('public', table_name, index_name)

        # Verify it has both columns
        idx_info = db_helpers.get_index_info(test_connection, 'public', index_name)
        assert 'first_name' in idx_info['index_def'].lower()
        assert 'last_name' in idx_info['index_def'].lower()

    def test_multiple_indexes(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test that script handles multiple indexes on the same table.
        """
        table_name = f"{unique_prefix}multi_idx"
        idx1_name = f"{unique_prefix}idx1"
        idx2_name = f"{unique_prefix}idx2"
        idx3_name = f"{unique_prefix}idx3"
        full_table_name = f"public.{table_name}"

        # Create table with multiple indexes
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT PRIMARY KEY,
                name VARCHAR(100),
                email VARCHAR(255),
                created_at TIMESTAMP
            )
            '''
        )
        db_helpers.execute_sql(
            test_connection,
            f'CREATE INDEX "{idx1_name}" ON public."{table_name}" (name)'
        )
        db_helpers.execute_sql(
            test_connection,
            f'CREATE UNIQUE INDEX "{idx2_name}" ON public."{table_name}" (email)'
        )
        db_helpers.execute_sql(
            test_connection,
            f'CREATE INDEX "{idx3_name}" ON public."{table_name}" (created_at)'
        )

        # Generate script
        script = script_generator.generate([full_table_name])

        # Drop all indexes
        db_helpers.execute_sql(test_connection, f'DROP INDEX public."{idx1_name}"')
        db_helpers.execute_sql(test_connection, f'DROP INDEX public."{idx2_name}"')
        db_helpers.execute_sql(test_connection, f'DROP INDEX public."{idx3_name}"')

        # Run script
        execute_generated_script(test_connection, script)

        # Verify all indexes are restored
        schema_assertions.assert_index_exists('public', table_name, idx1_name)
        schema_assertions.assert_index_exists('public', table_name, idx2_name)
        schema_assertions.assert_index_exists('public', table_name, idx3_name)

    def test_primary_key_index_preserved(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test that primary key indexes are preserved correctly.
        Note: PK indexes are handled separately from regular indexes.
        """
        table_name = f"{unique_prefix}pk_idx"
        full_table_name = f"public.{table_name}"

        # Create table with primary key
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT,
                code VARCHAR(10),
                name VARCHAR(100),
                PRIMARY KEY (id, code)
            )
            '''
        )

        # Generate script
        script = script_generator.generate([full_table_name])

        # Drop and recreate the table without PK
        db_helpers.execute_sql(test_connection, f'DROP TABLE public."{table_name}"')
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT,
                code VARCHAR(10),
                name VARCHAR(100)
            )
            '''
        )

        # Verify no PK
        assert not db_helpers.pk_exists(test_connection, 'public', table_name)

        # Run script
        execute_generated_script(test_connection, script)

        # Verify PK is restored
        schema_assertions.assert_pk_exists('public', table_name)
        schema_assertions.assert_pk_columns('public', table_name, ['id', 'code'])
