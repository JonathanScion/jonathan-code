"""
Security, end to end: build it, script it, take it all away, run the script, expect it back.

The other tests in this folder exercise pieces through the generator. This one runs the script against a
real database and compares the whole security state, which is how the gaps in it were found: policies were
created without ever enabling row level security, function grants named a function by its information_schema
specific_name ('total_730542') which no GRANT can use, and schema grants and default privileges were read by
queries that could never return a row.
"""
import subprocess
import sys
import uuid
from pathlib import Path

import psycopg2
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from tests.conftest import load_test_config

ROLE_PREFIX = 'cfs_sect_'
GROUP = ROLE_PREFIX + 'group'
APP = ROLE_PREFIX + 'app'
READER = ROLE_PREFIX + 'reader'

SOURCE_SQL = f"""
CREATE SCHEMA app;
CREATE TABLE app.account (id int PRIMARY KEY, owner text, secret text, amount numeric(10,2));
INSERT INTO app.account VALUES (1, '{READER}', 'x', 10.00), (2, 'someone', 'y', 20.00);
CREATE FUNCTION app.total() RETURNS numeric LANGUAGE sql AS 'SELECT sum(amount) FROM app.account';
CREATE FUNCTION app.total(since date) RETURNS numeric LANGUAGE sql AS 'SELECT sum(amount) FROM app.account';

GRANT USAGE ON SCHEMA app TO {GROUP};
GRANT SELECT, INSERT ON app.account TO {APP};
GRANT SELECT (id, owner) ON app.account TO {READER};
GRANT EXECUTE ON FUNCTION app.total() TO {GROUP};
GRANT EXECUTE ON FUNCTION app.total(date) TO {APP};
ALTER TABLE app.account ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_rows ON app.account FOR SELECT TO {READER} USING (owner = current_user);
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT ON TABLES TO {GROUP};
"""

# Everything the source had, taken away - including the group role itself, so CREATE ROLE has to run
WRECK_SQL = f"""
DROP POLICY own_rows ON app.account;
ALTER TABLE app.account DISABLE ROW LEVEL SECURITY;
REVOKE ALL ON app.account FROM {APP};
REVOKE ALL (id, owner) ON app.account FROM {READER};
REVOKE ALL ON FUNCTION app.total() FROM {GROUP};
REVOKE ALL ON FUNCTION app.total(date) FROM {APP};
REVOKE USAGE ON SCHEMA app FROM {GROUP};
ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE SELECT ON TABLES FROM {GROUP};
REVOKE {GROUP} FROM {READER};
ALTER ROLE {APP} NOCREATEDB CONNECTION LIMIT -1;
DROP OWNED BY {GROUP};
"""

SNAPSHOT_SQL = f"""
SELECT 'role ' || rolname || ' login=' || rolcanlogin || ' createdb=' || rolcreatedb
       || ' connlimit=' || rolconnlimit
FROM pg_roles WHERE rolname LIKE '{ROLE_PREFIX}%'
UNION ALL
SELECT 'member ' || r.rolname || ' <- ' || m.rolname
FROM pg_auth_members am JOIN pg_roles r ON r.oid = am.roleid JOIN pg_roles m ON m.oid = am.member
WHERE r.rolname LIKE '{ROLE_PREFIX}%'
UNION ALL
SELECT 'table-grant ' || grantee || ' ' || privilege_type || ' on ' || table_schema || '.' || table_name
FROM information_schema.table_privileges WHERE grantee LIKE '{ROLE_PREFIX}%'
UNION ALL
SELECT 'column-grant ' || grantee || ' ' || privilege_type || ' on ' || table_name || '.' || column_name
FROM information_schema.column_privileges WHERE grantee LIKE '{ROLE_PREFIX}%'
UNION ALL
SELECT 'function-grant ' || g.rolname || ' ' || a.privilege_type || ' on ' || p.proname
       || '(' || pg_get_function_identity_arguments(p.oid) || ')'
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN LATERAL aclexplode(p.proacl) a JOIN pg_roles g ON g.oid = a.grantee
WHERE n.nspname = 'app' AND g.rolname LIKE '{ROLE_PREFIX}%'
UNION ALL
SELECT 'schema-grant ' || n.nspname || ' ' || a.privilege_type || ' to ' || g.rolname
FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl) a JOIN pg_roles g ON g.oid = a.grantee
WHERE g.rolname LIKE '{ROLE_PREFIX}%'
UNION ALL
SELECT 'rls ' || schemaname || '.' || tablename || ' policy ' || policyname || ' cmd=' || cmd
       || ' roles=' || array_to_string(roles, ',') || ' using=' || COALESCE(qual, '-')
FROM pg_policies WHERE schemaname = 'app'
UNION ALL
SELECT 'rls-enabled ' || c.relname || '=' || c.relrowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'app' AND c.relkind = 'r'
UNION ALL
SELECT 'default-priv ' || COALESCE(n.nspname, '-') || ' ' || a.privilege_type || ' to ' || g.rolname
FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
CROSS JOIN LATERAL aclexplode(d.defaclacl) a JOIN pg_roles g ON g.oid = a.grantee
WHERE g.rolname LIKE '{ROLE_PREFIX}%'
ORDER BY 1
"""


