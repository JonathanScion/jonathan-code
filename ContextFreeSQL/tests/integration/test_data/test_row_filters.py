"""
tables_data.where: script an area of a database rather than whole tables.

Give a table a SQL condition and only those rows are scripted; the foreign keys are then followed down to
the rows that belong to them (a student's grades, those grades' comments) and up to the rows they need (the
grades' courses, the courses' teachers). What the walk never reaches is not scripted at all.

The dangerous half is what happens to everything else. A window means the script must leave rows outside it
alone - scripting 'studentid = 1' with the usual behaviour would delete every other student on the target -
so a filter turns scripting_options.data_window_only on by itself. The test that matters most here is
test_rows_outside_the_window_survive.
"""
import json
import subprocess
import sys
import uuid
from pathlib import Path

import psycopg2
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from tests.conftest import load_test_config

PROJECT = Path(__file__).parent.parent.parent.parent

# students -> grades -> comments going down; grades -> courses -> teachers going up. Course 12 and teacher 3
# belong to nobody in the window, and are how we tell a walk that follows the keys from one that takes the lot
SCHEMA_SQL = """
CREATE SCHEMA sch;
CREATE TABLE sch.teachers (id int PRIMARY KEY, name text);
CREATE TABLE sch.courses  (id int PRIMARY KEY, title text, teacher_id int REFERENCES sch.teachers(id));
CREATE TABLE sch.students (id int PRIMARY KEY, name text);
CREATE TABLE sch.grades   (id int PRIMARY KEY, student_id int REFERENCES sch.students(id),
                           course_id int REFERENCES sch.courses(id), mark int);
CREATE TABLE sch.comments (id int PRIMARY KEY, grade_id int REFERENCES sch.grades(id), note text);
"""

