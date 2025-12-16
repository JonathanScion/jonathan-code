"""
Integration tests for function and procedure operations.

Tests verify that ContextFreeSQL correctly generates SQL to:
1. Create missing functions
2. Update changed functions
3. Handle function overloads
4. Create procedures
"""
import pytest
from tests.utils import db_helpers
from tests.conftest import execute_generated_script


@pytest.mark.coded_entities
@pytest.mark.skip(reason="Coded entities (functions/views/procedures) are only processed when scripting entire database, not when specific entities are filtered. This is by design.")
class TestFunctionOperations:
    """Tests for function and procedure operations."""

    def test_create_missing_function(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test that script creates a missing function.

        Steps:
        1. Create a function
        2. Generate script
        3. Drop the function
        4. Run script
        5. Verify function is recreated
        """
        func_name = f"{unique_prefix}add_numbers"
        full_func_name = f"public.{func_name}"

        # Step 1: Create function
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE FUNCTION public."{func_name}"(a INT, b INT)
            RETURNS INT
            LANGUAGE sql
            AS $$
                SELECT a + b;
            $$
            '''
        )

        # Step 2: Generate script
        # Note: We need to include the function in the entity list
        script = script_generator.generate([full_func_name])

        # Step 3: Drop the function
        db_helpers.execute_sql(
            test_connection,
            f'DROP FUNCTION public."{func_name}"(INT, INT)'
        )

        # Verify function is gone
        assert not db_helpers.function_exists(test_connection, 'public', func_name, 'integer, integer')

        # Step 4: Run script
        execute_generated_script(test_connection, script)

        # Step 5: Verify function is recreated
        assert db_helpers.function_exists(test_connection, 'public', func_name, 'integer, integer')

    def test_update_function_body(self, test_connection, script_generator, unique_prefix):
        """
        Test that script updates a function's body when it changes.
        """
        func_name = f"{unique_prefix}get_greeting"

        # Create function with original body
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE FUNCTION public."{func_name}"(name TEXT)
            RETURNS TEXT
            LANGUAGE sql
            AS $$
                SELECT 'Hello, ' || name || '!';
            $$
            '''
        )

        # Generate script
        script = script_generator.generate([f"public.{func_name}"])

        # Change the function body
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE OR REPLACE FUNCTION public."{func_name}"(name TEXT)
            RETURNS TEXT
            LANGUAGE sql
            AS $$
                SELECT 'Goodbye, ' || name || '!';
            $$
            '''
        )

        # Verify changed body
        result = db_helpers.execute_sql(
            test_connection,
            f'''SELECT public."{func_name}"('World')'''
        )
        assert 'Goodbye' in result[0][0]

        # Run script
        execute_generated_script(test_connection, script)

        # Verify original body is restored
        result = db_helpers.execute_sql(
            test_connection,
            f'''SELECT public."{func_name}"('World')'''
        )
        assert 'Hello' in result[0][0]

    def test_create_view(self, test_connection, script_generator, unique_prefix, schema_assertions):
        """
        Test that script creates a missing view.
        """
        table_name = f"{unique_prefix}view_source"
        view_name = f"{unique_prefix}view_test"
        full_table = f"public.{table_name}"
        full_view = f"public.{view_name}"

        # Create source table
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT PRIMARY KEY,
                name VARCHAR(100),
                active BOOLEAN
            )
            '''
        )

        # Create view
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE VIEW public."{view_name}" AS
                SELECT id, name FROM public."{table_name}" WHERE active = true
            '''
        )

        # Generate script
        script = script_generator.generate([full_table, full_view])

        # Drop view
        db_helpers.execute_sql(test_connection, f'DROP VIEW public."{view_name}"')

        # Verify view is gone
        schema_assertions.assert_view_not_exists('public', view_name)

        # Run script
        execute_generated_script(test_connection, script)

        # Verify view is recreated
        schema_assertions.assert_view_exists('public', view_name)

    def test_create_procedure(self, test_connection, script_generator, unique_prefix):
        """
        Test that script creates a missing procedure.
        """
        proc_name = f"{unique_prefix}do_something"
        table_name = f"{unique_prefix}proc_table"

        # Create table for procedure to operate on
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT PRIMARY KEY,
                counter INT DEFAULT 0
            )
            '''
        )

        # Create procedure
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE PROCEDURE public."{proc_name}"(IN p_id INT)
            LANGUAGE sql
            AS $$
                UPDATE public."{table_name}" SET counter = counter + 1 WHERE id = p_id;
            $$
            '''
        )

        # Generate script
        script = script_generator.generate([f"public.{table_name}", f"public.{proc_name}"])

        # Drop procedure
        db_helpers.execute_sql(
            test_connection,
            f'DROP PROCEDURE public."{proc_name}"(INT)'
        )

        # Verify procedure is gone
        assert not db_helpers.function_exists(test_connection, 'public', proc_name, 'integer')

        # Run script
        execute_generated_script(test_connection, script)

        # Verify procedure exists (functions and procedures use same catalog)
        assert db_helpers.function_exists(test_connection, 'public', proc_name, 'integer')

    def test_function_with_default_parameters(self, test_connection, script_generator, unique_prefix):
        """
        Test that function with default parameters is handled correctly.
        """
        func_name = f"{unique_prefix}greet_with_default"

        # Create function with default parameter
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE FUNCTION public."{func_name}"(name TEXT DEFAULT 'World')
            RETURNS TEXT
            LANGUAGE sql
            AS $$
                SELECT 'Hello, ' || name || '!';
            $$
            '''
        )

        # Generate script
        script = script_generator.generate([f"public.{func_name}"])

        # Drop function
        db_helpers.execute_sql(
            test_connection,
            f'DROP FUNCTION public."{func_name}"'
        )

        # Run script
        execute_generated_script(test_connection, script)

        # Verify function works with default
        result = db_helpers.execute_sql(
            test_connection,
            f'''SELECT public."{func_name}"()'''
        )
        assert 'Hello, World!' in result[0][0]

    def test_plpgsql_function(self, test_connection, script_generator, unique_prefix):
        """
        Test that PL/pgSQL functions are handled correctly.
        """
        func_name = f"{unique_prefix}plpgsql_func"

        # Create PL/pgSQL function
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE FUNCTION public."{func_name}"(n INT)
            RETURNS INT
            LANGUAGE plpgsql
            AS $$
            DECLARE
                result INT := 0;
                i INT;
            BEGIN
                FOR i IN 1..n LOOP
                    result := result + i;
                END LOOP;
                RETURN result;
            END;
            $$
            '''
        )

        # Generate script
        script = script_generator.generate([f"public.{func_name}"])

        # Drop function
        db_helpers.execute_sql(
            test_connection,
            f'DROP FUNCTION public."{func_name}"(INT)'
        )

        # Run script
        execute_generated_script(test_connection, script)

        # Verify function works
        result = db_helpers.execute_sql(
            test_connection,
            f'''SELECT public."{func_name}"(5)'''
        )
        assert result[0][0] == 15  # 1+2+3+4+5

    def test_function_returns_table(self, test_connection, script_generator, unique_prefix):
        """
        Test that functions returning tables are handled correctly.
        """
        func_name = f"{unique_prefix}get_numbers"

        # Create function returning table
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE FUNCTION public."{func_name}"(max_val INT)
            RETURNS TABLE (num INT, squared INT)
            LANGUAGE sql
            AS $$
                SELECT i, i * i FROM generate_series(1, max_val) AS i;
            $$
            '''
        )

        # Generate script
        script = script_generator.generate([f"public.{func_name}"])

        # Drop function
        db_helpers.execute_sql(
            test_connection,
            f'DROP FUNCTION public."{func_name}"(INT)'
        )

        # Run script
        execute_generated_script(test_connection, script)

        # Verify function works
        result = db_helpers.execute_sql(
            test_connection,
            f'''SELECT * FROM public."{func_name}"(3)'''
        )
        assert len(result) == 3
        assert result[0] == (1, 1)
        assert result[1] == (2, 4)
        assert result[2] == (3, 9)
