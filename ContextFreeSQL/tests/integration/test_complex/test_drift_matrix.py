"""
One drift at a time, so a failure says which kind of change is broken.

tests/test_roundtrip_integration.py drifts a whole database at once, which is good coverage and a poor
diagnosis: when it fails, it says the end state differs, not what caused it. These take the same shape -
build, snapshot, script, drift, run, snapshot, compare - but each scenario changes exactly one thing.

Each runs in a database of its own, created and dropped around it, so nothing is filtered: extra objects
count as extra, the way they do for someone scripting a whole database.
"""
import os
import subprocess
import sys
import uuid
from pathlib import Path

import psycopg2
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from tests.conftest import load_test_config

SCHEMA = 'app'

# The database every scenario starts from: a few types of column, keys, an index, a foreign key, a check,
# a view, a function, a trigger, an enum, and some rows
SOURCE_SQL = f"""
CREATE SCHEMA {SCHEMA};

CREATE TYPE {SCHEMA}.priority AS ENUM ('low', 'normal', 'high');

CREATE TABLE {SCHEMA}.customer (
    id          int PRIMARY KEY,
    name        varchar(50) NOT NULL,
    email       text,
    joined_on   date,
    "MixedCase" text,
    active      boolean DEFAULT true
);

CREATE TABLE {SCHEMA}.ticket (
    id          int PRIMARY KEY,
    customer_id int NOT NULL,
    title       varchar(100) NOT NULL,
    body        text,
    rank        {SCHEMA}.priority NOT NULL,
    amount      numeric(10,2),
    opened_at   timestamptz,
    payload     jsonb,
    title_upper text GENERATED ALWAYS AS (upper(title)) STORED,
    CONSTRAINT fk_ticket_customer FOREIGN KEY (customer_id) REFERENCES {SCHEMA}.customer (id),
    CONSTRAINT ck_ticket_amount CHECK (amount IS NULL OR amount >= 0)
);

CREATE TABLE {SCHEMA}.tag (
    id    int PRIMARY KEY,
    label varchar(20) NOT NULL
);

INSERT INTO {SCHEMA}.tag (id, label) VALUES (1, 'billing'), (2, 'urgent');

CREATE INDEX ix_ticket_customer ON {SCHEMA}.ticket (customer_id);
CREATE UNIQUE INDEX ux_customer_email ON {SCHEMA}.customer (email);

CREATE VIEW {SCHEMA}.open_tickets AS
    SELECT t.id, t.title, c.name FROM {SCHEMA}.ticket t JOIN {SCHEMA}.customer c ON c.id = t.customer_id;

CREATE FUNCTION {SCHEMA}.stamp_opened() RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN NEW.opened_at := COALESCE(NEW.opened_at, now()); RETURN NEW; END
$fn$;

CREATE TRIGGER trg_stamp_opened BEFORE INSERT ON {SCHEMA}.ticket
    FOR EACH ROW EXECUTE FUNCTION {SCHEMA}.stamp_opened();

INSERT INTO {SCHEMA}.customer (id, name, email, joined_on, "MixedCase", active) VALUES
    (1, 'Ada',   'ada@example.com',   '2026-01-05', 'A', true),
    (2, 'Grace', 'grace@example.com', '2026-02-06', 'B', false),
    (3, 'Alan',  NULL,                NULL,          NULL, true);

INSERT INTO {SCHEMA}.ticket (id, customer_id, title, body, rank, amount, opened_at, payload) VALUES
    (10, 1, 'Cannot log in', 'it''s broken', 'high',   12.50, '2026-03-01 09:00:00+00', '{{"a": 1}}'),
    (11, 2, 'Slow report',   NULL,           'normal',  0.00, '2026-03-02 10:00:00+00', NULL),
    (12, 1, 'Typo',          'on the form',  'low',     NULL, '2026-03-03 11:00:00+00', '{{"b": [1, 2]}}');
"""