SOURCE_ROWS_SQL = """
INSERT INTO sch.teachers VALUES (1,'Turing'),(2,'Lovelace'),(3,'Unrelated');
INSERT INTO sch.courses  VALUES (10,'Maths',1),(11,'Logic',2),(12,'Nobody',3);
INSERT INTO sch.students VALUES (1,'Ada'),(2,'Grace'),(3,'Alan');
INSERT INTO sch.grades   VALUES (100,1,10,90),(101,1,11,80),(102,2,10,70),(103,3,12,60);
INSERT INTO sch.comments VALUES (1000,100,'good'),(1001,102,'other student');
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


def write_config(work_dir, db_name, where, exec_code=False, **tables_data):
    cfg = load_test_config()
    work = Path(work_dir)
    config = {
        'database': {'host': cfg.host, 'db_name': db_name, 'user': cfg.user,
                     'password': cfg.password, 'port': cfg.port},
        'scripting_options': {'remove_all_extra_ents': True, 'script_security': False, 'all_schemas': True},
        'table_script_ops': {'column_identity': True, 'indexes': True, 'foreign_keys': True,
                             'defaults': True, 'check_constraints': True},
        'db_ents_to_load': {'tables': [], 'schemas': []},
        'tables_data': {'tables': [], 'schemas': ['sch'], 'script_data': True, 'where': where,
                        **tables_data},
        'input_output': {'html_template_path': '', 'html_output_path': str(work / 'r.html'),
                         'diff_template_path': '', 'diff_output_dir': str(work),
                         'output_sql': str(work / 'w.sql')},
        'sql_script_params': {'print': False, 'print_exec': False, 'exec_code': exec_code,
                              'html_report': False, 'export_csv': False},
    }
    path = work / 'config.json'
    path.write_text(json.dumps(config), encoding='utf-8')
    return path


def run_tool(config_path):
    return subprocess.run([sys.executable, '-m', 'src.main', str(config_path)],
                          capture_output=True, text=True, cwd=str(PROJECT))


def scripted_ids(sql_text, table):
    """The first column of every row the script carries for that table.

    The rows go into the temp table the comparison uses - sch_grades, not sch.grades - and every value is
    quoted. The name with a dot appears too, inside the commented-out DML the script prints, which is not
    what is being asked about here.
    """
    import re
    block = re.search(rf"INSERT INTO sch_{table} \([^)]*\)\s*VALUES(.*?);", sql_text, re.S)
    if not block:
        return []
    return [int(v) for v in re.findall(r"^\s*\('(\d+)'", block.group(1), re.M)]


@pytest.fixture
def source_db():
    name = 'cfs_win_s_' + uuid.uuid4().hex[:8]
    admin = admin_connection()
    run_sql(admin, f'CREATE DATABASE {name}')
    conn = db_connection(name)
    try:
        run_sql(conn, SCHEMA_SQL)
        run_sql(conn, SOURCE_ROWS_SQL)
    finally:
        conn.close()
    yield name
    run_sql(admin, f'DROP DATABASE IF EXISTS {name} WITH (FORCE)')
    admin.close()


@pytest.mark.data
@pytest.mark.slow
def test_a_filter_scripts_its_rows_and_what_the_keys_reach(source_db, tmp_path):
    """Student 1, their grades and comments, and the courses and teachers those grades need - nothing else."""
    config = write_config(tmp_path, source_db, {'sch.students': 'id = 1'})
    result = run_tool(config)
    assert result.returncode == 0, f'{result.stdout}\n{result.stderr}'

    sql = (tmp_path / 'w.sql').read_text(encoding='utf-8')
    assert scripted_ids(sql, 'students') == [1], 'the filter did not narrow the seed table'
    assert sorted(scripted_ids(sql, 'grades')) == [100, 101], "the student's grades were not followed down"
    assert scripted_ids(sql, 'comments') == [1000], 'a grandchild was not reached'
    assert sorted(scripted_ids(sql, 'courses')) == [10, 11], 'the grades needed their courses'
    assert sorted(scripted_ids(sql, 'teachers')) == [1, 2], 'the courses needed their teachers'

    # The point of following the keys rather than taking the lot
    assert 12 not in scripted_ids(sql, 'courses'), 'a course nothing in the window points at was scripted'
    assert 3 not in scripted_ids(sql, 'teachers'), 'an unrelated teacher was scripted'
    assert 1001 not in scripted_ids(sql, 'comments'), "another student's comment was scripted"


@pytest.mark.data
@pytest.mark.slow
def test_a_filter_turns_the_data_window_on_by_itself(source_db, tmp_path):
    """Without it the script deletes every target row it does not carry, which is the whole table but one."""
    config = write_config(tmp_path, source_db, {'sch.students': 'id = 1'})
    result = run_tool(config)
    assert result.returncode == 0
    assert 'data_window_only has been turned on' in result.stdout, result.stdout


@pytest.mark.data
@pytest.mark.slow
def test_rows_outside_the_window_survive(source_db, tmp_path):
    """
    The one that matters. Run the script against a populated target and everything outside the window has
    to be exactly as it was, while the window itself is brought up to date.
    """
    target = 'cfs_win_t_' + uuid.uuid4().hex[:8]
    admin = admin_connection()
    run_sql(admin, f'CREATE DATABASE {target}')
    try:
        conn = db_connection(target)
        try:
            run_sql(conn, SCHEMA_SQL)
            run_sql(conn, """
                INSERT INTO sch.teachers VALUES (1,'Turing'),(2,'Lovelace'),(3,'Unrelated');
                INSERT INTO sch.courses  VALUES (10,'Maths',1),(11,'Logic',2),(12,'Nobody',3);
                INSERT INTO sch.students VALUES (1,'STALE NAME'),(2,'Grace'),(3,'Alan');
                INSERT INTO sch.grades   VALUES (100,1,10,0),(102,2,10,70),(103,3,12,60);
            """)
        finally:
            conn.close()

        config = write_config(tmp_path, source_db, {'sch.students': 'id = 1'}, exec_code=True)
        assert run_tool(config).returncode == 0

        conn = db_connection(target)
        try:
            with conn.cursor() as cur:
                cur.execute((tmp_path / 'w.sql').read_text(encoding='utf-8'))
            with conn.cursor() as cur:
                cur.execute('SELECT id, name FROM sch.students ORDER BY id')
                students = cur.fetchall()
                cur.execute('SELECT id, mark FROM sch.grades ORDER BY id')
                grades = cur.fetchall()
        finally:
            conn.close()
    finally:
        run_sql(admin, f'DROP DATABASE IF EXISTS {target} WITH (FORCE)')
        admin.close()

    assert students == [(1, 'Ada'), (2, 'Grace'), (3, 'Alan')], (
        f'a row outside the window was changed or deleted: {students}')
    assert grades == [(100, 90), (101, 80), (102, 70), (103, 60)], (
        f'grades outside the window were not left alone, or the window was not applied: {grades}')


@pytest.mark.data
@pytest.mark.slow
def test_a_filter_the_server_rejects_stops_the_run(source_db, tmp_path):
    """Carrying on would script the whole table instead, which is the opposite of what was asked."""
    config = write_config(tmp_path, source_db, {'sch.students': 'no_such_column = 1'})
    result = run_tool(config)
    output = result.stdout + result.stderr
    assert result.returncode != 0, 'a filter the server rejected did not stop the run'
    assert 'sch.students' in output and 'no_such_column' in output, output
    assert 'Traceback' not in output, f'a traceback reached the user:\n{output}'


@pytest.mark.data
@pytest.mark.slow
def test_a_filter_on_a_table_that_is_not_scripted_says_so(source_db, tmp_path):
    """Otherwise it silently does nothing, and the rows come out wrong with no clue why."""
    config = write_config(tmp_path, source_db, {'sch.students': 'id = 1', 'other.nothing': 'id = 1'})
    result = run_tool(config)
    assert result.returncode == 0, f'{result.stdout}\n{result.stderr}'
    assert 'other.nothing' in result.stdout and 'does nothing' in result.stdout, result.stdout


@pytest.mark.data
@pytest.mark.slow
def test_following_related_rows_can_be_turned_off(source_db, tmp_path):
    """Then only the filtered rows are scripted, and the foreign keys are the caller's problem."""
    config = write_config(tmp_path, source_db, {'sch.students': 'id = 1'}, follow_related_rows=False)
    result = run_tool(config)
    assert result.returncode == 0, f'{result.stdout}\n{result.stderr}'

    sql = (tmp_path / 'w.sql').read_text(encoding='utf-8')
    assert scripted_ids(sql, 'students') == [1]
    assert not scripted_ids(sql, 'grades'), 'children were followed with follow_related_rows off'
