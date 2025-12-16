"""
Integration tests for column add/alter/drop operations.

Tests verify that ContextFreeSQL correctly generates SQL to:
1. Add missing columns
2. Drop extra columns
3. Alter column types
4. Alter column nullability
"""
import pytest
from tests.utils import db_helpers
from tests.conftest import execute_generated_script


@pytest.mark.schema
class TestColumnOperations:
    """Tests for column-level schema operations."""

    def test_add_missing_column(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test that script adds a missing column.

        Steps:
        1. Create a table with columns A, B, C
        2. Generate script
        3. Drop column C
        4. Run script
        5. Verify column C is restored
        """
        table_name = f"{unique_prefix}add_col"
        full_table_name = f"public.{table_name}"

        # Step 1: Create table with three columns
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                col_a INT PRIMARY KEY,
                col_b VARCHAR(100),
                col_c TEXT
            )
            '''
        )

        # Step 2: Generate script
        script = script_generator.generate([full_table_name])

        # Step 3: Drop column C
        db_helpers.execute_sql(
            test_connection,
            f'ALTER TABLE public."{table_name}" DROP COLUMN col_c'
        )

        # Verify column is gone
        schema_assertions.assert_column_not_exists('public', table_name, 'col_c')

        # Step 4: Run script
        execute_generated_script(test_connection, script)

        # Step 5: Verify column is restored
        schema_assertions.assert_column_exists('public', table_name, 'col_c')
        schema_assertions.assert_column_type('public', table_name, 'col_c', 'text')

    def test_drop_extra_column(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test that script drops an extra column.

        Steps:
        1. Create a table with columns A, B
        2. Generate script
        3. Add column C
        4. Run script
        5. Verify column C is dropped
        """
        table_name = f"{unique_prefix}drop_col"
        full_table_name = f"public.{table_name}"

        # Step 1: Create table with two columns
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                col_a INT PRIMARY KEY,
                col_b VARCHAR(100)
            )
            '''
        )

        # Step 2: Generate script
        script = script_generator.generate([full_table_name], remove_extras=True)

        # Step 3: Add extra column C
        db_helpers.execute_sql(
            test_connection,
            f'ALTER TABLE public."{table_name}" ADD COLUMN col_c TEXT'
        )

        # Verify extra column exists
        schema_assertions.assert_column_exists('public', table_name, 'col_c')

        # Step 4: Run script
        execute_generated_script(test_connection, script)

        # Step 5: Verify extra column is dropped
        schema_assertions.assert_column_not_exists('public', table_name, 'col_c')
        # Original columns should remain
        schema_assertions.assert_column_exists('public', table_name, 'col_a')
        schema_assertions.assert_column_exists('public', table_name, 'col_b')

    def test_alter_column_type_varchar_length(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test that script restores column VARCHAR length.

        Steps:
        1. Create table with VARCHAR(100) column
        2. Generate script
        3. Alter column to VARCHAR(50)
        4. Run script
        5. Verify column is back to VARCHAR(100)
        """
        table_name = f"{unique_prefix}alter_type"
        full_table_name = f"public.{table_name}"

        # Step 1: Create table with VARCHAR(100)
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
        script = script_generator.generate([full_table_name])

        # Step 3: Alter to VARCHAR(50)
        db_helpers.execute_sql(
            test_connection,
            f'ALTER TABLE public."{table_name}" ALTER COLUMN name TYPE VARCHAR(50)'
        )

        # Verify change
        col_info = db_helpers.get_column_info(test_connection, 'public', table_name, 'name')
        assert col_info['character_maximum_length'] == 50

        # Step 4: Run script
        execute_generated_script(test_connection, script)

        # Step 5: Verify restored to VARCHAR(100)
        col_info = db_helpers.get_column_info(test_connection, 'public', table_name, 'name')
        assert col_info['character_maximum_length'] == 100

    def test_alter_column_nullable_to_not_null(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test that script restores NOT NULL constraint.

        Steps:
        1. Create table with NOT NULL column
        2. Generate script
        3. Make column nullable
        4. Run script
        5. Verify column is back to NOT NULL
        """
        table_name = f"{unique_prefix}alter_null"
        full_table_name = f"public.{table_name}"

        # Step 1: Create table with NOT NULL column
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT PRIMARY KEY,
                required_col VARCHAR(100) NOT NULL
            )
            '''
        )

        # Step 2: Generate script
        script = script_generator.generate([full_table_name])

        # Step 3: Make column nullable
        db_helpers.execute_sql(
            test_connection,
            f'ALTER TABLE public."{table_name}" ALTER COLUMN required_col DROP NOT NULL'
        )

        # Verify change
        schema_assertions.assert_column_nullable('public', table_name, 'required_col', True)

        # Step 4: Run script
        execute_generated_script(test_connection, script)

        # Step 5: Verify NOT NULL is restored
        schema_assertions.assert_column_nullable('public', table_name, 'required_col', False)

    def test_alter_column_not_null_to_nullable(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test that script can make a column nullable.

        Steps:
        1. Create table with nullable column
        2. Generate script
        3. Add NOT NULL constraint
        4. Run script
        5. Verify column is back to nullable
        """
        table_name = f"{unique_prefix}make_nullable"
        full_table_name = f"public.{table_name}"

        # Step 1: Create table with nullable column
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT PRIMARY KEY,
                optional_col VARCHAR(100)
            )
            '''
        )

        # Step 2: Generate script
        script = script_generator.generate([full_table_name])

        # Step 3: Add NOT NULL (insert data first to satisfy constraint)
        db_helpers.execute_sql(
            test_connection,
            f'''INSERT INTO public."{table_name}" (id, optional_col) VALUES (1, 'test')'''
        )
        db_helpers.execute_sql(
            test_connection,
            f'ALTER TABLE public."{table_name}" ALTER COLUMN optional_col SET NOT NULL'
        )

        # Verify change
        schema_assertions.assert_column_nullable('public', table_name, 'optional_col', False)

        # Step 4: Run script
        execute_generated_script(test_connection, script)

        # Step 5: Verify column is back to nullable
        schema_assertions.assert_column_nullable('public', table_name, 'optional_col', True)

    def test_alter_column_type_int_to_bigint(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test that script restores column type from BIGINT back to INT.
        """
        table_name = f"{unique_prefix}int_bigint"
        full_table_name = f"public.{table_name}"

        # Create table with INT column
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT PRIMARY KEY,
                count_col INT
            )
            '''
        )

        # Generate script
        script = script_generator.generate([full_table_name])

        # Alter to BIGINT
        db_helpers.execute_sql(
            test_connection,
            f'ALTER TABLE public."{table_name}" ALTER COLUMN count_col TYPE BIGINT'
        )

        # Verify change
        col_info = db_helpers.get_column_info(test_connection, 'public', table_name, 'count_col')
        assert 'bigint' in col_info['data_type'].lower() or col_info['udt_name'] == 'int8'

        # Run script
        execute_generated_script(test_connection, script)

        # Verify restored to INT
        col_info = db_helpers.get_column_info(test_connection, 'public', table_name, 'count_col')
        assert 'int' in col_info['data_type'].lower() or col_info['udt_name'] == 'int4'

    def test_multiple_column_changes(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test that script handles multiple column changes at once.
        """
        table_name = f"{unique_prefix}multi_col"
        full_table_name = f"public.{table_name}"

        # Create original table
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT PRIMARY KEY,
                col_a VARCHAR(100) NOT NULL,
                col_b TEXT,
                col_c INT
            )
            '''
        )

        # Generate script
        script = script_generator.generate([full_table_name])

        # Make multiple changes
        db_helpers.execute_sql(
            test_connection,
            f'''
            ALTER TABLE public."{table_name}"
                DROP COLUMN col_b,
                ADD COLUMN col_d BOOLEAN,
                ALTER COLUMN col_a DROP NOT NULL
            '''
        )

        # Verify changes
        schema_assertions.assert_column_not_exists('public', table_name, 'col_b')
        schema_assertions.assert_column_exists('public', table_name, 'col_d')
        schema_assertions.assert_column_nullable('public', table_name, 'col_a', True)

        # Run script
        execute_generated_script(test_connection, script)

        # Verify all restored
        schema_assertions.assert_column_exists('public', table_name, 'col_b')
        schema_assertions.assert_column_not_exists('public', table_name, 'col_d')
        schema_assertions.assert_column_nullable('public', table_name, 'col_a', False)
