"""
Extensions, identifier quoting, and statements that end in a semicolon.

All three came from running a generated script against a real target on Azure:

  CREATE SCHEMA maintenance_360 AUTHORIZATION cze-a-i-nucowm-x-mikub-01-app;
  -> syntax error at or near "-"

  CREATE TABLE wpc.embedding_... (embedding public.vector NULL, ...)
  -> type "public.vector" does not exist

  CREATE SCHEMA cron AUTHORIZATION azuresu;
  -> must be able to SET ROLE "azuresu"

The first is quoting. The other two are the same thing: what an extension owns cannot be scripted object
by object, so the extension itself has to be created and its own objects left alone. pgvector is not
installed here, so citext stands in for it - it brings a type the same way.
"""
import json
import os
import subprocess
import sys
import uuid
from pathlib import Path

import psycopg2
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from src.utils.funcs import pg_terminated_statement
from tests.conftest import load_test_config

PROJECT = Path(__file__).parent.parent.parent.parent
AWKWARD_ROLE = 'cze-a-i-test-01-app'   # an Azure managed identity: bare, the dashes parse as subtraction


def admin_connection():
    cfg = load_test_config()
    conn = psycopg2.connect(host=cfg.host, database='postgres', user=cfg.user,
                            password=cfg.password, port=cfg.port)
    conn.autocommit = True
    return conn


def db_connection(db_name):
    cfg = load_test_config()
    conn = psycopg2.connect(host=cfg.host, database=db_name, user=cfg.user,
                            password=cfg.password, port=cfg.port)
    conn.autocommit = True
    return conn


def run_sql(conn, sql):
    with conn.cursor() as cur:
        cur.execute(sql)


def generate_script(db_name, work_dir, script_extensions=True):
    cfg = load_test_config()
    out_sql = os.path.join(work_dir, 'ext.sql')
    config = {
        'database': {'host': cfg.host, 'db_name': db_name, 'user': cfg.user,
                     'password': cfg.password, 'port': cfg.port},
        'scripting_options': {'remove_all_extra_ents': True, 'script_security': False,
                              'all_schemas': True, 'data_scripting_generate_dml_statements': False,
                              'script_extensions': script_extensions},
        'table_script_ops': {'column_identity': True, 'indexes': True, 'foreign_keys': True,
                             'defaults': True, 'check_constraints': True},
        'db_ents_to_load': {'tables': [], 'schemas': []},
        'tables_data': {'tables': [], 'schemas': [], 'from_file': False, 'max_rows_per_table': 0,
                        'script_data': True, 'max_rows_per_table_retain_fk_integrity': False},
        'input_output': {'html_template_path': '', 'html_output_path': os.path.join(work_dir, 'r.html'),
                         'diff_template_path': '', 'diff_output_dir': work_dir, 'output_sql': out_sql},
        'sql_script_params': {'print': False, 'print_exec': True, 'exec_code': True,
                              'html_report': False, 'export_csv': False},
    }
    config_path = os.path.join(work_dir, 'config.json')
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config, f)
    result = subprocess.run([sys.executable, '-m', 'src.main', config_path],
                            capture_output=True, text=True, cwd=str(PROJECT))
    assert result.returncode == 0, f'generating failed: {result.stderr[-2000:]}'
    with open(out_sql, encoding='utf-8') as f:
        return f.read()


