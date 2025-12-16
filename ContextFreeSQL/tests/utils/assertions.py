"""
Custom assertion helpers for integration tests.
Provides domain-specific assertions for schema, security, and data verification.
"""
from typing import Any, Dict, List, Optional
from . import db_helpers


class SchemaAssertions:
    """Assertions for database schema verification."""

    def __init__(self, conn):
        self.conn = conn

    def assert_table_exists(self, schema: str, table_name: str, msg: str = None):
        """Assert that a table exists."""
        exists = db_helpers.table_exists(self.conn, schema, table_name)
        assert exists, msg or f"Table {schema}.{table_name} should exist"

    def assert_table_not_exists(self, schema: str, table_name: str, msg: str = None):
        """Assert that a table does not exist."""
        exists = db_helpers.table_exists(self.conn, schema, table_name)
        assert not exists, msg or f"Table {schema}.{table_name} should not exist"

    def assert_column_exists(self, schema: str, table_name: str, column_name: str, msg: str = None):
        """Assert that a column exists in a table."""
        exists = db_helpers.column_exists(self.conn, schema, table_name, column_name)
        assert exists, msg or f"Column {column_name} should exist in {schema}.{table_name}"

    def assert_column_not_exists(self, schema: str, table_name: str, column_name: str, msg: str = None):
        """Assert that a column does not exist in a table."""
        exists = db_helpers.column_exists(self.conn, schema, table_name, column_name)
        assert not exists, msg or f"Column {column_name} should not exist in {schema}.{table_name}"

    def assert_column_type(self, schema: str, table_name: str, column_name: str,
                          expected_type: str, msg: str = None):
        """Assert that a column has a specific data type."""
        info = db_helpers.get_column_info(self.conn, schema, table_name, column_name)
        assert info is not None, f"Column {column_name} not found in {schema}.{table_name}"
        # Handle both data_type and udt_name for type checking
        actual_type = info['data_type'].lower()
        udt_name = info['udt_name'].lower() if info['udt_name'] else ''
        expected_lower = expected_type.lower()
        matches = (expected_lower in actual_type or
                   expected_lower in udt_name or
                   actual_type in expected_lower)
        assert matches, msg or f"Column {column_name} type: expected {expected_type}, got {actual_type}"

    def assert_column_nullable(self, schema: str, table_name: str, column_name: str,
                               expected_nullable: bool, msg: str = None):
        """Assert that a column has the expected nullability."""
        info = db_helpers.get_column_info(self.conn, schema, table_name, column_name)
        assert info is not None, f"Column {column_name} not found in {schema}.{table_name}"
        assert info['is_nullable'] == expected_nullable, \
            msg or f"Column {column_name} nullable: expected {expected_nullable}, got {info['is_nullable']}"

    def assert_column_default(self, schema: str, table_name: str, column_name: str,
                              expected_default: str, msg: str = None):
        """Assert that a column has a specific default value."""
        info = db_helpers.get_column_info(self.conn, schema, table_name, column_name)
        assert info is not None, f"Column {column_name} not found in {schema}.{table_name}"
        actual_default = info['column_default']
        if expected_default is None:
            assert actual_default is None, \
                msg or f"Column {column_name} default: expected None, got {actual_default}"
        else:
            assert actual_default is not None and expected_default in actual_default, \
                msg or f"Column {column_name} default: expected {expected_default}, got {actual_default}"

    def assert_index_exists(self, schema: str, table_name: str, index_name: str, msg: str = None):
        """Assert that an index exists on a table."""
        exists = db_helpers.index_exists(self.conn, schema, table_name, index_name)
        assert exists, msg or f"Index {index_name} should exist on {schema}.{table_name}"

    def assert_index_not_exists(self, schema: str, table_name: str, index_name: str, msg: str = None):
        """Assert that an index does not exist on a table."""
        exists = db_helpers.index_exists(self.conn, schema, table_name, index_name)
        assert not exists, msg or f"Index {index_name} should not exist on {schema}.{table_name}"

    def assert_pk_exists(self, schema: str, table_name: str, msg: str = None):
        """Assert that a primary key exists on a table."""
        exists = db_helpers.pk_exists(self.conn, schema, table_name)
        assert exists, msg or f"Primary key should exist on {schema}.{table_name}"

    def assert_pk_columns(self, schema: str, table_name: str, expected_columns: List[str], msg: str = None):
        """Assert that a primary key has specific columns."""
        columns = db_helpers.get_pk_columns(self.conn, schema, table_name)
        assert columns == expected_columns, \
            msg or f"PK columns: expected {expected_columns}, got {columns}"

    def assert_fk_exists(self, schema: str, constraint_name: str, msg: str = None):
        """Assert that a foreign key constraint exists."""
        exists = db_helpers.fk_exists(self.conn, schema, constraint_name)
        assert exists, msg or f"Foreign key {constraint_name} should exist in {schema}"

    def assert_fk_not_exists(self, schema: str, constraint_name: str, msg: str = None):
        """Assert that a foreign key constraint does not exist."""
        exists = db_helpers.fk_exists(self.conn, schema, constraint_name)
        assert not exists, msg or f"Foreign key {constraint_name} should not exist in {schema}"

    def assert_function_exists(self, schema: str, function_name: str,
                               arg_types: str = None, msg: str = None):
        """Assert that a function/procedure exists."""
        exists = db_helpers.function_exists(self.conn, schema, function_name, arg_types)
        assert exists, msg or f"Function {schema}.{function_name} should exist"

    def assert_function_not_exists(self, schema: str, function_name: str,
                                   arg_types: str = None, msg: str = None):
        """Assert that a function/procedure does not exist."""
        exists = db_helpers.function_exists(self.conn, schema, function_name, arg_types)
        assert not exists, msg or f"Function {schema}.{function_name} should not exist"

    def assert_view_exists(self, schema: str, view_name: str, msg: str = None):
        """Assert that a view exists."""
        exists = db_helpers.view_exists(self.conn, schema, view_name)
        assert exists, msg or f"View {schema}.{view_name} should exist"

    def assert_view_not_exists(self, schema: str, view_name: str, msg: str = None):
        """Assert that a view does not exist."""
        exists = db_helpers.view_exists(self.conn, schema, view_name)
        assert not exists, msg or f"View {schema}.{view_name} should not exist"


