"""
Database helper utilities for integration tests.
Provides functions for executing SQL, checking object existence, and cleanup.
"""
import psycopg2
from typing import Any, Dict, List, Optional, Tuple


def execute_sql(conn, sql: str, params: tuple = None) -> Optional[List[Tuple]]:
    """Execute a single SQL statement and return results if any."""
    with conn.cursor() as cur:
        cur.execute(sql, params)
        if cur.description:
            return cur.fetchall()
        return None


def execute_script(conn, script: str) -> None:
    """Execute a multi-statement SQL script (like generated DO $$ blocks)."""
    with conn.cursor() as cur:
        cur.execute(script)


def table_exists(conn, schema: str, table_name: str) -> bool:
    """Check if a table exists in the database."""
    sql = """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = %s AND table_name = %s
        )
    """
    result = execute_sql(conn, sql, (schema, table_name))
    return result[0][0] if result else False


def column_exists(conn, schema: str, table_name: str, column_name: str) -> bool:
    """Check if a column exists in a table."""
    sql = """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s AND column_name = %s
        )
    """
    result = execute_sql(conn, sql, (schema, table_name, column_name))
    return result[0][0] if result else False


def get_column_info(conn, schema: str, table_name: str, column_name: str) -> Optional[Dict]:
    """Get detailed information about a column."""
    sql = """
        SELECT
            column_name,
            data_type,
            character_maximum_length,
            is_nullable,
            column_default,
            udt_name
        FROM information_schema.columns
        WHERE table_schema = %s AND table_name = %s AND column_name = %s
    """
    result = execute_sql(conn, sql, (schema, table_name, column_name))
    if result:
        row = result[0]
        return {
            'column_name': row[0],
            'data_type': row[1],
            'character_maximum_length': row[2],
            'is_nullable': row[3] == 'YES',
            'column_default': row[4],
            'udt_name': row[5]
        }
    return None


def index_exists(conn, schema: str, table_name: str, index_name: str) -> bool:
    """Check if an index exists on a table."""
    sql = """
        SELECT EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE schemaname = %s AND tablename = %s AND indexname = %s
        )
    """
    result = execute_sql(conn, sql, (schema, table_name, index_name))
    return result[0][0] if result else False


def get_index_info(conn, schema: str, index_name: str) -> Optional[Dict]:
    """Get detailed information about an index."""
    sql = """
        SELECT
            schemaname,
            tablename,
            indexname,
            indexdef
        FROM pg_indexes
        WHERE schemaname = %s AND indexname = %s
    """
    result = execute_sql(conn, sql, (schema, index_name))
    if result:
        row = result[0]
        return {
            'schema': row[0],
            'table_name': row[1],
            'index_name': row[2],
            'index_def': row[3]
        }
    return None


def fk_exists(conn, schema: str, constraint_name: str) -> bool:
    """Check if a foreign key constraint exists."""
    sql = """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_schema = %s
            AND constraint_name = %s
            AND constraint_type = 'FOREIGN KEY'
        )
    """
    result = execute_sql(conn, sql, (schema, constraint_name))
    return result[0][0] if result else False


def pk_exists(conn, schema: str, table_name: str) -> bool:
    """Check if a primary key exists on a table."""
    sql = """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_schema = %s
            AND table_name = %s
            AND constraint_type = 'PRIMARY KEY'
        )
    """
    result = execute_sql(conn, sql, (schema, table_name))
    return result[0][0] if result else False


def get_pk_columns(conn, schema: str, table_name: str) -> List[str]:
    """Get the columns that make up the primary key."""
    sql = """
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_schema = %s
            AND tc.table_name = %s
        ORDER BY kcu.ordinal_position
    """
    result = execute_sql(conn, sql, (schema, table_name))
    return [row[0] for row in result] if result else []


def role_exists(conn, role_name: str) -> bool:
    """Check if a role exists in the database."""
    sql = "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = %s)"
    result = execute_sql(conn, sql, (role_name,))
    return result[0][0] if result else False


def get_role_attributes(conn, role_name: str) -> Optional[Dict]:
    """Get role attributes."""
    sql = """
        SELECT
            rolname,
            rolsuper,
            rolinherit,
            rolcreaterole,
            rolcreatedb,
            rolcanlogin,
            rolreplication,
            rolconnlimit,
            rolbypassrls
        FROM pg_roles
        WHERE rolname = %s
    """
    result = execute_sql(conn, sql, (role_name,))
    if result:
        row = result[0]
        return {
            'rolname': row[0],
            'rolsuper': row[1],
            'rolinherit': row[2],
            'rolcreaterole': row[3],
            'rolcreatedb': row[4],
            'rolcanlogin': row[5],
            'rolreplication': row[6],
            'rolconnlimit': row[7],
            'rolbypassrls': row[8]
        }
    return None


def has_table_privilege(conn, role_name: str, schema: str, table_name: str, privilege: str) -> bool:
    """Check if a role has a specific privilege on a table."""
    sql = """
        SELECT has_table_privilege(%s, %s || '.' || %s, %s)
    """
    result = execute_sql(conn, sql, (role_name, schema, table_name, privilege))
    return result[0][0] if result else False


