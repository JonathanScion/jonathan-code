"""
Integration tests for FK dependency ordering in data operations.

Tests verify that ContextFreeSQL correctly orders:
1. INSERTs: parent tables first, then child tables
2. DELETEs: child tables first, then parent tables
3. Complex multi-level hierarchies
"""
import pytest
from tests.utils import db_helpers
from tests.conftest import execute_generated_script


@pytest.mark.data
class TestFKOrderingInserts:
    """Tests for correct INSERT ordering with FK dependencies."""

    def test_insert_order_two_levels(self, test_connection, script_generator, unique_prefix, data_assertions):
        """
        Test that INSERTs happen in correct order: parent before child.

        Hierarchy:
        - parent_table (no FK)
        - child_table (FK to parent)
        """
        parent_table = f"{unique_prefix}ins_parent"
        child_table = f"{unique_prefix}ins_child"
        fk_name = f"{unique_prefix}ins_fk"

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
        db_helpers.execute_sql(
            test_connection,
            f'''INSERT INTO public."{parent_table}" (id, name) VALUES (1, 'Parent1'), (2, 'Parent2')'''
        )

        # Create child table with FK
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{child_table}" (
                id INT PRIMARY KEY,
                parent_id INT NOT NULL,
                value VARCHAR(100),
                CONSTRAINT "{fk_name}" FOREIGN KEY (parent_id)
                    REFERENCES public."{parent_table}" (id)
            )
            '''
        )
        db_helpers.execute_sql(
            test_connection,
            f'''INSERT INTO public."{child_table}" (id, parent_id, value) VALUES (1, 1, 'Child1'), (2, 2, 'Child2')'''
        )

        # Generate script with data
        script = script_generator.generate(
            [f"public.{parent_table}", f"public.{child_table}"],
            script_data=True
        )

        # Delete all data (child first to respect FK)
        db_helpers.execute_sql(test_connection, f'DELETE FROM public."{child_table}"')
        db_helpers.execute_sql(test_connection, f'DELETE FROM public."{parent_table}"')

        # Verify data deleted
        data_assertions.assert_row_count('public', parent_table, 0)
        data_assertions.assert_row_count('public', child_table, 0)

        # Run script - should INSERT parent first, then child
        execute_generated_script(test_connection, script)

        # Verify data restored
        data_assertions.assert_row_count('public', parent_table, 2)
        data_assertions.assert_row_count('public', child_table, 2)

    def test_insert_order_three_levels(self, test_connection, script_generator, unique_prefix, data_assertions):
        """
        Test INSERT ordering with 3-level hierarchy.

        Hierarchy:
        - grandparent (no FK)
        - parent (FK to grandparent)
        - child (FK to parent)
        """
        gp_table = f"{unique_prefix}ins3_gp"
        p_table = f"{unique_prefix}ins3_p"
        c_table = f"{unique_prefix}ins3_c"

        # Create grandparent
        db_helpers.execute_sql(
            test_connection,
            f'''CREATE TABLE public."{gp_table}" (id INT PRIMARY KEY, name VARCHAR(100))'''
        )
        db_helpers.execute_sql(
            test_connection,
            f'''INSERT INTO public."{gp_table}" (id, name) VALUES (1, 'GP1')'''
        )

        # Create parent with FK to grandparent
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{p_table}" (
                id INT PRIMARY KEY,
                gp_id INT NOT NULL REFERENCES public."{gp_table}" (id),
                name VARCHAR(100)
            )
            '''
        )
        db_helpers.execute_sql(
            test_connection,
            f'''INSERT INTO public."{p_table}" (id, gp_id, name) VALUES (1, 1, 'P1')'''
        )

        # Create child with FK to parent
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{c_table}" (
                id INT PRIMARY KEY,
                p_id INT NOT NULL REFERENCES public."{p_table}" (id),
                name VARCHAR(100)
            )
            '''
        )
        db_helpers.execute_sql(
            test_connection,
            f'''INSERT INTO public."{c_table}" (id, p_id, name) VALUES (1, 1, 'C1')'''
        )

        # Generate script
        script = script_generator.generate(
            [f"public.{gp_table}", f"public.{p_table}", f"public.{c_table}"],
            script_data=True
        )

        # Delete all data (child -> parent -> grandparent)
        db_helpers.execute_sql(test_connection, f'DELETE FROM public."{c_table}"')
        db_helpers.execute_sql(test_connection, f'DELETE FROM public."{p_table}"')
        db_helpers.execute_sql(test_connection, f'DELETE FROM public."{gp_table}"')

        # Run script
        execute_generated_script(test_connection, script)

        # Verify all data restored
        data_assertions.assert_row_count('public', gp_table, 1)
        data_assertions.assert_row_count('public', p_table, 1)
        data_assertions.assert_row_count('public', c_table, 1)


@pytest.mark.data
class TestFKOrderingDeletes:
    """Tests for correct DELETE ordering with FK dependencies."""

    def test_delete_order_two_levels(self, test_connection, script_generator, unique_prefix, data_assertions):
        """
        Test that DELETEs happen in correct order: child before parent.
        """
        parent_table = f"{unique_prefix}del_parent"
        child_table = f"{unique_prefix}del_child"

        # Create parent
        db_helpers.execute_sql(
            test_connection,
            f'''CREATE TABLE public."{parent_table}" (id INT PRIMARY KEY, name VARCHAR(100))'''
        )
        db_helpers.execute_sql(
            test_connection,
            f'''INSERT INTO public."{parent_table}" (id, name) VALUES (1, 'Keep'), (2, 'Delete')'''
        )

        # Create child with RESTRICT FK (will fail if parent deleted first)
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{child_table}" (
                id INT PRIMARY KEY,
                parent_id INT NOT NULL,
                CONSTRAINT "{unique_prefix}del_fk" FOREIGN KEY (parent_id)
                    REFERENCES public."{parent_table}" (id) ON DELETE RESTRICT
            )
            '''
        )
        db_helpers.execute_sql(
            test_connection,
            f'''INSERT INTO public."{child_table}" (id, parent_id) VALUES (1, 1)'''
        )

        # Generate script (captures parent with id 1 only, child with parent_id 1)
        script = script_generator.generate(
            [f"public.{parent_table}", f"public.{child_table}"],
            script_data=True
        )

        # Add extra data that script should DELETE
        db_helpers.execute_sql(
            test_connection,
            f'''INSERT INTO public."{child_table}" (id, parent_id) VALUES (2, 2)'''
        )

        # Run script - should DELETE child row (id=2) before trying to delete parent row (id=2)
        execute_generated_script(test_connection, script)

        # Verify extra data removed
        data_assertions.assert_row_count('public', parent_table, 2)  # Both kept (script had both)
        data_assertions.assert_row_count('public', child_table, 1)  # Only id=1 kept

    def test_delete_order_with_restrict_fk(self, test_connection, script_generator, unique_prefix, data_assertions):
        """
        Test DELETE ordering with RESTRICT FK - would fail if order is wrong.

        This is the key test: if DELETEs aren't ordered correctly,
        we'll get an FK violation error.
        """
        parent_table = f"{unique_prefix}restrict_parent"
        child_table = f"{unique_prefix}restrict_child"

        # Create parent
        db_helpers.execute_sql(
            test_connection,
            f'''CREATE TABLE public."{parent_table}" (id INT PRIMARY KEY)'''
        )
        db_helpers.execute_sql(
            test_connection,
            f'''INSERT INTO public."{parent_table}" (id) VALUES (1)'''
        )

        # Create child with RESTRICT FK
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{child_table}" (
                id INT PRIMARY KEY,
                parent_id INT NOT NULL REFERENCES public."{parent_table}" (id) ON DELETE RESTRICT
            )
            '''
        )
        # No child rows initially

        # Generate script (captures empty child table)
        script = script_generator.generate(
            [f"public.{parent_table}", f"public.{child_table}"],
            script_data=True
        )

        # Now add child row that references parent
        db_helpers.execute_sql(
            test_connection,
            f'''INSERT INTO public."{child_table}" (id, parent_id) VALUES (1, 1)'''
        )

        # Run script - must DELETE from child first, otherwise FK violation
        # If this fails with "violates foreign key constraint", the ordering is wrong
        execute_generated_script(test_connection, script)

        # Verify child row deleted
        data_assertions.assert_row_count('public', child_table, 0)


@pytest.mark.data
class TestFKOrderingComplex:
    """Tests for complex FK ordering scenarios."""

    def test_diamond_dependency(self, test_connection, script_generator, unique_prefix, data_assertions):
        """
        Test diamond-shaped dependency.

        Hierarchy:
              A
             / \\
            B   C
             \\ /
              D

        D depends on both B and C, which both depend on A.
        """
        a_table = f"{unique_prefix}diamond_a"
        b_table = f"{unique_prefix}diamond_b"
        c_table = f"{unique_prefix}diamond_c"
        d_table = f"{unique_prefix}diamond_d"

        # Create A (root)
        db_helpers.execute_sql(
            test_connection,
            f'''CREATE TABLE public."{a_table}" (id INT PRIMARY KEY)'''
        )
        db_helpers.execute_sql(test_connection, f'''INSERT INTO public."{a_table}" (id) VALUES (1)''')

        # Create B (depends on A)
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{b_table}" (
                id INT PRIMARY KEY,
                a_id INT NOT NULL REFERENCES public."{a_table}" (id)
            )
            '''
        )
        db_helpers.execute_sql(test_connection, f'''INSERT INTO public."{b_table}" (id, a_id) VALUES (1, 1)''')

        # Create C (depends on A)
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{c_table}" (
                id INT PRIMARY KEY,
                a_id INT NOT NULL REFERENCES public."{a_table}" (id)
            )
            '''
        )
        db_helpers.execute_sql(test_connection, f'''INSERT INTO public."{c_table}" (id, a_id) VALUES (1, 1)''')

        # Create D (depends on both B and C)
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{d_table}" (
                id INT PRIMARY KEY,
                b_id INT NOT NULL REFERENCES public."{b_table}" (id),
                c_id INT NOT NULL REFERENCES public."{c_table}" (id)
            )
            '''
        )
        db_helpers.execute_sql(
            test_connection,
            f'''INSERT INTO public."{d_table}" (id, b_id, c_id) VALUES (1, 1, 1)'''
        )

        # Generate script
        script = script_generator.generate(
            [f"public.{a_table}", f"public.{b_table}", f"public.{c_table}", f"public.{d_table}"],
            script_data=True
        )

        # Delete all data
        db_helpers.execute_sql(test_connection, f'DELETE FROM public."{d_table}"')
        db_helpers.execute_sql(test_connection, f'DELETE FROM public."{b_table}"')
        db_helpers.execute_sql(test_connection, f'DELETE FROM public."{c_table}"')
        db_helpers.execute_sql(test_connection, f'DELETE FROM public."{a_table}"')

        # Run script
        execute_generated_script(test_connection, script)

        # Verify all restored
        data_assertions.assert_row_count('public', a_table, 1)
        data_assertions.assert_row_count('public', b_table, 1)
        data_assertions.assert_row_count('public', c_table, 1)
        data_assertions.assert_row_count('public', d_table, 1)

    def test_mixed_insert_update_delete(self, test_connection, script_generator, unique_prefix, data_assertions):
        """
        Test that INSERTs, UPDATEs, and DELETEs all work correctly with FK ordering.
        """
        parent_table = f"{unique_prefix}mixed_parent"
        child_table = f"{unique_prefix}mixed_child"

        # Create tables
        db_helpers.execute_sql(
            test_connection,
            f'''CREATE TABLE public."{parent_table}" (id INT PRIMARY KEY, name VARCHAR(100))'''
        )
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{child_table}" (
                id INT PRIMARY KEY,
                parent_id INT NOT NULL REFERENCES public."{parent_table}" (id) ON DELETE RESTRICT,
                value VARCHAR(100)
            )
            '''
        )

        # Insert initial data
        db_helpers.execute_sql(
            test_connection,
            f'''INSERT INTO public."{parent_table}" (id, name) VALUES (1, 'Keep'), (2, 'Update')'''
        )
        db_helpers.execute_sql(
            test_connection,
            f'''INSERT INTO public."{child_table}" (id, parent_id, value) VALUES (1, 1, 'Child1'), (2, 2, 'Child2')'''
        )

        # Generate script
        script = script_generator.generate(
            [f"public.{parent_table}", f"public.{child_table}"],
            script_data=True
        )

        # Make changes:
        # - Add new parent and child (will need to be DELETED by script)
        # - Modify existing data (will need to be UPDATED by script)
        db_helpers.execute_sql(
            test_connection,
            f'''INSERT INTO public."{parent_table}" (id, name) VALUES (3, 'Extra')'''
        )
        db_helpers.execute_sql(
            test_connection,
            f'''INSERT INTO public."{child_table}" (id, parent_id, value) VALUES (3, 3, 'Extra Child')'''
        )
        db_helpers.execute_sql(
            test_connection,
            f'''UPDATE public."{parent_table}" SET name = 'Modified' WHERE id = 2'''
        )
        db_helpers.execute_sql(
            test_connection,
            f'''UPDATE public."{child_table}" SET value = 'Modified Child' WHERE id = 2'''
        )

        # Run script - should:
        # 1. DELETE child id=3 first (FK ordering)
        # 2. DELETE parent id=3
        # 3. UPDATE parent id=2 back to 'Update'
        # 4. UPDATE child id=2 back to 'Child2'
        execute_generated_script(test_connection, script)

        # Verify results
        data_assertions.assert_row_count('public', parent_table, 2)
        data_assertions.assert_row_count('public', child_table, 2)

        # Check updates were reverted
        result = db_helpers.execute_sql(
            test_connection,
            f'''SELECT name FROM public."{parent_table}" WHERE id = 2'''
        )
        assert result[0][0] == 'Update'

        result = db_helpers.execute_sql(
            test_connection,
            f'''SELECT value FROM public."{child_table}" WHERE id = 2'''
        )
        assert result[0][0] == 'Child2'