def citext_is_available(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM pg_available_extensions WHERE name = 'citext'")
        return cur.fetchone() is not None


SOURCE_SQL = f"""
CREATE EXTENSION citext;
CREATE EXTENSION hstore;
CREATE SCHEMA extown;
ALTER EXTENSION hstore ADD SCHEMA extown;        -- a schema the extension owns, as pg_cron owns 'cron'
CREATE TABLE extown.ext_table (id int PRIMARY KEY);
ALTER EXTENSION hstore ADD TABLE extown.ext_table;
CREATE SCHEMA maintenance_360 AUTHORIZATION "{AWKWARD_ROLE}";
CREATE TABLE maintenance_360.notes (
    id         text PRIMARY KEY,
    label      public.citext NOT NULL,          -- a type only the extension can provide
    tags       public.hstore,
    created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO maintenance_360.notes (id, label) VALUES ('1', 'Alpha'), ('2', 'Beta');
"""


@pytest.mark.schema
@pytest.mark.slow
def test_an_extension_and_an_awkward_role_name_survive_the_round_trip(tmp_path):
    """Source with an extension type and a dash-laden owner, rebuilt into an empty database."""
    source = 'cfs_ext_s_' + uuid.uuid4().hex[:8]
    target = 'cfs_ext_t_' + uuid.uuid4().hex[:8]
    admin = admin_connection()

    if not citext_is_available(admin):
        admin.close()
        pytest.skip('citext is not available on this server, and it stands in for pgvector here')

    # Created only if it is not already there. Dropping it first would fail whenever another database still
    # holds something it owns, which says nothing about this test
    run_sql(admin, f"""DO $do$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{AWKWARD_ROLE}') THEN
            CREATE ROLE "{AWKWARD_ROLE}" NOLOGIN;
        END IF;
    END $do$""")
    run_sql(admin, f'CREATE DATABASE {source}')
    run_sql(admin, f'CREATE DATABASE {target}')
    try:
        conn = db_connection(source)
        try:
            run_sql(conn, SOURCE_SQL)
            script = generate_script(source, str(tmp_path))
        finally:
            conn.close()

        # The quoting is the point: bare, the dashes are a syntax error
        assert f'"{AWKWARD_ROLE}"' in script, 'the role name was not quoted'
        assert 'CREATE EXTENSION IF NOT EXISTS citext' in script, 'the extension was not scripted'

        # Nothing the extension owns should be in the script at all
        assert 'extown' not in script, 'an extension-owned schema or table was scripted'

        conn = db_connection(target)
        try:
            with conn.cursor() as cur:
                cur.execute(script)
            with conn.cursor() as cur:
                cur.execute("SELECT extname FROM pg_extension WHERE extname IN ('citext','hstore') ORDER BY 1")
                extensions = [r[0] for r in cur.fetchall()]
                cur.execute("""SELECT column_name, udt_name FROM information_schema.columns
                               WHERE table_schema = 'maintenance_360' AND table_name = 'notes'
                               ORDER BY column_name""")
                columns = dict(cur.fetchall())
                cur.execute("SELECT schema_owner FROM information_schema.schemata WHERE schema_name = 'maintenance_360'")
                owner = cur.fetchone()[0]
                cur.execute('SELECT count(*) FROM maintenance_360.notes')
                rows = cur.fetchone()[0]

            # And a second run has nothing left to do
            with conn.cursor() as cur:
                cur.execute(script)
                settled = [r[0] for r in cur.fetchall() if r[0]]
        finally:
            conn.close()
    finally:
        run_sql(admin, f'DROP DATABASE IF EXISTS {source} WITH (FORCE)')
        run_sql(admin, f'DROP DATABASE IF EXISTS {target} WITH (FORCE)')
        try:
            run_sql(admin, f'DROP ROLE IF EXISTS "{AWKWARD_ROLE}"')
        except psycopg2.Error:
            pass
        admin.close()

    assert extensions == ['citext', 'hstore'], f'the extensions were not created: {extensions}'
    assert columns.get('label') == 'citext', f'the extension type did not survive: {columns}'
    assert owner == AWKWARD_ROLE, f'the schema owner is wrong: {owner}'
    assert rows == 2
    assert not settled, f'the second run still wanted to change things: {settled[:5]}'


@pytest.mark.schema
@pytest.mark.slow
def test_every_reported_statement_ends_in_a_semicolon(tmp_path):
    """So the whole result can be copied and run as a batch, which is what it is for."""
    source = 'cfs_semi_s_' + uuid.uuid4().hex[:8]
    target = 'cfs_semi_t_' + uuid.uuid4().hex[:8]
    admin = admin_connection()
    run_sql(admin, f'CREATE DATABASE {source}')
    run_sql(admin, f'CREATE DATABASE {target}')
    try:
        conn = db_connection(source)
        try:
            # Enough shapes to cover the kinds of statement: table, key, index, foreign key, check, view,
            # function, trigger and rows
            run_sql(conn, """
                CREATE SCHEMA app;
                CREATE TABLE app.parent (id int PRIMARY KEY, name text NOT NULL DEFAULT 'x');
                CREATE TABLE app.child (
                    id int PRIMARY KEY, parent_id int NOT NULL, amount numeric(8,2),
                    CONSTRAINT fk_child_parent FOREIGN KEY (parent_id) REFERENCES app.parent (id),
                    CONSTRAINT ck_child_amount CHECK (amount IS NULL OR amount >= 0));
                CREATE INDEX ix_child_parent ON app.child (parent_id);
                CREATE VIEW app.both AS SELECT p.id, c.amount FROM app.parent p JOIN app.child c ON c.parent_id = p.id;
                CREATE FUNCTION app.touch() RETURNS trigger LANGUAGE plpgsql AS $fn$ BEGIN RETURN NEW; END $fn$;
                CREATE TRIGGER trg_touch BEFORE INSERT ON app.child FOR EACH ROW EXECUTE FUNCTION app.touch();
                INSERT INTO app.parent (id, name) VALUES (1, 'a'), (2, 'b');
                INSERT INTO app.child (id, parent_id, amount) VALUES (10, 1, 5.00), (11, 2, NULL);
            """)
            script = generate_script(source, str(tmp_path))
        finally:
            conn.close()

        conn = db_connection(target)
        try:
            with conn.cursor() as cur:
                cur.execute(script)
                reported = [r[0] for r in cur.fetchall() if r and r[0]]
        finally:
            conn.close()
    finally:
        run_sql(admin, f'DROP DATABASE IF EXISTS {source} WITH (FORCE)')
        run_sql(admin, f'DROP DATABASE IF EXISTS {target} WITH (FORCE)')
        admin.close()

    assert reported, 'nothing was reported, so this proves nothing'
    # Comment and description rows are not statements and are left alone on purpose
    unterminated = [s for s in reported
                    if not s.rstrip().endswith(';') and not s.lstrip().startswith('--')]
    assert not unterminated, (
        'statements came back without a trailing semicolon:\n  '
        + '\n  '.join(s[:120].replace('\n', ' ') for s in unterminated[:5]))

    stray_whitespace = [s for s in reported if s.endswith(';') and len(s) > 1 and s[-2] in ' \t\r\n']
    assert not stray_whitespace, (
        'the semicolon landed after trailing whitespace, so it sits on a line of its own: '
        + repr(stray_whitespace[0][-40:]))


def test_the_termination_expression_carries_no_raw_newline_or_backslash():
    """
    A guard on how the expression is built, not on what it does.

    It goes through a Python string and then a SQL string literal, and a backslash survives neither
    reliably - written as an escape it twice came out as a real newline sitting inside the generated
    script's literal. The whitespace is built with CHR() instead.
    """
    expression = pg_terminated_statement('SQLText')
    assert '\n' not in expression, 'a real newline ended up in the generated SQL'
    assert '\\' not in expression, 'a backslash ended up in the generated SQL'
    assert 'CHR(10)' in expression and 'CHR(9)' in expression


@pytest.mark.schema
@pytest.mark.slow
def test_only_the_extensions_the_schema_depends_on_are_scripted(tmp_path):
    """
    A managed PostgreSQL carries extensions that are the platform's business, not the schema's.

    An Azure server holds pgaadauth, azure and pg_stat_statements alongside vector. Creating those on a
    target is refused, and since the script is one atomic block a single refusal rolls the whole run back -
    so scripting an extension nothing needs is not a harmless extra. Here citext stands in for a type the
    schema uses, pg_trgm for an operator class an index names, and tablefunc and hstore for the platform's
    own, installed but depended on by nothing.
    """
    db_name = 'cfs_dep_' + uuid.uuid4().hex[:8]
    admin = admin_connection()
    if not citext_is_available(admin):
        admin.close()
        pytest.skip('citext is not available on this server')

    run_sql(admin, f'CREATE DATABASE {db_name}')
    try:
        conn = db_connection(db_name)
        try:
            run_sql(conn, """
                CREATE EXTENSION citext;
                CREATE EXTENSION pg_trgm;
                CREATE EXTENSION tablefunc;
                CREATE EXTENSION hstore;
                CREATE SCHEMA app;
                CREATE TABLE app.notes (id int PRIMARY KEY, label public.citext NOT NULL, body text);
                CREATE INDEX ix_notes_body_trgm ON app.notes USING gin (body public.gin_trgm_ops);
            """)
            script = generate_script(db_name, str(tmp_path))
        finally:
            conn.close()
    finally:
        run_sql(admin, f'DROP DATABASE IF EXISTS {db_name} WITH (FORCE)')
        admin.close()

    assert 'CREATE EXTENSION IF NOT EXISTS citext' in script, 'the type its column uses was not scripted'
    assert 'CREATE EXTENSION IF NOT EXISTS pg_trgm' in script, 'the operator class its index names was not scripted'
    assert 'CREATE EXTENSION IF NOT EXISTS tablefunc' not in script, (
        'an extension nothing depends on was scripted, which on a managed server means a refusal that '
        'rolls the whole run back')
    assert 'CREATE EXTENSION IF NOT EXISTS hstore' not in script, 'same, for hstore'


@pytest.mark.schema
@pytest.mark.slow
def test_scripting_extensions_can_be_turned_off(tmp_path):
    """For a target whose extensions someone else administers."""
    db_name = 'cfs_noext_' + uuid.uuid4().hex[:8]
    admin = admin_connection()
    if not citext_is_available(admin):
        admin.close()
        pytest.skip('citext is not available on this server')

    run_sql(admin, f'CREATE DATABASE {db_name}')
    try:
        conn = db_connection(db_name)
        try:
            run_sql(conn, """
                CREATE EXTENSION citext;
                CREATE SCHEMA app;
                CREATE TABLE app.notes (id int PRIMARY KEY, label public.citext NOT NULL);
            """)
            on = generate_script(db_name, str(tmp_path))
            off = generate_script(db_name, str(tmp_path), script_extensions=False)
        finally:
            conn.close()
    finally:
        run_sql(admin, f'DROP DATABASE IF EXISTS {db_name} WITH (FORCE)')
        admin.close()

    assert 'CREATE EXTENSION IF NOT EXISTS citext' in on
    assert 'CREATE EXTENSION' not in off, 'script_extensions: false still scripted an extension'
    # The table is still scripted either way - only the extension is left out
    assert 'app.notes' in off