def has_column_privilege(conn, role_name: str, schema: str, table_name: str,
                         column_name: str, privilege: str) -> bool:
    """Check if a role has a specific privilege on a column."""
    sql = """
        SELECT has_column_privilege(%s, %s || '.' || %s, %s, %s)
    """
    result = execute_sql(conn, sql, (role_name, schema, table_name, column_name, privilege))
    return result[0][0] if result else False


def rls_policy_exists(conn, schema: str, table_name: str, policy_name: str) -> bool:
    """Check if an RLS policy exists on a table."""
    sql = """
        SELECT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = %s AND tablename = %s AND policyname = %s
        )
    """
    result = execute_sql(conn, sql, (schema, table_name, policy_name))
    return result[0][0] if result else False


def function_exists(conn, schema: str, function_name: str, arg_types: str = None) -> bool:
    """Check if a function/procedure exists."""
    if arg_types:
        sql = """
            SELECT EXISTS (
                SELECT 1 FROM pg_proc p
                JOIN pg_namespace n ON p.pronamespace = n.oid
                WHERE n.nspname = %s AND p.proname = %s
                AND pg_get_function_identity_arguments(p.oid) = %s
            )
        """
        result = execute_sql(conn, sql, (schema, function_name, arg_types))
    else:
        sql = """
            SELECT EXISTS (
                SELECT 1 FROM pg_proc p
                JOIN pg_namespace n ON p.pronamespace = n.oid
                WHERE n.nspname = %s AND p.proname = %s
            )
        """
        result = execute_sql(conn, sql, (schema, function_name))
    return result[0][0] if result else False


def view_exists(conn, schema: str, view_name: str) -> bool:
    """Check if a view exists."""
    sql = """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.views
            WHERE table_schema = %s AND table_name = %s
        )
    """
    result = execute_sql(conn, sql, (schema, view_name))
    return result[0][0] if result else False


def get_row_count(conn, schema: str, table_name: str) -> int:
    """Get the number of rows in a table."""
    sql = f'SELECT COUNT(*) FROM "{schema}"."{table_name}"'
    result = execute_sql(conn, sql)
    return result[0][0] if result else 0


def get_table_data(conn, schema: str, table_name: str, order_by: str = None) -> List[Dict]:
    """Get all data from a table as a list of dictionaries."""
    sql = f'SELECT * FROM "{schema}"."{table_name}"'
    if order_by:
        sql += f' ORDER BY {order_by}'

    with conn.cursor() as cur:
        cur.execute(sql)
        columns = [desc[0] for desc in cur.description]
        rows = cur.fetchall()
        return [dict(zip(columns, row)) for row in rows]


def cleanup_test_objects(conn, prefix: str) -> None:
    """
    Clean up all test objects with the given prefix.
    Drops tables, functions, views, roles created during tests.
    """
    # Drop tables
    sql = """
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_name LIKE %s AND table_type = 'BASE TABLE'
    """
    tables = execute_sql(conn, sql, (f'{prefix}%',))
    if tables:
        for schema, table in tables:
            try:
                execute_sql(conn, f'DROP TABLE IF EXISTS "{schema}"."{table}" CASCADE')
            except Exception:
                pass

    # Drop views
    sql = """
        SELECT table_schema, table_name
        FROM information_schema.views
        WHERE table_name LIKE %s
    """
    views = execute_sql(conn, sql, (f'{prefix}%',))
    if views:
        for schema, view in views:
            try:
                execute_sql(conn, f'DROP VIEW IF EXISTS "{schema}"."{view}" CASCADE')
            except Exception:
                pass

    # Drop functions/procedures
    sql = """
        SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname LIKE %s
    """
    funcs = execute_sql(conn, sql, (f'{prefix}%',))
    if funcs:
        for schema, name, args in funcs:
            try:
                execute_sql(conn, f'DROP FUNCTION IF EXISTS "{schema}"."{name}"({args}) CASCADE')
            except Exception:
                try:
                    execute_sql(conn, f'DROP PROCEDURE IF EXISTS "{schema}"."{name}"({args}) CASCADE')
                except Exception:
                    pass

    # Drop roles
    sql = "SELECT rolname FROM pg_roles WHERE rolname LIKE %s"
    roles = execute_sql(conn, sql, (f'{prefix}%',))
    if roles:
        for (role,) in roles:
            try:
                # Revoke all privileges first
                execute_sql(conn, f'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM "{role}"')
                execute_sql(conn, f'DROP ROLE IF EXISTS "{role}"')
            except Exception:
                pass

    conn.commit()


def drop_table_if_exists(conn, schema: str, table_name: str) -> None:
    """Drop a table if it exists."""
    execute_sql(conn, f'DROP TABLE IF EXISTS "{schema}"."{table_name}" CASCADE')


def drop_function_if_exists(conn, schema: str, function_name: str, args: str = '') -> None:
    """Drop a function if it exists."""
    execute_sql(conn, f'DROP FUNCTION IF EXISTS "{schema}"."{function_name}"({args}) CASCADE')


def drop_view_if_exists(conn, schema: str, view_name: str) -> None:
    """Drop a view if it exists."""
    execute_sql(conn, f'DROP VIEW IF EXISTS "{schema}"."{view_name}" CASCADE')


def drop_role_if_exists(conn, role_name: str) -> None:
    """Drop a role if it exists."""
    try:
        execute_sql(conn, f'DROP ROLE IF EXISTS "{role_name}"')
    except Exception:
        pass
