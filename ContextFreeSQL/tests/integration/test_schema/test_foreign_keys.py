"""
Integration tests for foreign key operations.

Tests verify that ContextFreeSQL correctly generates SQL to:
1. Add missing foreign keys
2. Drop extra foreign keys
3. Handle foreign key dependencies
"""
import pytest
from tests.utils import db_helpers
from tests.conftest import execute_generated_script


@pytest.mark.schema
class TestForeignKeyOperations:
    """Tests for foreign key operations."""

    def test_add_missing_foreign_key(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test that script adds a missing foreign key.

        Steps:
        1. Create parent and child tables with FK
        2. Generate script
        3. Drop the FK
        4. Run script
        5. Verify FK is restored
        """
        parent_table = f"{unique_prefix}parent"
        child_table = f"{unique_prefix}child"
        fk_name = f"{unique_prefix}fk_parent"
        full_parent = f"public.{parent_table}"
        full_child = f"public.{child_table}"

        # Step 1: Create parent table
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
                description TEXT,
                CONSTRAINT "{fk_name}" FOREIGN KEY (parent_id)
                    REFERENCES public."{parent_table}" (id)
            )
            '''
        )

        # Step 2: Generate script for both tables
        script = script_generator.generate([full_parent, full_child])

        # Step 3: Drop the FK
        db_helpers.execute_sql(
            test_connection,
            f'ALTER TABLE public."{child_table}" DROP CONSTRAINT "{fk_name}"'
        )

        # Verify FK is gone
        schema_assertions.assert_fk_not_exists('public', fk_name)

        # Step 4: Run script
        execute_generated_script(test_connection, script)

        # Step 5: Verify FK is restored
        schema_assertions.assert_fk_exists('public', fk_name)

    def test_drop_extra_foreign_key(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test that script drops an extra foreign key.

        Steps:
        1. Create parent and child tables without FK
        2. Generate script
        3. Add FK
        4. Run script
        5. Verify FK is dropped
        """
        parent_table = f"{unique_prefix}parent_no_fk"
        child_table = f"{unique_prefix}child_no_fk"
        extra_fk_name = f"{unique_prefix}fk_extra"
        full_parent = f"public.{parent_table}"
        full_child = f"public.{child_table}"

        # Step 1: Create tables without FK
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{parent_table}" (
                id INT PRIMARY KEY,
                name VARCHAR(100)
            )
            '''
        )
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{child_table}" (
                id INT PRIMARY KEY,
                parent_id INT,
                description TEXT
            )
            '''
        )

        # Step 2: Generate script (no FK in desired state)
        script = script_generator.generate([full_parent, full_child], remove_extras=True)

        # Step 3: Add extra FK
        db_helpers.execute_sql(
            test_connection,
            f'''
            ALTER TABLE public."{child_table}"
            ADD CONSTRAINT "{extra_fk_name}" FOREIGN KEY (parent_id)
                REFERENCES public."{parent_table}" (id)
            '''
        )

        # Verify extra FK exists
        schema_assertions.assert_fk_exists('public', extra_fk_name)

        # Step 4: Run script
        execute_generated_script(test_connection, script)

        # Step 5: Verify extra FK is dropped
        schema_assertions.assert_fk_not_exists('public', extra_fk_name)

    def test_composite_foreign_key(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test that script handles composite (multi-column) foreign keys.
        """
        parent_table = f"{unique_prefix}parent_comp"
        child_table = f"{unique_prefix}child_comp"
        fk_name = f"{unique_prefix}fk_composite"
        full_parent = f"public.{parent_table}"
        full_child = f"public.{child_table}"

        # Create parent with composite PK
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{parent_table}" (
                id1 INT,
                id2 INT,
                name VARCHAR(100),
                PRIMARY KEY (id1, id2)
            )
            '''
        )

        # Create child with composite FK
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{child_table}" (
                id INT PRIMARY KEY,
                parent_id1 INT,
                parent_id2 INT,
                CONSTRAINT "{fk_name}" FOREIGN KEY (parent_id1, parent_id2)
                    REFERENCES public."{parent_table}" (id1, id2)
            )
            '''
        )

        # Generate script
        script = script_generator.generate([full_parent, full_child])

        # Drop FK
        db_helpers.execute_sql(
            test_connection,
            f'ALTER TABLE public."{child_table}" DROP CONSTRAINT "{fk_name}"'
        )

        # Run script
        execute_generated_script(test_connection, script)

        # Verify FK is restored
        schema_assertions.assert_fk_exists('public', fk_name)

    def test_self_referencing_foreign_key(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test that script handles self-referencing foreign keys.
        """
        table_name = f"{unique_prefix}self_ref"
        fk_name = f"{unique_prefix}fk_self"
        full_table = f"public.{table_name}"

        # Create table with self-reference
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT PRIMARY KEY,
                parent_id INT,
                name VARCHAR(100),
                CONSTRAINT "{fk_name}" FOREIGN KEY (parent_id)
                    REFERENCES public."{table_name}" (id)
            )
            '''
        )

        # Generate script
        script = script_generator.generate([full_table])

        # Drop FK
        db_helpers.execute_sql(
            test_connection,
            f'ALTER TABLE public."{table_name}" DROP CONSTRAINT "{fk_name}"'
        )

        # Run script
        execute_generated_script(test_connection, script)

        # Verify FK is restored
        schema_assertions.assert_fk_exists('public', fk_name)

    def test_foreign_key_on_delete_cascade(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test that script preserves ON DELETE CASCADE behavior.
        """
        parent_table = f"{unique_prefix}parent_cascade"
        child_table = f"{unique_prefix}child_cascade"
        fk_name = f"{unique_prefix}fk_cascade"
        full_parent = f"public.{parent_table}"
        full_child = f"public.{child_table}"

        # Create parent
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{parent_table}" (
                id INT PRIMARY KEY,
                name VARCHAR(100)
            )
            '''
        )

        # Create child with ON DELETE CASCADE
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{child_table}" (
                id INT PRIMARY KEY,
                parent_id INT,
                CONSTRAINT "{fk_name}" FOREIGN KEY (parent_id)
                    REFERENCES public."{parent_table}" (id)
                    ON DELETE CASCADE
            )
            '''
        )

        # Generate script
        script = script_generator.generate([full_parent, full_child])

        # Drop FK
        db_helpers.execute_sql(
            test_connection,
            f'ALTER TABLE public."{child_table}" DROP CONSTRAINT "{fk_name}"'
        )

        # Run script
        execute_generated_script(test_connection, script)

        # Verify FK is restored
        schema_assertions.assert_fk_exists('public', fk_name)

        # Test that CASCADE behavior works
        db_helpers.execute_sql(
            test_connection,
            f'''INSERT INTO public."{parent_table}" (id, name) VALUES (1, 'Test')'''
        )
        db_helpers.execute_sql(
            test_connection,
            f'''INSERT INTO public."{child_table}" (id, parent_id) VALUES (1, 1)'''
        )
        # Delete parent should cascade to child
        db_helpers.execute_sql(
            test_connection,
            f'''DELETE FROM public."{parent_table}" WHERE id = 1'''
        )
        # Verify child was deleted
        result = db_helpers.execute_sql(
            test_connection,
            f'''SELECT COUNT(*) FROM public."{child_table}" WHERE parent_id = 1'''
        )
        assert result[0][0] == 0

    def test_multiple_foreign_keys(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test that script handles tables with multiple foreign keys.
        """
        parent1 = f"{unique_prefix}parent1"
        parent2 = f"{unique_prefix}parent2"
        child = f"{unique_prefix}child_multi_fk"
        fk1_name = f"{unique_prefix}fk1"
        fk2_name = f"{unique_prefix}fk2"

        # Create parent tables
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{parent1}" (
                id INT PRIMARY KEY,
                name VARCHAR(100)
            )
            '''
        )
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{parent2}" (
                id INT PRIMARY KEY,
                code VARCHAR(10)
            )
            '''
        )

        # Create child with multiple FKs
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{child}" (
                id INT PRIMARY KEY,
                parent1_id INT,
                parent2_id INT,
                CONSTRAINT "{fk1_name}" FOREIGN KEY (parent1_id)
                    REFERENCES public."{parent1}" (id),
                CONSTRAINT "{fk2_name}" FOREIGN KEY (parent2_id)
                    REFERENCES public."{parent2}" (id)
            )
            '''
        )

        # Generate script
        script = script_generator.generate([
            f"public.{parent1}",
            f"public.{parent2}",
            f"public.{child}"
        ])

        # Drop both FKs
        db_helpers.execute_sql(
            test_connection,
            f'ALTER TABLE public."{child}" DROP CONSTRAINT "{fk1_name}"'
        )
        db_helpers.execute_sql(
            test_connection,
            f'ALTER TABLE public."{child}" DROP CONSTRAINT "{fk2_name}"'
        )

        # Run script
        execute_generated_script(test_connection, script)

        # Verify both FKs are restored
        schema_assertions.assert_fk_exists('public', fk1_name)
        schema_assertions.assert_fk_exists('public', fk2_name)
