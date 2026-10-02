"""
scripting_options.script_schemas: whether the script creates and drops the schemas themselves.

It covers the namespaces - CREATE SCHEMA, DROP SCHEMA - and nothing else; a table's own DDL is not
affected. The flag was declared and documented from the start but never read anywhere in generation, so
turning it off did nothing at all.

Wiring it up was not as simple as leaving the block out, which is the reason for the second test here.
The schema block is not self-contained: it writes three END; for the two BEGINs it opens, and the last
one - labelled '--schema code' - actually closes the 'script initialization and execution' block opened
before it. Dropping the block left that unclosed and the script died at the far end with

    ERROR:  syntax error at end of input

pointing at the last line, a couple of thousand lines from the cause. So the test that matters is not
'are the statements gone' but 'does the script still run'.
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

from tests.conftest import load_test_config

PROJECT = Path(__file__).parent.parent.parent.parent

SOURCE_SQL = """
CREATE SCHEMA app;
CREATE TABLE app.t (id int PRIMARY KEY, name text);
INSERT INTO app.t VALUES (1, 'a'), (2, 'b');
"""


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


def generate(db_name, work_dir, script_schemas, exec_code=False):
    cfg = load_test_config()
    out_sql = os.path.join(work_dir, f'schemas_{script_schemas}.sql')
    config = {
        'database': {'host': cfg.host, 'db_name': db_name, 'user': cfg.user,
                     'password': cfg.password, 'port': cfg.port},
        'scripting_options': {'remove_all_extra_ents': True, 'script_security': False,
                              'all_schemas': True, 'script_schemas': script_schemas},
        'table_script_ops': {'column_identity': True, 'indexes': True, 'foreign_keys': True,
                             'defaults': True, 'check_constraints': True},
        'db_ents_to_load': {'tables': [], 'schemas': []},
        'tables_data': {'tables': [], 'schemas': [], 'script_data': True},
        'input_output': {'html_template_path': '', 'html_output_path': os.path.join(work_dir, 'r.html'),
                         'diff_template_path': '', 'diff_output_dir': work_dir, 'output_sql': out_sql},
        'sql_script_params': {'print': False, 'print_exec': True, 'exec_code': exec_code,
                              'html_report': False, 'export_csv': False},
    }
    config_path = os.path.join(work_dir, f'config_{script_schemas}.json')
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config, f)
    result = subprocess.run([sys.executable, '-m', 'src.main', config_path],
                            capture_output=True, text=True, cwd=str(PROJECT))
    assert result.returncode == 0, f'generating failed: {result.stderr[-2000:]}'
    with open(out_sql, encoding='utf-8') as f:
        return f.read()


@pytest.fixture
def source_db():
    name = 'cfs_scf_' + uuid.uuid4().hex[:8]
    admin = admin_connection()
    run_sql(admin, f'CREATE DATABASE {name}')
    conn = db_connection(name)
    try:
        run_sql(conn, SOURCE_SQL)
    finally:
        conn.close()
    yield name
    run_sql(admin, f'DROP DATABASE IF EXISTS {name} WITH (FORCE)')
    admin.close()


@pytest.mark.schema
@pytest.mark.slow
def test_off_leaves_out_the_schema_statements_but_keeps_the_tables(source_db, tmp_path):
    on = generate(source_db, str(tmp_path), True)
    off = generate(source_db, str(tmp_path), False)

    assert 'CREATE SCHEMA' in on, 'the flag on should still script schemas, as it always has'
    assert 'CREATE SCHEMA' not in off, 'script_schemas false still scripted CREATE SCHEMA'
    assert 'DROP SCHEMA' not in off, 'script_schemas false still scripted DROP SCHEMA'
    assert 'ScriptSchemas' not in off, 'the schema state table is still being built'

    # It covers the namespaces only - the tables are not its business
    assert 'CREATE TABLE app.t' in off or 'CREATE TABLE app' in off, (
        'turning off schema scripting also dropped the table DDL, which it should not touch')


@pytest.mark.schema
@pytest.mark.slow
def test_off_still_produces_a_script_that_runs(source_db, tmp_path):
    """
    The one that caught the real problem.

    Leaving the block out unbalanced the whole DO block, because its last END; closes a block opened
    before it. The script still looked right - no schema statements, tables present - and failed at the
    last line with 'syntax error at end of input'.
    """
    generate(source_db, str(tmp_path), False, exec_code=True)
    script = (tmp_path / 'schemas_False.sql').read_text(encoding='utf-8')

    target = 'cfs_scf_t_' + uuid.uuid4().hex[:8]
    admin = admin_connection()
    run_sql(admin, f'CREATE DATABASE {target}')
    try:
        conn = db_connection(target)
        try:
            # The schema has to be there already: that is what the flag means
            run_sql(conn, 'CREATE SCHEMA app')
            with conn.cursor() as cur:
                cur.execute(script)
            with conn.cursor() as cur:
                cur.execute('SELECT count(*) FROM app.t')
                rows = cur.fetchone()[0]
        finally:
            conn.close()
    finally:
        run_sql(admin, f'DROP DATABASE IF EXISTS {target} WITH (FORCE)')
        admin.close()

    assert rows == 2, f'the script ran but did not bring the data: {rows} row(s)'


@pytest.mark.schema
@pytest.mark.slow
def test_off_against_a_target_without_the_schema_says_which_schema(source_db, tmp_path):
    """Nothing can be created in a schema that is not there, and the message should name it."""
    generate(source_db, str(tmp_path), False, exec_code=True)
    script = (tmp_path / 'schemas_False.sql').read_text(encoding='utf-8')

    target = 'cfs_scf_t_' + uuid.uuid4().hex[:8]
    admin = admin_connection()
    run_sql(admin, f'CREATE DATABASE {target}')
    try:
        conn = db_connection(target)
        try:
            with conn.cursor() as cur:
                with pytest.raises(psycopg2.Error) as caught:
                    cur.execute(script)
        finally:
            conn.close()
    finally:
        run_sql(admin, f'DROP DATABASE IF EXISTS {target} WITH (FORCE)')
        admin.close()

    message = str(caught.value)
    assert 'app' in message and 'does not exist' in message, (
        f'the failure should name the missing schema, not be a syntax error: {message}')
    assert 'syntax error' not in message, (
        'the script is structurally broken rather than failing on the missing schema: ' + message)