class SecurityAssertions:
    """Assertions for database security verification."""

    def __init__(self, conn):
        self.conn = conn

    def assert_role_exists(self, role_name: str, msg: str = None):
        """Assert that a role exists."""
        exists = db_helpers.role_exists(self.conn, role_name)
        assert exists, msg or f"Role {role_name} should exist"

    def assert_role_not_exists(self, role_name: str, msg: str = None):
        """Assert that a role does not exist."""
        exists = db_helpers.role_exists(self.conn, role_name)
        assert not exists, msg or f"Role {role_name} should not exist"

    def assert_role_attributes(self, role_name: str, expected_attrs: Dict[str, Any], msg: str = None):
        """Assert that a role has specific attributes."""
        attrs = db_helpers.get_role_attributes(self.conn, role_name)
        assert attrs is not None, f"Role {role_name} not found"
        for key, expected_value in expected_attrs.items():
            actual_value = attrs.get(key)
            assert actual_value == expected_value, \
                msg or f"Role {role_name} attribute {key}: expected {expected_value}, got {actual_value}"

    def assert_table_privilege(self, role_name: str, schema: str, table_name: str,
                               privilege: str, has_privilege: bool = True, msg: str = None):
        """Assert that a role has (or doesn't have) a specific table privilege."""
        actual = db_helpers.has_table_privilege(self.conn, role_name, schema, table_name, privilege)
        if has_privilege:
            assert actual, msg or f"Role {role_name} should have {privilege} on {schema}.{table_name}"
        else:
            assert not actual, msg or f"Role {role_name} should not have {privilege} on {schema}.{table_name}"

    def assert_column_privilege(self, role_name: str, schema: str, table_name: str,
                                column_name: str, privilege: str, has_privilege: bool = True,
                                msg: str = None):
        """Assert that a role has (or doesn't have) a specific column privilege."""
        actual = db_helpers.has_column_privilege(
            self.conn, role_name, schema, table_name, column_name, privilege
        )
        if has_privilege:
            assert actual, \
                msg or f"Role {role_name} should have {privilege} on {schema}.{table_name}.{column_name}"
        else:
            assert not actual, \
                msg or f"Role {role_name} should not have {privilege} on {schema}.{table_name}.{column_name}"

    def assert_rls_policy_exists(self, schema: str, table_name: str, policy_name: str, msg: str = None):
        """Assert that an RLS policy exists."""
        exists = db_helpers.rls_policy_exists(self.conn, schema, table_name, policy_name)
        assert exists, msg or f"RLS policy {policy_name} should exist on {schema}.{table_name}"

    def assert_rls_policy_not_exists(self, schema: str, table_name: str, policy_name: str, msg: str = None):
        """Assert that an RLS policy does not exist."""
        exists = db_helpers.rls_policy_exists(self.conn, schema, table_name, policy_name)
        assert not exists, msg or f"RLS policy {policy_name} should not exist on {schema}.{table_name}"


