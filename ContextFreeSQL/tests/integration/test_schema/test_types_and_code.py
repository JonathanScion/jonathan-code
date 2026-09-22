"""
Integration tests for the parts of a database that aren't tables: enum types, and the code that lives
alongside them.

These only show up when a script is run against a database that doesn't already have them, which is the
case a filtered run never used to reach.
"""
import pytest

from tests.utils import db_helpers
from tests.conftest import execute_generated_script


@pytest.mark.schema
class TestEnumTypes:
    """A column can't be created before the type it is of."""

    def test_enum_type_is_created_with_the_table(self, test_connection, script_generator, test_schema):
        """
        Scripting into a database without the type has to create it.

        Without this the run stops at the first table using it: 'type "discipline" does not exist'.
        """
        db_helpers.execute_sql(
            test_connection,
            f'''CREATE TYPE "{test_schema}".status_kind AS ENUM ('draft', 'live', 'retired')'''
        )
        db_helpers.execute_sql(
            test_connection,
            f'''CREATE TABLE "{test_schema}".thing (id int PRIMARY KEY, status "{test_schema}".status_kind NOT NULL)'''
        )

        script = script_generator.generate([], schemas=[test_schema], exec_code=True)

        db_helpers.execute_sql(test_connection, f'DROP TABLE "{test_schema}".thing')
        db_helpers.execute_sql(test_connection, f'DROP TYPE "{test_schema}".status_kind')

        execute_generated_script(test_connection, script)

        labels = db_helpers.execute_sql(
            test_connection,
            """SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
               JOIN pg_namespace n ON n.oid = t.typnamespace
               WHERE n.nspname = %s AND t.typname = 'status_kind' ORDER BY e.enumsortorder""",
            (test_schema,)
        )
        assert [row[0] for row in labels] == ['draft', 'live', 'retired']
        assert db_helpers.table_exists(test_connection, test_schema, 'thing')

    def test_the_column_keeps_the_type_it_had(self, test_connection, script_generator, test_schema):
        """
        The column's type is named with its schema.

        Unqualified, 'status_kind' only resolves when that schema happens to be on the search_path, which is
        how a scripted table ended up failing even where the type existed.
        """
        db_helpers.execute_sql(
            test_connection,
            f'''CREATE TYPE "{test_schema}".status_kind AS ENUM ('draft', 'live')'''
        )
        db_helpers.execute_sql(
            test_connection,
            f'''CREATE TABLE "{test_schema}".thing (id int PRIMARY KEY, status "{test_schema}".status_kind)'''
        )

        script = script_generator.generate([], schemas=[test_schema], exec_code=True)
        assert f'{test_schema}.status_kind' in script, 'the type should be named with its schema'

        db_helpers.execute_sql(test_connection, f'DROP TABLE "{test_schema}".thing')
        execute_generated_script(test_connection, script)

        column = db_helpers.execute_sql(
            test_connection,
            """SELECT c.udt_schema, c.udt_name FROM information_schema.columns c
               WHERE c.table_schema = %s AND c.table_name = 'thing' AND c.column_name = 'status'""",
            (test_schema,)
        )
        assert column[0] == (test_schema, 'status_kind')

    def test_a_type_whose_values_differ_is_reported_and_left_alone(self, test_connection, script_generator,
                                                                  test_schema):
        """
        Changing a type in place would mean dropping every column using it, so it is reported instead.

        Silently leaving the target's own values in place is the one outcome that would mislead.
        """
        db_helpers.execute_sql(
            test_connection,
            f'''CREATE TYPE "{test_schema}".status_kind AS ENUM ('draft', 'live')'''
        )
        db_helpers.execute_sql(
            test_connection,
            f'''CREATE TABLE "{test_schema}".thing (id int PRIMARY KEY, status "{test_schema}".status_kind)'''
        )
        script = script_generator.generate([], schemas=[test_schema], exec_code=True, print_exec=True)

        db_helpers.execute_sql(test_connection, f'ALTER TYPE "{test_schema}".status_kind ADD VALUE \'archived\'')

        with test_connection.cursor() as cur:
            cur.execute(script)
            reported = ' '.join(str(r[0]) for r in cur.fetchall() if r[0])

        assert 'status_kind exists with different values' in reported
        labels = db_helpers.execute_sql(
            test_connection,
            """SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
               JOIN pg_namespace n ON n.oid = t.typnamespace
               WHERE n.nspname = %s AND t.typname = 'status_kind'""",
            (test_schema,)
        )
        assert labels[0][0] == 3, 'the type itself should be untouched'


