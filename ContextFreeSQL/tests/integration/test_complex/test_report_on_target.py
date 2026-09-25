"""
--report-on: run the script against a target and write the report here, not on the server.

The report used to be written by the database server (pg_read_file to read the template, COPY TO to write
the page), so it only ever worked against a server sharing your filesystem. Against a managed PostgreSQL
it could not work at all, and the failure was a NOTICE that most clients never show - the run looked
successful and the files were simply absent.

The test that matters is the last one: it runs as a plain, non-superuser role, which is what a managed
server gives you, and expects the report anyway.
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

from src.report_on_target import set_script_flags
from tests.conftest import load_test_config

PROJECT = Path(__file__).parent.parent.parent.parent

SOURCE_SQL = """
CREATE SCHEMA app;
CREATE TABLE app.customer (id int PRIMARY KEY, name varchar(50) NOT NULL, email text);
CREATE TABLE app.ticket (id int PRIMARY KEY, customer_id int NOT NULL, title text,
    CONSTRAINT fk_ticket_customer FOREIGN KEY (customer_id) REFERENCES app.customer (id));
CREATE INDEX ix_ticket_customer ON app.ticket (customer_id);
CREATE VIEW app.open_tickets AS SELECT t.id, c.name FROM app.ticket t JOIN app.customer c ON c.id = t.customer_id;
INSERT INTO app.customer (id, name) VALUES (1, 'Ada'), (2, 'Grace');
"""


def admin_connection():
    cfg = load_test_config()
    conn = psycopg2.connect(host=cfg.host, database='postgres', user=cfg.user,
                            password=cfg.password, port=cfg.port)
    conn.autocommit = True
    return conn


def db_connection(db_name, user=None, password=None):
    cfg = load_test_config()
    conn = psycopg2.connect(host=cfg.host, database=db_name, user=user or cfg.user,
                            password=password if user else cfg.password, port=cfg.port)
    conn.autocommit = True
    return conn


def run_sql(conn, sql):
    with conn.cursor() as cur:
        cur.execute(sql)


def write_configs(work_dir, source_db, target_db, target_user=None, target_password=None):
    """A source config and a target config, the way someone would have them on disk."""
    cfg = load_test_config()
    work = Path(work_dir)
    source = {
        'database': {'host': cfg.host, 'db_name': source_db, 'user': cfg.user,
                     'password': cfg.password, 'port': cfg.port},
        'scripting_options': {'remove_all_extra_ents': True, 'script_security': False, 'all_schemas': True},
        'table_script_ops': {'column_identity': True, 'indexes': True, 'foreign_keys': True,
                             'defaults': True, 'check_constraints': True},
        'db_ents_to_load': {'tables': [], 'schemas': []},
        'tables_data': {'tables': [], 'schemas': [], 'script_data': False},
        'input_output': {'html_template_path': '', 'html_output_path': str(work / 'report.html'),
                         'diff_template_path': '', 'diff_output_dir': str(work),
                         'output_sql': str(work / 'out.sql')},
        'sql_script_params': {'print': False, 'print_exec': True, 'exec_code': False,
                              'html_report': True, 'export_csv': False},
    }
    (work / 'source.json').write_text(json.dumps(source), encoding='utf-8')

    if target_db is not None:
        target = {'database': {'host': cfg.host, 'db_name': target_db,
                               'user': target_user or cfg.user,
                               'password': target_password if target_user else cfg.password,
                               'port': cfg.port}}
        (work / 'target.json').write_text(json.dumps(target), encoding='utf-8')
    return work / 'source.json', work / 'target.json'


def run_tool(*args):
    return subprocess.run([sys.executable, '-m', 'src.main', *[str(a) for a in args]],
                          capture_output=True, text=True, cwd=str(PROJECT))


def test_the_flags_are_set_on_a_copy_not_guessed():
    """set_script_flags matches the header build_script_header writes, and says so when it cannot."""
    header = ("\tDECLARE print boolean := true; -- x\n"
              "\texecCode boolean := true; -- y\n"
              "\thtmlReport boolean := false; -- z\n"
              "\treportToCaller boolean := false; -- w\n")
    changed = set_script_flags(header, execCode=False, htmlReport=True, reportToCaller=True)
    assert 'execCode boolean := false' in changed
    assert 'htmlReport boolean := true' in changed
    assert 'reportToCaller boolean := true' in changed
    assert 'print boolean := true' in changed, 'a flag that was not asked for was changed'

    with pytest.raises(ValueError):
        set_script_flags(header, noSuchFlag=True)


@pytest.mark.complex
@pytest.mark.slow
def test_a_missing_target_config_is_written_as_a_starting_point(tmp_path):
    """Rather than an error about a file the user has never seen the shape of."""
    source_db = 'cfs_rep_s_' + uuid.uuid4().hex[:8]
    admin = admin_connection()
    run_sql(admin, f'CREATE DATABASE {source_db}')
    try:
        source_config, target_config = write_configs(tmp_path, source_db, None)
        assert not target_config.exists()

        result = run_tool(source_config, '--report-on', target_config)

        assert result.returncode != 0, 'it should stop rather than carry on without a target'
        assert target_config.exists(), 'the target config was not written'
        written = json.loads(target_config.read_text(encoding='utf-8'))
        assert written['database']['host'] == load_test_config().host
        assert written['database']['db_name'] == source_db, 'filled in from the source, to be edited'
        assert written['database'].get('password') == '', 'a literal password should not be copied'
        assert 'was no target config' in result.stdout, result.stdout
    finally:
        run_sql(admin, f'DROP DATABASE IF EXISTS {source_db} WITH (FORCE)')
        admin.close()


@pytest.mark.complex
@pytest.mark.slow
def test_the_report_is_written_here_and_the_target_is_untouched(tmp_path):
    source_db = 'cfs_rep_s_' + uuid.uuid4().hex[:8]
    target_db = 'cfs_rep_t_' + uuid.uuid4().hex[:8]
    admin = admin_connection()
    run_sql(admin, f'CREATE DATABASE {source_db}')
    run_sql(admin, f'CREATE DATABASE {target_db}')
    try:
        conn = db_connection(source_db)
        try:
            run_sql(conn, SOURCE_SQL)
        finally:
            conn.close()

        source_config, target_config = write_configs(tmp_path, source_db, target_db)
        result = run_tool(source_config, '--report-on', target_config)
        assert result.returncode == 0, f'{result.stdout}\n{result.stderr}'

        conn = db_connection(target_db)
        try:
            with conn.cursor() as cur:
                cur.execute("""SELECT count(*) FROM information_schema.tables
                               WHERE table_schema NOT IN ('pg_catalog', 'information_schema')""")
                tables_on_target = cur.fetchone()[0]
        finally:
            conn.close()
    finally:
        run_sql(admin, f'DROP DATABASE IF EXISTS {source_db} WITH (FORCE)')
        run_sql(admin, f'DROP DATABASE IF EXISTS {target_db} WITH (FORCE)')
        admin.close()

    assert tables_on_target == 0, 'the target was changed, and a report run must not change anything'

    report = (tmp_path / 'report.html')
    assert report.exists(), f'no report was written:\n{result.stdout}'
    page = report.read_text(encoding='utf-8')
    assert not re.findall(r'\[\[[a-zA-Z]+\]\]', page), 'the template still holds placeholders'

    entries = json.loads(re.search(r'reportData = (\[.*?\]);', page, re.S).group(1))
    names = {e['name'] for e in entries}
    assert {'customer', 'ticket'} <= names, f'the tables are missing from the report: {names}'
    assert all(e['status'] == 'left-only' for e in entries if e['name'] in ('customer', 'ticket')), \
        'an empty target should have every table on one side only'


@pytest.mark.complex
@pytest.mark.slow
def test_the_report_is_written_even_when_the_server_cannot_write_files(tmp_path):
    """
    The whole point of the feature.

    A plain role cannot call pg_read_file or COPY TO, which is what a managed PostgreSQL gives you - and is
    why the report never appeared when the script was run against Azure from a SQL client.
    """
    source_db = 'cfs_rep_s_' + uuid.uuid4().hex[:8]
    target_db = 'cfs_rep_t_' + uuid.uuid4().hex[:8]
    role = 'cfs_rep_plain'
    admin = admin_connection()
    run_sql(admin, f'DROP ROLE IF EXISTS {role}')
    run_sql(admin, f"CREATE ROLE {role} LOGIN PASSWORD 'p'")
    run_sql(admin, f'CREATE DATABASE {source_db}')
    run_sql(admin, f'CREATE DATABASE {target_db}')
    try:
        run_sql(admin, f'GRANT CONNECT ON DATABASE {target_db} TO {role}')
        conn = db_connection(source_db)
        try:
            run_sql(conn, SOURCE_SQL)
        finally:
            conn.close()
        conn = db_connection(target_db)
        try:
            run_sql(conn, f'GRANT USAGE, CREATE ON SCHEMA public TO {role}')
        finally:
            conn.close()

        source_config, target_config = write_configs(tmp_path, source_db, target_db,
                                                     target_user=role, target_password='p')
        result = run_tool(source_config, '--report-on', target_config)
    finally:
        run_sql(admin, f'DROP DATABASE IF EXISTS {source_db} WITH (FORCE)')
        run_sql(admin, f'DROP DATABASE IF EXISTS {target_db} WITH (FORCE)')
        try:
            run_sql(admin, f'DROP ROLE IF EXISTS {role}')
        except psycopg2.Error:
            pass
        admin.close()

    assert result.returncode == 0, f'{result.stdout}\n{result.stderr}'
    report = tmp_path / 'report.html'
    assert report.exists(), (
        'no report, though rendering it here is exactly what this is for:\n' + result.stdout)
    entries = json.loads(re.search(r'reportData = (\[.*?\]);',
                                   report.read_text(encoding='utf-8'), re.S).group(1))
    assert entries, 'the report came out empty'


DIFFERING_TARGET_SQL = """
CREATE SCHEMA app;
CREATE TABLE app.customer (id int PRIMARY KEY, name varchar(120), phone text);
CREATE TABLE app.ticket (id int PRIMARY KEY, customer_id int NOT NULL, title text);
CREATE VIEW app.open_tickets AS SELECT t.id FROM app.ticket t;
"""


@pytest.mark.complex
@pytest.mark.slow
def test_the_diff_pages_are_written_here_too_and_the_report_links_resolve(tmp_path):
    """The report links to a page per differing entity, so those have to be written as well."""
    source_db = 'cfs_rep_s_' + uuid.uuid4().hex[:8]
    target_db = 'cfs_rep_t_' + uuid.uuid4().hex[:8]
    admin = admin_connection()
    run_sql(admin, f'CREATE DATABASE {source_db}')
    run_sql(admin, f'CREATE DATABASE {target_db}')
    try:
        for db, sql in ((source_db, SOURCE_SQL), (target_db, DIFFERING_TARGET_SQL)):
            conn = db_connection(db)
            try:
                run_sql(conn, sql)
            finally:
                conn.close()

        source_config, target_config = write_configs(tmp_path, source_db, target_db)
        result = run_tool(source_config, '--report-on', target_config)
        assert result.returncode == 0, f'{result.stdout}\n{result.stderr}'
    finally:
        run_sql(admin, f'DROP DATABASE IF EXISTS {source_db} WITH (FORCE)')
        run_sql(admin, f'DROP DATABASE IF EXISTS {target_db} WITH (FORCE)')
        admin.close()

    page = (tmp_path / 'report.html').read_text(encoding='utf-8')
    entries = json.loads(re.search(r'reportData = (\[.*?\]);', page, re.S).group(1))

    linked = [e['diffFile'] for e in entries if e.get('diffFile')]
    assert linked, f'nothing was different, so this proves nothing: {[(e["name"], e["status"]) for e in entries]}'

    unresolved = [name for name in linked if not (tmp_path / name).exists()]
    assert not unresolved, f'the report links to pages that were not written: {unresolved}'

    for name in linked:
        diff_page = (tmp_path / name).read_text(encoding='utf-8')
        assert not re.findall(r'\[\[[A-Za-z_]+\]\]', diff_page), f'{name} still holds placeholders'
        assert len(diff_page) > 1000, f'{name} looks empty'


@pytest.mark.complex
@pytest.mark.slow
def test_it_says_when_the_role_cannot_see_the_whole_target(tmp_path):
    """
    A role sees nothing of a table it holds no privilege on, and the comparison then calls that table
    missing. Believing it - and running with execCode on - would try to create what is already there.
    """
    source_db = 'cfs_rep_s_' + uuid.uuid4().hex[:8]
    target_db = 'cfs_rep_t_' + uuid.uuid4().hex[:8]
    role = 'cfs_rep_blind'
    admin = admin_connection()
    run_sql(admin, f'DROP ROLE IF EXISTS {role}')
    run_sql(admin, f"CREATE ROLE {role} LOGIN PASSWORD 'p'")
    run_sql(admin, f'CREATE DATABASE {source_db}')
    run_sql(admin, f'CREATE DATABASE {target_db}')
    try:
        run_sql(admin, f'GRANT CONNECT ON DATABASE {target_db} TO {role}')
        conn = db_connection(source_db)
        try:
            run_sql(conn, SOURCE_SQL)
        finally:
            conn.close()
        conn = db_connection(target_db)
        try:
            # The tables are there, but the role is given no privilege on them
            run_sql(conn, DIFFERING_TARGET_SQL)
            run_sql(conn, f'GRANT USAGE ON SCHEMA app TO {role}')
            run_sql(conn, f'GRANT USAGE, CREATE ON SCHEMA public TO {role}')
        finally:
            conn.close()

        source_config, target_config = write_configs(tmp_path, source_db, target_db,
                                                     target_user=role, target_password='p')
        result = run_tool(source_config, '--report-on', target_config)
    finally:
        run_sql(admin, f'DROP DATABASE IF EXISTS {source_db} WITH (FORCE)')
        run_sql(admin, f'DROP DATABASE IF EXISTS {target_db} WITH (FORCE)')
        try:
            run_sql(admin, f'DROP ROLE IF EXISTS {role}')
        except psycopg2.Error:
            pass
        admin.close()

    assert result.returncode == 0, f'{result.stdout}\n{result.stderr}'
    assert 'can see 0 of the' in result.stdout, (
        'a role that can see none of the target was not warned about:\n' + result.stdout)
    assert 'reported as missing' in result.stdout