class DataAssertions:
    """Assertions for database data verification."""

    def __init__(self, conn):
        self.conn = conn

    def assert_row_count(self, schema: str, table_name: str, expected_count: int, msg: str = None):
        """Assert that a table has a specific number of rows."""
        actual_count = db_helpers.get_row_count(self.conn, schema, table_name)
        assert actual_count == expected_count, \
            msg or f"Row count in {schema}.{table_name}: expected {expected_count}, got {actual_count}"

    def assert_row_exists(self, schema: str, table_name: str, conditions: Dict[str, Any], msg: str = None):
        """Assert that a row matching conditions exists."""
        where_clauses = [f'"{k}" = %s' for k in conditions.keys()]
        where_sql = ' AND '.join(where_clauses)
        sql = f'SELECT EXISTS (SELECT 1 FROM "{schema}"."{table_name}" WHERE {where_sql})'
        result = db_helpers.execute_sql(self.conn, sql, tuple(conditions.values()))
        exists = result[0][0] if result else False
        assert exists, msg or f"Row matching {conditions} should exist in {schema}.{table_name}"

    def assert_row_not_exists(self, schema: str, table_name: str, conditions: Dict[str, Any], msg: str = None):
        """Assert that a row matching conditions does not exist."""
        where_clauses = [f'"{k}" = %s' for k in conditions.keys()]
        where_sql = ' AND '.join(where_clauses)
        sql = f'SELECT EXISTS (SELECT 1 FROM "{schema}"."{table_name}" WHERE {where_sql})'
        result = db_helpers.execute_sql(self.conn, sql, tuple(conditions.values()))
        exists = result[0][0] if result else False
        assert not exists, msg or f"Row matching {conditions} should not exist in {schema}.{table_name}"

    def assert_data_matches(self, schema: str, table_name: str, expected_data: List[Dict],
                            order_by: str = None, msg: str = None):
        """Assert that table data matches expected data exactly."""
        actual_data = db_helpers.get_table_data(self.conn, schema, table_name, order_by)
        assert len(actual_data) == len(expected_data), \
            msg or f"Row count mismatch: expected {len(expected_data)}, got {len(actual_data)}"
        for i, (expected, actual) in enumerate(zip(expected_data, actual_data)):
            for key, expected_val in expected.items():
                actual_val = actual.get(key)
                assert actual_val == expected_val, \
                    msg or f"Row {i}, column {key}: expected {expected_val}, got {actual_val}"

    def assert_column_values(self, schema: str, table_name: str, column_name: str,
                             expected_values: List[Any], msg: str = None):
        """Assert that a column contains specific values (in any order)."""
        sql = f'SELECT "{column_name}" FROM "{schema}"."{table_name}"'
        result = db_helpers.execute_sql(self.conn, sql)
        actual_values = [row[0] for row in result] if result else []
        assert sorted(actual_values) == sorted(expected_values), \
            msg or f"Column {column_name} values mismatch: expected {expected_values}, got {actual_values}"