@pytest.mark.coded_entities
class TestCodeInAFilteredSchema:
    """Asking for a schema means its code as well as its tables."""

    def _create_code(self, conn, schema):
        db_helpers.execute_sql(conn, f'CREATE TABLE "{schema}".audited (id int PRIMARY KEY, note text, seen_at timestamptz)')
        db_helpers.execute_sql(
            conn,
            f'''CREATE FUNCTION "{schema}".stamp_seen() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN NEW.seen_at := now(); RETURN NEW; END $$'''
        )
        db_helpers.execute_sql(
            conn,
            f'''CREATE TRIGGER stamp_seen_trg BEFORE INSERT ON "{schema}".audited
                FOR EACH ROW EXECUTE FUNCTION "{schema}".stamp_seen()'''
        )
        db_helpers.execute_sql(conn, f'CREATE VIEW "{schema}".audited_notes AS SELECT id, note FROM "{schema}".audited')

    def test_view_function_and_trigger_are_created(self, test_connection, script_generator, test_schema):
        """
        A schema filter used to script the tables and quietly leave the code behind.

        The trigger is the fiddly one: it needs its whole CREATE statement, not just the action, and it can
        only be created after the function it calls.
        """
        self._create_code(test_connection, test_schema)

        script = script_generator.generate([], schemas=[test_schema], exec_code=True)

        db_helpers.execute_sql(test_connection, f'DROP VIEW "{test_schema}".audited_notes')
        db_helpers.execute_sql(test_connection, f'DROP TRIGGER stamp_seen_trg ON "{test_schema}".audited')
        db_helpers.execute_sql(test_connection, f'DROP FUNCTION "{test_schema}".stamp_seen()')

        execute_generated_script(test_connection, script)

        assert db_helpers.view_exists(test_connection, test_schema, 'audited_notes')
        assert db_helpers.function_exists(test_connection, test_schema, 'stamp_seen')
        triggers = db_helpers.execute_sql(
            test_connection,
            """SELECT tg.tgname FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid
               JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = %s AND NOT tg.tgisinternal""",
            (test_schema,)
        )
        assert [row[0] for row in triggers] == ['stamp_seen_trg']

    def test_the_trigger_still_fires(self, test_connection, script_generator, test_schema):
        """Recreated from the script, the trigger has to do what the original did."""
        self._create_code(test_connection, test_schema)
        script = script_generator.generate([], schemas=[test_schema], exec_code=True)

        db_helpers.execute_sql(test_connection, f'DROP TRIGGER stamp_seen_trg ON "{test_schema}".audited')
        db_helpers.execute_sql(test_connection, f'DROP FUNCTION "{test_schema}".stamp_seen()')
        execute_generated_script(test_connection, script)

        db_helpers.execute_sql(test_connection, f'''INSERT INTO "{test_schema}".audited (id, note) VALUES (1, 'x')''')
        stamped = db_helpers.execute_sql(
            test_connection, f'SELECT seen_at IS NOT NULL FROM "{test_schema}".audited WHERE id = 1'
        )
        assert stamped[0][0] is True

    def test_a_list_of_tables_still_leaves_code_alone(self, test_connection, script_generator, test_schema):
        """Naming tables means those tables: code objects aren't on the list, so they are out of scope."""
        self._create_code(test_connection, test_schema)

        script = script_generator.generate([f'{test_schema}.audited'], exec_code=True)

        db_helpers.execute_sql(test_connection, f'DROP VIEW "{test_schema}".audited_notes')
        execute_generated_script(test_connection, script)

        assert not db_helpers.view_exists(test_connection, test_schema, 'audited_notes')

    def test_a_changed_function_is_put_back(self, test_connection, script_generator, test_schema):
        """
        A function whose body differs is dropped and created again from the script.

        That path is gated on the same condition as creating one, so it needs covering too.
        """
        self._create_code(test_connection, test_schema)
        script = script_generator.generate([], schemas=[test_schema], exec_code=True)

        db_helpers.execute_sql(
            test_connection,
            f'''CREATE OR REPLACE FUNCTION "{test_schema}".stamp_seen() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN NEW.seen_at := 'epoch'; RETURN NEW; END $$'''
        )
        execute_generated_script(test_connection, script)

        db_helpers.execute_sql(test_connection, f'''INSERT INTO "{test_schema}".audited (id, note) VALUES (2, 'y')''')
        recent = db_helpers.execute_sql(
            test_connection,
            f"SELECT seen_at > now() - interval '1 hour' FROM \"{test_schema}\".audited WHERE id = 2"
        )
        assert recent[0][0] is True, 'the function should be back to what the script holds'
