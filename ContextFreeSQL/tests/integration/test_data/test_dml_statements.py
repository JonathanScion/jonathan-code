"""
Integration tests for the per-row DML statements the script prints.

With scripting_options.data_scripting_generate_dml_statements on, the script reports the individual
INSERT, UPDATE and DELETE statements that would bring the target's rows in line with the source, for a
person to read or copy. They have to be valid SQL that does exactly that, so these tests take the
statements the script printed, run them, and check the data ends up matching the source.
"""
import json

import pytest

from tests.utils import db_helpers


def _printed_statements(conn, script: str, table_name: str):
    """Run the script and return the INSERT/UPDATE/DELETE statements it printed for one table."""
    with conn.cursor() as cur:
        cur.execute(script)
        rows = [r[0] for r in cur.fetchall() if r[0]]
    return [
        sql.strip() for sql in rows
        if sql.strip().upper().startswith(('INSERT', 'UPDATE', 'DELETE')) and table_name in sql
    ]


def _rows(conn, table_name):
    return db_helpers.get_table_data(conn, 'public', table_name, order_by='id')


@pytest.mark.data
class TestGeneratedDMLStatements:
    """The printed INSERT/UPDATE/DELETE statements must be valid SQL that restores the source's rows."""

    def _create_table(self, conn, table_name):
        """A table covering the types whose values used to come out truncated or unquoted."""
        db_helpers.execute_sql(
            conn,
            f'''
            CREATE TABLE public."{table_name}" (
                id uuid PRIMARY KEY,
                n int,
                txt text,
                vc varchar(50),
                payload jsonb,
                ts timestamptz,
                amount numeric(14,4),
                flag boolean,
                "Odd Name" text,
                "50_pct" int
            )
            '''
        )

    # The source state. Row 2 is missing from the target (INSERT), row 1 differs (UPDATE)
    ROW_1 = ('11111111-1111-4111-8111-111111111111', 5, "it's a \"test\"", 'plain', '{"a": 1, "b": "x"}',
             '2026-01-05 06:28:00-07', '1234567890.1234', True, 'odd', 7)
    ROW_2 = ('22222222-2222-4222-8222-222222222222', -3, 'second row', None, '{"deep": {"n": [1, 2, 3]}}',
             '2025-12-31 23:59:59.123456+00', '-0.5000', False, None, None)

    def _insert(self, conn, table_name, row):
        db_helpers.execute_sql(
            conn,
            f'''INSERT INTO public."{table_name}" (id, n, txt, vc, payload, ts, amount, flag, "Odd Name", "50_pct")
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)''',
            row
        )

    def test_printed_dml_restores_the_source_rows(self, test_connection, script_generator, unique_prefix):
        """
        The whole set: a row to update, a row to insert and a row to delete, in one run.

        The statements are executed exactly as printed - if any of them is malformed (the UPDATE used to
        carry a WHERE on an alias the statement never declared) this raises.
        """
        table_name = f"{unique_prefix}dml"
        table_ref = f'public.{table_name}'
        self._create_table(test_connection, table_name)
        self._insert(test_connection, table_name, self.ROW_1)
        self._insert(test_connection, table_name, self.ROW_2)

        expected = _rows(test_connection, table_name)

        script = script_generator.generate(
            [table_ref], script_data=True, exec_code=False, print_exec=True, save_old_value=True
        )

        # Drift: change every column of row 1, delete row 2, add a row that isn't in the source
        db_helpers.execute_sql(
            test_connection,
            f'''UPDATE public."{table_name}" SET n = 11, txt = 'was here /* and */ gone', vc = NULL,
                    payload = '{{"a": 2}}', ts = '2020-02-02 02:02:02+00', amount = 0.0001, flag = false,
                    "Odd Name" = 'changed', "50_pct" = 99
                WHERE id = %s''',
            (self.ROW_1[0],)
        )
        db_helpers.execute_sql(test_connection, f'DELETE FROM public."{table_name}" WHERE id = %s', (self.ROW_2[0],))
        self._insert(
            test_connection, table_name,
            ('33333333-3333-4333-8333-333333333333', 1, 'extra', 'extra', '{}', '2026-06-06 06:06:06+00',
             '1.0000', True, 'extra', 1)
        )

        statements = _printed_statements(test_connection, script, table_name)

        kinds = {s.split()[0].upper() for s in statements}
        assert kinds == {'INSERT', 'UPDATE', 'DELETE'}, f"expected all three kinds, got {kinds}: {statements}"

        # Exactly as printed: this is what a person would copy out of the report
        for sql in statements:
            db_helpers.execute_sql(test_connection, sql)

        assert _rows(test_connection, table_name) == expected

    def test_update_statement_shape(self, test_connection, script_generator, unique_prefix):
        """The UPDATE names its own alias in the WHERE, keeps the key whole, and quotes what needs it."""
        table_name = f"{unique_prefix}upd"
        table_ref = f'public.{table_name}'
        self._create_table(test_connection, table_name)
        self._insert(test_connection, table_name, self.ROW_1)

        script = script_generator.generate(
            [table_ref], script_data=True, exec_code=False, print_exec=True, save_old_value=True
        )
        db_helpers.execute_sql(
            test_connection,
            f'''UPDATE public."{table_name}" SET n = 11, txt = 'other' WHERE id = %s''', (self.ROW_1[0],)
        )

        statements = _printed_statements(test_connection, script, table_name)
        updates = [s for s in statements if s.upper().startswith('UPDATE')]
        assert len(updates) == 1, statements
        update = updates[0]

        # The table is aliased orig, so the WHERE has to be on orig: a WHERE on s. is
        # 'missing FROM-clause entry for table s'
        assert ' orig ' in update
        assert 's.id=' not in update and 's.id =' not in update
        # The key is a 36 character uuid. It was cast to varchar(20), which cut it to 'b9eda4a1-8421-5a38-8'
        assert f"'{self.ROW_1[0]}'" in update, update
        # The value the target holds now, as a comment
        assert '/*11*/' in update, update
        # Values keep their quotes, whatever the type, and quotes inside them are escaped
        assert "txt='it''s a \"test\"'" in update, update

    def test_values_are_not_truncated_or_left_unquoted(self, test_connection, script_generator, unique_prefix):
        """
        A row only the source has is printed as an INSERT.

        Its values used to be cast to varchar(30), which cut a uuid (36 chars) and any longer json or text
        short, and the types is_type_string didn't list - uuid, text, json - came out as bare words.
        """
        table_name = f"{unique_prefix}ins"
        table_ref = f'public.{table_name}'
        self._create_table(test_connection, table_name)
        self._insert(test_connection, table_name, self.ROW_1)
        self._insert(test_connection, table_name, self.ROW_2)
        expected = _rows(test_connection, table_name)

        script = script_generator.generate(
            [table_ref], script_data=True, exec_code=False, print_exec=True, save_old_value=True
        )
        db_helpers.execute_sql(test_connection, f'DELETE FROM public."{table_name}" WHERE id = %s', (self.ROW_2[0],))

        statements = _printed_statements(test_connection, script, table_name)
        inserts = [s for s in statements if s.upper().startswith('INSERT')]
        assert len(inserts) == 1, statements
        insert = inserts[0]

        assert f"'{self.ROW_2[0]}'" in insert, insert          # the full uuid, quoted
        assert "'second row'" in insert                         # text, quoted
        assert json.dumps({"deep": {"n": [1, 2, 3]}}) not in insert or "'{" in insert  # json is quoted
        assert 'NULL' in insert                                 # the null columns stay NULL, not ''

        db_helpers.execute_sql(test_connection, insert)
        assert _rows(test_connection, table_name) == expected

    def test_composite_key_matches_on_every_key_column(self, test_connection, script_generator, unique_prefix):
        """A two column primary key: both columns have to appear in the WHERE, joined with AND."""
        table_name = f"{unique_prefix}comp"
        table_ref = f'public.{table_name}'
        db_helpers.execute_sql(
            test_connection,
            f'''CREATE TABLE public."{table_name}" (
                    part_a int, "Part B" text, payload text, PRIMARY KEY (part_a, "Part B")
                )'''
        )
        db_helpers.execute_sql(
            test_connection,
            f'''INSERT INTO public."{table_name}" VALUES (1, 'x', 'keep'), (1, 'y', 'keep too')'''
        )
        expected = db_helpers.get_table_data(test_connection, 'public', table_name, order_by='part_a, "Part B"')

        script = script_generator.generate(
            [table_ref], script_data=True, exec_code=False, print_exec=True, save_old_value=True
        )
        # Drift one of the two rows that share part_a: a WHERE missing the second key column would hit both
        db_helpers.execute_sql(
            test_connection, f'''UPDATE public."{table_name}" SET payload = 'drifted' WHERE "Part B" = 'y' '''
        )

        statements = _printed_statements(test_connection, script, table_name)
        updates = [s for s in statements if s.upper().startswith('UPDATE')]
        assert len(updates) == 1, statements
        assert 'AND' in updates[0] and '"Part B"=' in updates[0], updates[0]

        db_helpers.execute_sql(test_connection, updates[0])
        assert db_helpers.get_table_data(
            test_connection, 'public', table_name, order_by='part_a, "Part B"'
        ) == expected

    def test_delete_statement_targets_only_the_extra_row(self, test_connection, script_generator, unique_prefix):
        """A row only the target has is printed as a DELETE that matches it by key."""
        table_name = f"{unique_prefix}del"
        table_ref = f'public.{table_name}'
        self._create_table(test_connection, table_name)
        self._insert(test_connection, table_name, self.ROW_1)
        expected = _rows(test_connection, table_name)

        script = script_generator.generate(
            [table_ref], script_data=True, exec_code=False, print_exec=True, save_old_value=True
        )
        extra_id = '44444444-4444-4444-8444-444444444444'
        self._insert(
            test_connection, table_name,
            (extra_id, 9, 'to go', 'to go', '{"x": 1}', '2026-03-03 03:03:03+00', '3.0000', True, 'x', 3)
        )

        statements = _printed_statements(test_connection, script, table_name)
        deletes = [s for s in statements if s.upper().startswith('DELETE')]
        assert len(deletes) == 1, statements
        assert f"'{extra_id}'" in deletes[0], deletes[0]

        db_helpers.execute_sql(test_connection, deletes[0])
        assert _rows(test_connection, table_name) == expected
