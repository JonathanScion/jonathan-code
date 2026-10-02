"""
The comparison must read only the tables being scripted, not the whole catalog.

Every column comparison joins the script's own column list against the database's columns. That second
half used to be unbounded: it read information_schema.columns for every column of every table in the
database, and did it again for each comparison. Scripting two tables out of 1200 took six minutes
before a single row was looked at - auto_explain showed 84 to 87 seconds per statement:

    duration: 83893 ms  update ScriptCols Set max_length_diff = true ...
    duration: 87311 ms  update ScriptCols Set ... scale_db ...

With the filter, the same run takes 6.6 seconds. The 'extra columns' query beside them had always been
filtered this way; these had not.

A timing test would be the obvious way to check this and a bad one - it needs a database with
thousands of tables and would fail on a slow machine for the wrong reason. This asserts the property
instead: no query in the generated script reads the catalog's columns without saying which tables it
wants. That is what makes the cost proportional to what is being scripted.
"""
import json
import os
import re
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
CREATE TABLE app.wanted (id int PRIMARY KEY, name varchar(50), amount numeric(8,2), active boolean);
CREATE TABLE app.ignored (id int PRIMARY KEY, name varchar(99), note text);
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


def generate(db_name, work_dir, only_tables):
    cfg = load_test_config()
    out_sql = os.path.join(work_dir, 'bounded.sql')
    config = {
        'database': {'host': cfg.host, 'db_name': db_name, 'user': cfg.user,
                     'password': cfg.password, 'port': cfg.port},
        'scripting_options': {'remove_all_extra_ents': True, 'script_security': False, 'all_schemas': True},
        'table_script_ops': {'column_identity': True, 'indexes': True, 'foreign_keys': True,
                             'defaults': True, 'check_constraints': True},
        'db_ents_to_load': {'tables': only_tables, 'schemas': []},
        'tables_data': {'tables': [], 'schemas': [], 'script_data': False},
        'input_output': {'html_template_path': '', 'html_output_path': os.path.join(work_dir, 'r.html'),
                         'diff_template_path': '', 'diff_output_dir': work_dir, 'output_sql': out_sql},
        'sql_script_params': {'print': False, 'print_exec': False, 'exec_code': False,
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


def catalog_column_subqueries(script):
    """Every subquery in the script that reads the database's own column list.

    They look like `from information_schema.columns C INNER JOIN information_schema.tables T ... ) DB`,
    so each one is taken from that FROM up to the closing `) DB`, which is the scope its filter has to
    be inside.
    """
    return re.findall(r"from information_schema\.columns C INNER JOIN information_schema\.tables T.*?\) DB",
                      script, re.S | re.I)


@pytest.mark.schema
@pytest.mark.slow
def test_no_comparison_reads_the_whole_catalog(tmp_path):
    db_name = 'cfs_bound_' + uuid.uuid4().hex[:8]
    admin = admin_connection()
    with admin.cursor() as cur:
        cur.execute(f'CREATE DATABASE {db_name}')
    try:
        conn = db_connection(db_name)
        try:
            with conn.cursor() as cur:
                cur.execute(SOURCE_SQL)
        finally:
            conn.close()
        script = generate(db_name, str(tmp_path), ['app.wanted'])
    finally:
        with admin.cursor() as cur:
            cur.execute(f'DROP DATABASE IF EXISTS {db_name} WITH (FORCE)')
        admin.close()

    subqueries = catalog_column_subqueries(script)
    assert subqueries, 'no column comparison was generated, so this proves nothing'

    unbounded = [q for q in subqueries if 'table_name IN (' not in q.replace('C.table_schema || C.table_name IN (',
                                                                            'table_name IN (')]
    assert not unbounded, (
        f'{len(unbounded)} of {len(subqueries)} column comparisons read every column of every table in the '
        f'database instead of only the ones being scripted. On a large database that is minutes per '
        f'statement.\n\nfirst one:\n' + unbounded[0][:400])

    # And the filter has to name the table actually being scripted, not just any table
    assert all('appwanted' in q for q in subqueries), (
        'a comparison is filtered, but not to the table being scripted')
    assert not any('appignored' in q for q in subqueries), (
        'a table that was not asked for is being compared'
    )