def _connect(db_name):
    cfg = load_test_config()
    conn = psycopg2.connect(host=cfg.host, database=db_name, user=cfg.user,
                            password=cfg.password, port=cfg.port)
    conn.autocommit = True
    return conn


def _run(conn, sql):
    with conn.cursor() as cur:
        cur.execute(sql)


def _snapshot(conn):
    with conn.cursor() as cur:
        cur.execute(SNAPSHOT_SQL)
        return sorted(r[0] for r in cur.fetchall())


def _generate(db_name, work_dir):
    import json
    cfg = load_test_config()
    project = Path(__file__).parent.parent.parent.parent
    out_sql = str(Path(work_dir) / 'sec.sql')
    config = {
        'database': {'host': cfg.host, 'db_name': db_name, 'user': cfg.user,
                     'password': cfg.password, 'port': cfg.port},
        'scripting_options': {'remove_all_extra_ents': True, 'script_security': True,
                              'all_schemas': True, 'data_scripting_generate_dml_statements': False},
        'table_script_ops': {'column_identity': True, 'indexes': True, 'foreign_keys': True,
                             'defaults': True, 'check_constraints': True},
        'db_ents_to_load': {'tables': [], 'schemas': []},
        'tables_data': {'tables': [], 'schemas': [], 'from_file': False, 'max_rows_per_table': 0,
                        'script_data': True, 'max_rows_per_table_retain_fk_integrity': False},
        'input_output': {'html_template_path': '', 'html_output_path': str(Path(work_dir) / 'r.html'),
                         'diff_template_path': '', 'diff_output_dir': str(work_dir), 'output_sql': out_sql},
        'sql_script_params': {'print': False, 'print_exec': False, 'exec_code': True,
                              'html_report': False, 'export_csv': False},
    }
    config_path = Path(work_dir) / 'config.json'
    config_path.write_text(json.dumps(config), encoding='utf-8')
    result = subprocess.run([sys.executable, '-m', 'src.main', str(config_path)],
                            capture_output=True, text=True, cwd=str(project))
    assert result.returncode == 0, f'generating failed: {result.stderr[-2000:]}'
    return Path(out_sql).read_text(encoding='utf-8')


@pytest.mark.security
@pytest.mark.slow
def test_security_is_restored(tmp_path):
    """Roles, memberships, grants of every kind, default privileges, RLS and its policies."""
    db_name = 'cfs_sect_' + uuid.uuid4().hex[:8]
    admin = _connect('postgres')
    try:
        for role in (GROUP, APP, READER):
            _run(admin, f'DROP ROLE IF EXISTS {role}')
        _run(admin, f'CREATE ROLE {GROUP} NOLOGIN')
        _run(admin, f'CREATE ROLE {APP} LOGIN CREATEDB CONNECTION LIMIT 5')
        _run(admin, f'CREATE ROLE {READER} LOGIN')
        _run(admin, f'GRANT {GROUP} TO {READER}')
        _run(admin, f'CREATE DATABASE {db_name}')

        conn = _connect(db_name)
        try:
            _run(conn, SOURCE_SQL)
            before = _snapshot(conn)

            script = _generate(db_name, tmp_path)

            _run(conn, WRECK_SQL)
            _run(admin, f'DROP ROLE IF EXISTS {GROUP}')     # the role itself, not just its grants
            wrecked = _snapshot(conn)
            assert wrecked != before, 'the wrecking changed nothing'

            with conn.cursor() as cur:
                cur.execute(script)
            after = _snapshot(conn)

            # A second run has nothing left to do
            with conn.cursor() as cur:
                cur.execute(script)
                settled = [r[0] for r in cur.fetchall() if r[0]]
        finally:
            conn.close()
    finally:
        _run(admin, f'DROP DATABASE IF EXISTS {db_name} WITH (FORCE)')
        for role in (GROUP, APP, READER):
            try:
                _run(admin, f'DROP ROLE IF EXISTS {role}')
            except psycopg2.Error:
                pass
        admin.close()

    missing = [line for line in before if line not in after]
    extra = [line for line in after if line not in before]
    assert not missing and not extra, (
        f'the security state was not restored\n  missing: {missing}\n  extra:   {extra}'
    )
    assert not settled, f'the second run still wanted to change things: {settled[:5]}'