# name -> the one change made to the target before the script is run against it
SCENARIOS = {
    'column is extra':            f'ALTER TABLE {SCHEMA}.customer ADD COLUMN nickname text',
    'column is missing':          f'ALTER TABLE {SCHEMA}.customer DROP COLUMN email',
    'column type differs':        f'ALTER TABLE {SCHEMA}.customer ALTER COLUMN email TYPE varchar(80)',
    # PostgreSQL will not alter a column a view reads, in either direction, so the drift has to take the
    # view out of the way - and the script has to do the same thing to put the column back
    'column under a view differs': (f'DROP VIEW {SCHEMA}.open_tickets;'
                                   f' ALTER TABLE {SCHEMA}.customer ALTER COLUMN name TYPE varchar(120);'
                                   f' CREATE VIEW {SCHEMA}.open_tickets AS SELECT t.id, t.title, c.name'
                                   f' FROM {SCHEMA}.ticket t JOIN {SCHEMA}.customer c ON c.id = t.customer_id'),
    'column type differs widely': f'ALTER TABLE {SCHEMA}.ticket ALTER COLUMN body TYPE varchar(40)',
    'column became nullable':     f'ALTER TABLE {SCHEMA}.customer ALTER COLUMN name DROP NOT NULL',
    'column became not null':     f'ALTER TABLE {SCHEMA}.ticket ALTER COLUMN opened_at SET NOT NULL',
    'default differs':            f'ALTER TABLE {SCHEMA}.customer ALTER COLUMN active SET DEFAULT false',
    'index is missing':           f'DROP INDEX {SCHEMA}.ix_ticket_customer',
    'index is extra':             f'CREATE INDEX ix_extra ON {SCHEMA}.ticket (title)',
    'unique index is missing':    f'DROP INDEX {SCHEMA}.ux_customer_email',
    'foreign key is missing':     f'ALTER TABLE {SCHEMA}.ticket DROP CONSTRAINT fk_ticket_customer',
    'check is missing':           f'ALTER TABLE {SCHEMA}.ticket DROP CONSTRAINT ck_ticket_amount',
    'check is extra':             f'ALTER TABLE {SCHEMA}.customer ADD CONSTRAINT ck_extra CHECK (id > 0)',
    'table is missing':           f'DROP TABLE {SCHEMA}.tag',
    'table is extra':             f'CREATE TABLE {SCHEMA}.leftover (id int PRIMARY KEY, x text)',
    'view is missing':            f'DROP VIEW {SCHEMA}.open_tickets',
    'view differs':               f'CREATE OR REPLACE VIEW {SCHEMA}.open_tickets AS SELECT t.id, t.title, c.name FROM {SCHEMA}.ticket t JOIN {SCHEMA}.customer c ON c.id = t.customer_id WHERE t.rank = \'high\'',
    'function differs':           f'CREATE OR REPLACE FUNCTION {SCHEMA}.stamp_opened() RETURNS trigger LANGUAGE plpgsql AS $fn$ BEGIN NEW.opened_at := \'epoch\'; RETURN NEW; END $fn$',
    'trigger is missing':         f'DROP TRIGGER trg_stamp_opened ON {SCHEMA}.ticket',
    'generated column is missing': f'ALTER TABLE {SCHEMA}.ticket DROP COLUMN title_upper',
    'row is missing':             f'DELETE FROM {SCHEMA}.ticket WHERE id = 11',
    'row is extra':               f"INSERT INTO {SCHEMA}.customer (id, name, email) VALUES (99, 'Extra', 'extra@example.com')",
    'value differs':              f"UPDATE {SCHEMA}.customer SET name = 'Changed', active = false WHERE id = 1",
    'value became null':          f'UPDATE {SCHEMA}.ticket SET body = NULL WHERE id = 10',
    'mixed case value differs':   f"UPDATE {SCHEMA}.customer SET \"MixedCase\" = 'zz' WHERE id = 1",
}

# Known gaps, documented in docs/TODO.md and README's limits. They are listed rather than left out, so the
# matrix says what is not handled instead of quietly not asking
EXPECTED_GAPS = {
    'default differs': 'column defaults are not compared on PostgreSQL',
}


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


