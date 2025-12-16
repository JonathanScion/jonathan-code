"""
Integration tests for table permission operations.

Tests verify that ContextFreeSQL correctly generates SQL to:
1. Grant missing table permissions
2. Revoke extra table permissions
3. Handle multiple permission types
"""
import pytest
from tests.utils import db_helpers
from tests.conftest import execute_generated_script


@pytest.mark.security
class TestTablePermissions:
    """Tests for table-level permission operations."""

    def test_grant_missing_select_permission(self, test_connection, script_generator, unique_prefix, security_assertions):
        """
        Test that script grants missing SELECT permission.
        """
        table_name = f"{unique_prefix}perm_table"
        role_name = f"{unique_prefix}select_role"
        full_table = f"public.{table_name}"

        # Create table and role
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT PRIMARY KEY,
                data TEXT
            )
            '''
        )
        db_helpers.execute_sql(
            test_connection,
            f'CREATE ROLE "{role_name}"'
        )

        # Grant SELECT
        db_helpers.execute_sql(
            test_connection,
            f'GRANT SELECT ON public."{table_name}" TO "{role_name}"'
        )

        # Generate script
        script = script_generator.generate([full_table], script_security=True)

        # Revoke SELECT
        db_helpers.execute_sql(
            test_connection,
            f'REVOKE SELECT ON public."{table_name}" FROM "{role_name}"'
        )

        # Verify permission is gone
        security_assertions.assert_table_privilege(
            role_name, 'public', table_name, 'SELECT', has_privilege=False
        )

        # Run script
        execute_generated_script(test_connection, script)

        # Verify permission is restored
        security_assertions.assert_table_privilege(
            role_name, 'public', table_name, 'SELECT', has_privilege=True
        )

    def test_revoke_extra_permission(self, test_connection, script_generator, unique_prefix, security_assertions):
        """
        Test that script revokes extra permissions when remove_extras is enabled.
        """
        table_name = f"{unique_prefix}revoke_table"
        role_name = f"{unique_prefix}revoke_role"
        full_table = f"public.{table_name}"

        # Create table and role with no permissions
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT PRIMARY KEY
            )
            '''
        )
        db_helpers.execute_sql(
            test_connection,
            f'CREATE ROLE "{role_name}"'
        )

        # Generate script (no permissions in desired state)
        script = script_generator.generate([full_table], script_security=True, remove_extras=True)

        # Grant extra permission
        db_helpers.execute_sql(
            test_connection,
            f'GRANT SELECT ON public."{table_name}" TO "{role_name}"'
        )

        # Verify permission exists
        security_assertions.assert_table_privilege(
            role_name, 'public', table_name, 'SELECT', has_privilege=True
        )

        # Run script
        execute_generated_script(test_connection, script)

        # Verify extra permission is revoked
        security_assertions.assert_table_privilege(
            role_name, 'public', table_name, 'SELECT', has_privilege=False
        )

    def test_multiple_permissions_same_table(self, test_connection, script_generator, unique_prefix, security_assertions):
        """
        Test that script handles multiple permissions on the same table.
        """
        table_name = f"{unique_prefix}multi_perm_table"
        role_name = f"{unique_prefix}multi_perm_role"
        full_table = f"public.{table_name}"

        # Create table and role
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT PRIMARY KEY,
                data TEXT
            )
            '''
        )
        db_helpers.execute_sql(
            test_connection,
            f'CREATE ROLE "{role_name}"'
        )

        # Grant multiple permissions
        db_helpers.execute_sql(
            test_connection,
            f'GRANT SELECT, INSERT, UPDATE ON public."{table_name}" TO "{role_name}"'
        )

        # Generate script
        script = script_generator.generate([full_table], script_security=True)

        # Revoke some permissions
        db_helpers.execute_sql(
            test_connection,
            f'REVOKE INSERT, UPDATE ON public."{table_name}" FROM "{role_name}"'
        )

        # Verify permissions removed
        security_assertions.assert_table_privilege(
            role_name, 'public', table_name, 'INSERT', has_privilege=False
        )

        # Run script
        execute_generated_script(test_connection, script)

        # Verify all permissions restored
        security_assertions.assert_table_privilege(
            role_name, 'public', table_name, 'SELECT', has_privilege=True
        )
        security_assertions.assert_table_privilege(
            role_name, 'public', table_name, 'INSERT', has_privilege=True
        )
        security_assertions.assert_table_privilege(
            role_name, 'public', table_name, 'UPDATE', has_privilege=True
        )

    def test_permissions_multiple_roles(self, test_connection, script_generator, unique_prefix, security_assertions):
        """
        Test that script handles permissions for multiple roles on same table.
        """
        table_name = f"{unique_prefix}roles_table"
        role1 = f"{unique_prefix}role1"
        role2 = f"{unique_prefix}role2"
        full_table = f"public.{table_name}"

        # Create table and roles
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT PRIMARY KEY
            )
            '''
        )
        db_helpers.execute_sql(test_connection, f'CREATE ROLE "{role1}"')
        db_helpers.execute_sql(test_connection, f'CREATE ROLE "{role2}"')

        # Grant different permissions to each role
        db_helpers.execute_sql(
            test_connection,
            f'GRANT SELECT ON public."{table_name}" TO "{role1}"'
        )
        db_helpers.execute_sql(
            test_connection,
            f'GRANT SELECT, INSERT ON public."{table_name}" TO "{role2}"'
        )

        # Generate script
        script = script_generator.generate([full_table], script_security=True)

        # Revoke all permissions
        db_helpers.execute_sql(
            test_connection,
            f'REVOKE ALL ON public."{table_name}" FROM "{role1}", "{role2}"'
        )

        # Run script
        execute_generated_script(test_connection, script)

        # Verify correct permissions for each role
        security_assertions.assert_table_privilege(
            role1, 'public', table_name, 'SELECT', has_privilege=True
        )
        security_assertions.assert_table_privilege(
            role1, 'public', table_name, 'INSERT', has_privilege=False
        )
        security_assertions.assert_table_privilege(
            role2, 'public', table_name, 'SELECT', has_privilege=True
        )
        security_assertions.assert_table_privilege(
            role2, 'public', table_name, 'INSERT', has_privilege=True
        )

    def test_delete_permission(self, test_connection, script_generator, unique_prefix, security_assertions):
        """
        Test that script handles DELETE permission.
        """
        table_name = f"{unique_prefix}delete_perm_table"
        role_name = f"{unique_prefix}delete_role"
        full_table = f"public.{table_name}"

        # Create table and role
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE TABLE public."{table_name}" (
                id INT PRIMARY KEY
            )
            '''
        )
        db_helpers.execute_sql(
            test_connection,
            f'CREATE ROLE "{role_name}"'
        )

        # Grant DELETE
        db_helpers.execute_sql(
            test_connection,
            f'GRANT DELETE ON public."{table_name}" TO "{role_name}"'
        )

        # Generate script
        script = script_generator.generate([full_table], script_security=True)

        # Revoke DELETE
        db_helpers.execute_sql(
            test_connection,
            f'REVOKE DELETE ON public."{table_name}" FROM "{role_name}"'
        )

        # Run script
        execute_generated_script(test_connection, script)

        # Verify DELETE permission restored
        security_assertions.assert_table_privilege(
            role_name, 'public', table_name, 'DELETE', has_privilege=True
        )
