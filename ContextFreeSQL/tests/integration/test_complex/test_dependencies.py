"""
Integration tests for complex dependency scenarios.

Tests verify that ContextFreeSQL correctly handles:
1. Column changes that affect indexes
2. Column changes that affect foreign keys
3. Multiple interdependent changes
4. Script idempotency (running twice is safe)
"""
import pytest
from tests.utils import db_helpers
from tests.conftest import execute_generated_script


@pytest.mark.complex
class TestDependencyScenarios:
    """Tests for complex dependency scenarios."""

    def test_alter_column_with_index(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test that altering a column with an index works correctly.

        The script should:
        1. Drop the index
        2. Alter the column
        3. Recreate the index
        """
        table_name = f"{unique_prefix}idx_col"
        index_name = f"{unique_prefix}idx_name"
        full_table = f"public.{table_name}"

        # Create table with indexed column
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT PRIMARY KEY,
                name VARCHAR(100)
            )
            '''
        )
        db_helpers.execute_sql(
            test_connection,
            f'CREATE INDEX "{index_name}" ON public."{table_name}" (name)'
        )

        # Generate script (captures VARCHAR(100))
        script = script_generator.generate([full_table])

        # Change column type (this would normally fail with index present)
        # First drop index, then alter, then we'll verify script recreates it
        db_helpers.execute_sql(test_connection, f'DROP INDEX public."{index_name}"')
        db_helpers.execute_sql(
            test_connection,
            f'ALTER TABLE public."{table_name}" ALTER COLUMN name TYPE VARCHAR(50)'
        )
        # Don't recreate the index - let the script do it

        # Run script
        execute_generated_script(test_connection, script)

        # Verify column type restored AND index exists
        col_info = db_helpers.get_column_info(test_connection, 'public', table_name, 'name')
        assert col_info['character_maximum_length'] == 100
        schema_assertions.assert_index_exists('public', table_name, index_name)

    def test_alter_column_with_foreign_key(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test that altering a column with a foreign key works correctly.

        The script should:
        1. Drop the FK
        2. Alter the column
        3. Recreate the FK
        """
        parent_table = f"{unique_prefix}fk_parent"
        child_table = f"{unique_prefix}fk_child"
        fk_name = f"{unique_prefix}fk_col"

        # Create parent table
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{parent_table}" (
                id INT PRIMARY KEY,
                name VARCHAR(100)
            )
            '''
        )

        # Create child table with FK
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{child_table}" (
                id INT PRIMARY KEY,
                parent_id INT,
                value VARCHAR(100),
                CONSTRAINT "{fk_name}" FOREIGN KEY (parent_id)
                    REFERENCES public."{parent_table}" (id)
            )
            '''
        )

        # Generate script
        script = script_generator.generate([
            f"public.{parent_table}",
            f"public.{child_table}"
        ])

        # Alter the child table's column (drop FK first to allow changes)
        db_helpers.execute_sql(
            test_connection,
            f'ALTER TABLE public."{child_table}" DROP CONSTRAINT "{fk_name}"'
        )
        db_helpers.execute_sql(
            test_connection,
            f'ALTER TABLE public."{child_table}" ALTER COLUMN value TYPE VARCHAR(50)'
        )
        # Don't recreate FK - let script do it

        # Run script
        execute_generated_script(test_connection, script)

        # Verify column type restored AND FK exists
        col_info = db_helpers.get_column_info(test_connection, 'public', child_table, 'value')
        assert col_info['character_maximum_length'] == 100
        schema_assertions.assert_fk_exists('public', fk_name)

    def test_column_with_index_and_foreign_key(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test handling a column that has both an index AND is part of a FK relationship.
        """
        parent_table = f"{unique_prefix}both_parent"
        child_table = f"{unique_prefix}both_child"
        fk_name = f"{unique_prefix}fk_both"
        idx_name = f"{unique_prefix}idx_both"

        # Create parent
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{parent_table}" (
                id INT PRIMARY KEY
            )
            '''
        )

        # Create child with FK and index on the FK column
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{child_table}" (
                id INT PRIMARY KEY,
                parent_id INT,
                CONSTRAINT "{fk_name}" FOREIGN KEY (parent_id)
                    REFERENCES public."{parent_table}" (id)
            )
            '''
        )
        db_helpers.execute_sql(
            test_connection,
            f'CREATE INDEX "{idx_name}" ON public."{child_table}" (parent_id)'
        )

        # Generate script
        script = script_generator.generate([
            f"public.{parent_table}",
            f"public.{child_table}"
        ])

        # Remove both FK and index
        db_helpers.execute_sql(
            test_connection,
            f'ALTER TABLE public."{child_table}" DROP CONSTRAINT "{fk_name}"'
        )
        db_helpers.execute_sql(test_connection, f'DROP INDEX public."{idx_name}"')

        # Verify both are gone
        schema_assertions.assert_fk_not_exists('public', fk_name)
        schema_assertions.assert_index_not_exists('public', child_table, idx_name)

        # Run script
        execute_generated_script(test_connection, script)

        # Verify both restored
        schema_assertions.assert_fk_exists('public', fk_name)
        schema_assertions.assert_index_exists('public', child_table, idx_name)


@pytest.mark.complex
class TestIdempotency:
    """Tests for script idempotency (running twice should be safe)."""

    def test_script_runs_twice_no_error(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test that running the script twice doesn't cause errors.
        """
        table_name = f"{unique_prefix}idem_table"
        index_name = f"{unique_prefix}idem_idx"
        full_table = f"public.{table_name}"

        # Create table with index
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT PRIMARY KEY,
                name VARCHAR(100)
            )
            '''
        )
        db_helpers.execute_sql(
            test_connection,
            f'CREATE INDEX "{index_name}" ON public."{table_name}" (name)'
        )

        # Generate script
        script = script_generator.generate([full_table])

        # Run script first time
        execute_generated_script(test_connection, script)

        # Run script second time - should not error
        execute_generated_script(test_connection, script)

        # Verify table and index still exist correctly
        schema_assertions.assert_table_exists('public', table_name)
        schema_assertions.assert_index_exists('public', table_name, index_name)

    def test_script_twice_with_data(self, test_connection, script_generator, unique_prefix, data_assertions):
        """
        Test that running script with data twice doesn't duplicate rows.
        """
        table_name = f"{unique_prefix}idem_data"
        full_table = f"public.{table_name}"

        # Create table with data
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT PRIMARY KEY,
                name VARCHAR(100)
            )
            '''
        )
        db_helpers.execute_sql(
            test_connection,
            f'''
            INSERT INTO public."{table_name}" (id, name) VALUES
                (1, 'Alice'),
                (2, 'Bob')
            '''
        )

        # Generate script with data
        script = script_generator.generate([full_table], script_data=True)

        # Run script twice
        execute_generated_script(test_connection, script)
        execute_generated_script(test_connection, script)

        # Verify still only 2 rows (no duplicates)
        data_assertions.assert_row_count('public', table_name, 2)

    def test_no_changes_needed(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test that script handles case where no changes are needed.
        """
        table_name = f"{unique_prefix}no_change"
        full_table = f"public.{table_name}"

        # Create table
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT PRIMARY KEY,
                name VARCHAR(100) NOT NULL
            )
            '''
        )

        # Generate script
        script = script_generator.generate([full_table])

        # Don't make any changes - just run script on matching state
        execute_generated_script(test_connection, script)

        # Verify table is unchanged
        schema_assertions.assert_table_exists('public', table_name)
        schema_assertions.assert_column_exists('public', table_name, 'id')
        schema_assertions.assert_column_exists('public', table_name, 'name')
        schema_assertions.assert_column_nullable('public', table_name, 'name', False)


@pytest.mark.complex
class TestFullWorkflow:
    """End-to-end tests covering full workflow scenarios."""

    def test_complete_table_workflow(self, test_connection, script_generator, unique_prefix,
                                      schema_assertions, data_assertions):
        """
        Test a complete workflow with table, columns, indexes, FK, and data.
        """
        parent_table = f"{unique_prefix}workflow_parent"
        child_table = f"{unique_prefix}workflow_child"
        fk_name = f"{unique_prefix}wf_fk"
        idx_name = f"{unique_prefix}wf_idx"

        # Create parent table with data
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{parent_table}" (
                id INT PRIMARY KEY,
                name VARCHAR(100) NOT NULL
            )
            '''
        )
        db_helpers.execute_sql(
            test_connection,
            f'''
            INSERT INTO public."{parent_table}" (id, name) VALUES (1, 'Parent1'), (2, 'Parent2')
            '''
        )

        # Create child table with FK, index, and data
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{child_table}" (
                id INT PRIMARY KEY,
                parent_id INT,
                description VARCHAR(200),
                CONSTRAINT "{fk_name}" FOREIGN KEY (parent_id)
                    REFERENCES public."{parent_table}" (id)
            )
            '''
        )
        db_helpers.execute_sql(
            test_connection,
            f'CREATE INDEX "{idx_name}" ON public."{child_table}" (description)'
        )
        db_helpers.execute_sql(
            test_connection,
            f'''
            INSERT INTO public."{child_table}" (id, parent_id, description) VALUES
                (1, 1, 'Child of Parent1'),
                (2, 2, 'Child of Parent2')
            '''
        )

        # Generate script with everything
        script = script_generator.generate(
            [f"public.{parent_table}", f"public.{child_table}"],
            script_data=True
        )

        # Make multiple changes (simulate drift)
        # 1. Delete a row from parent (cascades to child)
        db_helpers.execute_sql(
            test_connection,
            f'ALTER TABLE public."{child_table}" DROP CONSTRAINT "{fk_name}"'
        )
        db_helpers.execute_sql(
            test_connection,
            f'''DELETE FROM public."{parent_table}" WHERE id = 1'''
        )
        db_helpers.execute_sql(
            test_connection,
            f'''DELETE FROM public."{child_table}" WHERE parent_id = 1'''
        )

        # 2. Add extra column to child
        db_helpers.execute_sql(
            test_connection,
            f'ALTER TABLE public."{child_table}" ADD COLUMN extra_col TEXT'
        )

        # 3. Drop the index
        db_helpers.execute_sql(test_connection, f'DROP INDEX public."{idx_name}"')

        # Verify drift
        data_assertions.assert_row_count('public', parent_table, 1)
        data_assertions.assert_row_count('public', child_table, 1)
        schema_assertions.assert_column_exists('public', child_table, 'extra_col')
        schema_assertions.assert_index_not_exists('public', child_table, idx_name)
        schema_assertions.assert_fk_not_exists('public', fk_name)

        # Run script to restore everything
        execute_generated_script(test_connection, script)

        # Verify everything is restored
        data_assertions.assert_row_count('public', parent_table, 2)
        data_assertions.assert_row_count('public', child_table, 2)
        schema_assertions.assert_column_not_exists('public', child_table, 'extra_col')
        schema_assertions.assert_index_exists('public', child_table, idx_name)
        schema_assertions.assert_fk_exists('public', fk_name)
        data_assertions.assert_row_exists('public', parent_table, {'id': 1, 'name': 'Parent1'})
        data_assertions.assert_row_exists('public', child_table, {'id': 1, 'parent_id': 1})
