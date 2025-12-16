"""
Integration tests for data scripting (INSERT statement generation).

Tests verify that ContextFreeSQL correctly generates SQL to:
1. Restore deleted rows
2. Handle NULL values correctly
3. Handle special characters (quotes, newlines)
4. Handle various data types
"""
import pytest
from tests.utils import db_helpers
from tests.conftest import execute_generated_script


@pytest.mark.data
class TestDataScripting:
    """Tests for data scripting operations."""

    def test_restore_deleted_rows(self, test_connection, script_generator, unique_prefix, data_assertions):
        """
        Test that script restores deleted rows.

        Steps:
        1. Create table with data
        2. Generate script with data scripting enabled
        3. Delete some rows
        4. Run script
        5. Verify rows are restored
        """
        table_name = f"{unique_prefix}data_restore"
        full_table_name = f"public.{table_name}"

        # Step 1: Create table and insert data
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT PRIMARY KEY,
                name VARCHAR(100),
                value INT
            )
            '''
        )
        db_helpers.execute_sql(
            test_connection,
            f'''
            INSERT INTO public."{table_name}" (id, name, value) VALUES
                (1, 'Alice', 100),
                (2, 'Bob', 200),
                (3, 'Charlie', 300)
            '''
        )

        # Step 2: Generate script with data scripting
        script = script_generator.generate([full_table_name], script_data=True)

        # Step 3: Delete some rows
        db_helpers.execute_sql(
            test_connection,
            f'''DELETE FROM public."{table_name}" WHERE id IN (1, 3)'''
        )

        # Verify rows are deleted
        data_assertions.assert_row_count('public', table_name, 1)

        # Step 4: Run script
        execute_generated_script(test_connection, script)

        # Step 5: Verify rows are restored
        data_assertions.assert_row_count('public', table_name, 3)
        data_assertions.assert_row_exists('public', table_name, {'id': 1, 'name': 'Alice'})
        data_assertions.assert_row_exists('public', table_name, {'id': 3, 'name': 'Charlie'})

    def test_null_values(self, test_connection, script_generator, unique_prefix, data_assertions):
        """
        Test that NULL values are preserved correctly (not converted to empty strings).
        """
        table_name = f"{unique_prefix}null_test"
        full_table_name = f"public.{table_name}"

        # Create table with nullable columns
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT PRIMARY KEY,
                nullable_text TEXT,
                nullable_int INT
            )
            '''
        )

        # Insert rows with NULL values
        db_helpers.execute_sql(
            test_connection,
            f'''
            INSERT INTO public."{table_name}" (id, nullable_text, nullable_int) VALUES
                (1, NULL, NULL),
                (2, 'has value', NULL),
                (3, NULL, 42)
            '''
        )

        # Generate script
        script = script_generator.generate([full_table_name], script_data=True)

        # Delete all rows
        db_helpers.execute_sql(test_connection, f'''DELETE FROM public."{table_name}"''')

        # Run script
        execute_generated_script(test_connection, script)

        # Verify NULL values are preserved
        result = db_helpers.execute_sql(
            test_connection,
            f'''SELECT * FROM public."{table_name}" WHERE id = 1'''
        )
        assert result[0][1] is None  # nullable_text should be NULL
        assert result[0][2] is None  # nullable_int should be NULL

        result = db_helpers.execute_sql(
            test_connection,
            f'''SELECT * FROM public."{table_name}" WHERE id = 2'''
        )
        assert result[0][1] == 'has value'
        assert result[0][2] is None

    def test_special_characters_quotes(self, test_connection, script_generator, unique_prefix, data_assertions):
        """
        Test that single quotes and special characters are escaped correctly.
        """
        table_name = f"{unique_prefix}special_chars"
        full_table_name = f"public.{table_name}"

        # Create table
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT PRIMARY KEY,
                text_col TEXT
            )
            '''
        )

        # Insert rows with special characters
        test_values = [
            (1, "It's a test"),  # Single quote
            (2, "He said \"hello\""),  # Double quotes
            (3, "Line1\nLine2"),  # Newline
            (4, "Tab\there"),  # Tab
            (5, "Backslash\\here"),  # Backslash
        ]
        for id_val, text_val in test_values:
            db_helpers.execute_sql(
                test_connection,
                f'''INSERT INTO public."{table_name}" (id, text_col) VALUES (%s, %s)''',
                (id_val, text_val)
            )

        # Generate script
        script = script_generator.generate([full_table_name], script_data=True)

        # Delete all rows
        db_helpers.execute_sql(test_connection, f'''DELETE FROM public."{table_name}"''')

        # Run script
        execute_generated_script(test_connection, script)

        # Verify special characters preserved
        data_assertions.assert_row_count('public', table_name, 5)

        result = db_helpers.execute_sql(
            test_connection,
            f'''SELECT text_col FROM public."{table_name}" WHERE id = 1'''
        )
        assert result[0][0] == "It's a test"

    def test_various_data_types(self, test_connection, script_generator, unique_prefix, data_assertions):
        """
        Test that various data types are scripted correctly.
        """
        table_name = f"{unique_prefix}data_types"
        full_table_name = f"public.{table_name}"

        # Create table with various types
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT PRIMARY KEY,
                int_col INT,
                bigint_col BIGINT,
                bool_col BOOLEAN,
                text_col TEXT,
                numeric_col NUMERIC(10, 2),
                date_col DATE
            )
            '''
        )

        # Insert test data
        db_helpers.execute_sql(
            test_connection,
            f'''
            INSERT INTO public."{table_name}"
            (id, int_col, bigint_col, bool_col, text_col, numeric_col, date_col)
            VALUES
            (1, 42, 9999999999, true, 'test', 123.45, '2024-01-15')
            '''
        )

        # Generate script
        script = script_generator.generate([full_table_name], script_data=True)

        # Delete all rows
        db_helpers.execute_sql(test_connection, f'''DELETE FROM public."{table_name}"''')

        # Run script
        execute_generated_script(test_connection, script)

        # Verify data
        data_assertions.assert_row_count('public', table_name, 1)
        result = db_helpers.execute_sql(
            test_connection,
            f'''SELECT * FROM public."{table_name}" WHERE id = 1'''
        )
        row = result[0]
        assert row[1] == 42  # int_col
        assert row[2] == 9999999999  # bigint_col
        assert row[3] == True  # bool_col
        assert row[4] == 'test'  # text_col

    def test_empty_string_vs_null(self, test_connection, script_generator, unique_prefix, data_assertions):
        """
        Test that empty strings and NULL are treated differently.
        """
        table_name = f"{unique_prefix}empty_vs_null"
        full_table_name = f"public.{table_name}"

        # Create table
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT PRIMARY KEY,
                text_col TEXT
            )
            '''
        )

        # Insert empty string and NULL
        db_helpers.execute_sql(
            test_connection,
            f'''
            INSERT INTO public."{table_name}" (id, text_col) VALUES
                (1, ''),
                (2, NULL)
            '''
        )

        # Generate script
        script = script_generator.generate([full_table_name], script_data=True)

        # Delete all rows
        db_helpers.execute_sql(test_connection, f'''DELETE FROM public."{table_name}"''')

        # Run script
        execute_generated_script(test_connection, script)

        # Verify empty string vs NULL
        result = db_helpers.execute_sql(
            test_connection,
            f'''SELECT id, text_col FROM public."{table_name}" ORDER BY id'''
        )
        assert result[0][1] == ''  # Empty string
        assert result[1][1] is None  # NULL

    def test_large_text_data(self, test_connection, script_generator, unique_prefix, data_assertions):
        """
        Test that large text values are handled correctly.
        """
        table_name = f"{unique_prefix}large_text"
        full_table_name = f"public.{table_name}"

        # Create table
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT PRIMARY KEY,
                large_text TEXT
            )
            '''
        )

        # Insert large text (10KB)
        large_text = "X" * 10000
        db_helpers.execute_sql(
            test_connection,
            f'''INSERT INTO public."{table_name}" (id, large_text) VALUES (%s, %s)''',
            (1, large_text)
        )

        # Generate script
        script = script_generator.generate([full_table_name], script_data=True)

        # Delete all rows
        db_helpers.execute_sql(test_connection, f'''DELETE FROM public."{table_name}"''')

        # Run script
        execute_generated_script(test_connection, script)

        # Verify large text preserved
        result = db_helpers.execute_sql(
            test_connection,
            f'''SELECT large_text FROM public."{table_name}" WHERE id = 1'''
        )
        assert result[0][0] == large_text

    def test_schema_and_data_together(self, test_connection, script_generator, unique_prefix, schema_assertions, data_assertions):
        """
        Test that schema changes and data scripting work together.
        """
        table_name = f"{unique_prefix}schema_data"
        full_table_name = f"public.{table_name}"

        # Create table with data
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT PRIMARY KEY,
                name VARCHAR(100),
                score INT
            )
            '''
        )
        db_helpers.execute_sql(
            test_connection,
            f'''
            INSERT INTO public."{table_name}" (id, name, score) VALUES
                (1, 'Alice', 100),
                (2, 'Bob', 200)
            '''
        )

        # Generate script with both schema and data
        script = script_generator.generate([full_table_name], script_data=True)

        # Make schema AND data changes
        db_helpers.execute_sql(
            test_connection,
            f'ALTER TABLE public."{table_name}" ADD COLUMN extra_col TEXT'
        )
        db_helpers.execute_sql(
            test_connection,
            f'''DELETE FROM public."{table_name}" WHERE id = 1'''
        )

        # Run script
        execute_generated_script(test_connection, script)

        # Verify both schema and data restored
        schema_assertions.assert_column_not_exists('public', table_name, 'extra_col')
        data_assertions.assert_row_count('public', table_name, 2)
        data_assertions.assert_row_exists('public', table_name, {'id': 1, 'name': 'Alice'})