def snapshot(conn):
    """A canonical description of the schema and its rows, as sorted lines of text."""
    lines = []
    with conn.cursor() as cur:
        cur.execute("""
            SELECT 'column ' || c.table_name || '.' || c.column_name || ' ' || c.udt_name
                   || '(' || COALESCE(c.character_maximum_length::text, c.numeric_precision::text, '-')
                   || ',' || COALESCE(c.numeric_scale::text, '-') || ')'
                   || ' null=' || c.is_nullable || ' default=' || COALESCE(c.column_default, '-')
                   || ' generated=' || c.is_generated
            FROM information_schema.columns c WHERE c.table_schema = %s ORDER BY 1""", (SCHEMA,))
        lines += [r[0] for r in cur.fetchall()]

        cur.execute("SELECT 'index ' || indexdef FROM pg_indexes WHERE schemaname = %s ORDER BY 1", (SCHEMA,))
        lines += [r[0] for r in cur.fetchall()]

        cur.execute("""
            SELECT 'constraint ' || con.conname || ' ' || pg_get_constraintdef(con.oid)
            FROM pg_constraint con JOIN pg_namespace n ON n.oid = con.connamespace
            WHERE n.nspname = %s ORDER BY 1""", (SCHEMA,))
        lines += [r[0] for r in cur.fetchall()]

        cur.execute("""
            SELECT 'trigger ' || pg_get_triggerdef(tg.oid) FROM pg_trigger tg
            JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = %s AND NOT tg.tgisinternal ORDER BY 1""", (SCHEMA,))
        lines += [r[0] for r in cur.fetchall()]

        cur.execute("""
            SELECT 'view ' || table_name || ' ' || view_definition
            FROM information_schema.views WHERE table_schema = %s ORDER BY 1""", (SCHEMA,))
        lines += [' '.join(r[0].split()) for r in cur.fetchall()]

        cur.execute("""
            SELECT 'function ' || p.proname || ' ' || pg_get_functiondef(p.oid)
            FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = %s ORDER BY 1""", (SCHEMA,))
        lines += [' '.join(r[0].split()) for r in cur.fetchall()]

        cur.execute("""
            SELECT 'type ' || t.typname || ' ' || string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder)
            FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = %s GROUP BY t.typname ORDER BY 1""", (SCHEMA,))
        lines += [r[0] for r in cur.fetchall()]

        # Rows, as text, so a changed value shows up as a difference
        cur.execute("""SELECT table_name FROM information_schema.tables
                       WHERE table_schema = %s AND table_type = 'BASE TABLE' ORDER BY 1""", (SCHEMA,))
        for (table,) in cur.fetchall():
            cur.execute(f'SELECT * FROM {SCHEMA}."{table}" ORDER BY 1')
            names = [d[0] for d in cur.description]
            for row in cur.fetchall():
                # By name, not position: a column dropped and put back lands at the end of the table, and
                # PostgreSQL has no way to move it, so its place is not something the script can restore
                values = sorted(f'{n}=' + ('<null>' if v is None else str(v)) for n, v in zip(names, row))
                lines.append(f'row {table} ' + '|'.join(values))

    return lines


def generate_script(db_name, work_dir):
    """Run the tool over the whole scratch database and return the script it wrote."""
    import json
    cfg = load_test_config()
    project = Path(__file__).parent.parent.parent.parent
    out_sql = os.path.join(work_dir, 'drift.sql')
    config = {
        'database': {'host': cfg.host, 'db_name': db_name, 'user': cfg.user,
                     'password': cfg.password, 'port': cfg.port},
        'scripting_options': {'remove_all_extra_ents': True, 'script_security': False,
                              'all_schemas': True, 'data_scripting_generate_dml_statements': False},
        'table_script_ops': {'column_identity': True, 'indexes': True, 'foreign_keys': True,
                             'defaults': True, 'check_constraints': True},
        'db_ents_to_load': {'tables': [], 'schemas': []},
        'tables_data': {'tables': [], 'schemas': [], 'from_file': False, 'max_rows_per_table': 0,
                        'script_data': True, 'max_rows_per_table_retain_fk_integrity': False},
        'input_output': {'html_template_path': '', 'html_output_path': os.path.join(work_dir, 'r.html'),
                         'diff_template_path': '', 'diff_output_dir': work_dir, 'output_sql': out_sql},
        'sql_script_params': {'print': False, 'print_exec': False, 'exec_code': True,
                              'html_report': False, 'export_csv': False},
    }
    config_path = os.path.join(work_dir, 'config.json')
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config, f)

    result = subprocess.run([sys.executable, '-m', 'src.main', config_path],
                            capture_output=True, text=True, cwd=str(project))
    assert result.returncode == 0, f'generating failed: {result.stderr[-2000:]}'
    with open(out_sql, encoding='utf-8') as f:
        return f.read()


@pytest.mark.complex
@pytest.mark.slow
@pytest.mark.parametrize('scenario', list(SCENARIOS.keys()))
def test_one_drift_at_a_time(scenario, tmp_path):
    """Build, snapshot, script, drift one thing, run the script, and expect the snapshot back."""
    drift_sql = SCENARIOS[scenario]
    db_name = 'cfs_drift_' + uuid.uuid4().hex[:8]

    admin = admin_connection()
    run_sql(admin, f'CREATE DATABASE {db_name}')
    try:
        conn = db_connection(db_name)
        try:
            run_sql(conn, SOURCE_SQL)
            before = snapshot(conn)

            script = generate_script(db_name, str(tmp_path))

            run_sql(conn, drift_sql)
            drifted = snapshot(conn)
            assert drifted != before, 'the drift changed nothing - the scenario is not testing anything'

            with conn.cursor() as cur:
                cur.execute(script)

            after = snapshot(conn)
        finally:
            conn.close()
    finally:
        run_sql(admin, f'DROP DATABASE IF EXISTS {db_name} WITH (FORCE)')
        admin.close()

    missing = [line for line in before if line not in after]
    extra = [line for line in after if line not in before]

    if scenario in EXPECTED_GAPS and (missing or extra):
        pytest.xfail(f'{scenario}: {EXPECTED_GAPS[scenario]}')

    assert not missing and not extra, (
        f'after running the script the database still differs\n'
        f'  missing: {missing[:6]}\n'
        f'  extra:   {extra[:6]}'
    )
