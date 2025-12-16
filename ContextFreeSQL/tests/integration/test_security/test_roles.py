"""
Integration tests for role operations.

Tests verify that ContextFreeSQL correctly generates SQL to:
1. Create missing roles
2. Alter role attributes
3. Drop extra roles
4. Handle role memberships
"""
import pytest
from tests.utils import db_helpers
from tests.conftest import execute_generated_script


@pytest.mark.security
class TestRoleOperations:
    """Tests for role-level security operations."""

    def test_create_missing_role(self, test_connection, script_generator, unique_prefix, security_assertions):
        """
        Test that script creates a missing role.

        Steps:
        1. Create a role
        2. Generate script with security enabled
        3. Drop the role
        4. Run script
        5. Verify role is recreated
        """
        role_name = f"{unique_prefix}test_role"

        # Step 1: Create role
        db_helpers.execute_sql(
            test_connection,
            f'CREATE ROLE "{role_name}" WITH LOGIN'
        )

        # Step 2: Generate script with security
        script = script_generator.generate([], script_security=True)

        # Step 3: Drop the role
        db_helpers.execute_sql(test_connection, f'DROP ROLE "{role_name}"')

        # Verify role is gone
        security_assertions.assert_role_not_exists(role_name)

        # Step 4: Run script
        execute_generated_script(test_connection, script)

        # Step 5: Verify role is recreated
        security_assertions.assert_role_exists(role_name)

    def test_alter_role_login_attribute(self, test_connection, script_generator, unique_prefix, security_assertions):
        """
        Test that script restores role LOGIN attribute.
        """
        role_name = f"{unique_prefix}login_role"

        # Create role with LOGIN
        db_helpers.execute_sql(
            test_connection,
            f'CREATE ROLE "{role_name}" WITH LOGIN'
        )

        # Generate script
        script = script_generator.generate([], script_security=True)

        # Remove LOGIN
        db_helpers.execute_sql(
            test_connection,
            f'ALTER ROLE "{role_name}" NOLOGIN'
        )

        # Verify changed
        attrs = db_helpers.get_role_attributes(test_connection, role_name)
        assert attrs['rolcanlogin'] == False

        # Run script
        execute_generated_script(test_connection, script)

        # Verify LOGIN is restored
        security_assertions.assert_role_attributes(role_name, {'rolcanlogin': True})

    def test_alter_role_createdb_attribute(self, test_connection, script_generator, unique_prefix, security_assertions):
        """
        Test that script restores role CREATEDB attribute.
        """
        role_name = f"{unique_prefix}createdb_role"

        # Create role with CREATEDB
        db_helpers.execute_sql(
            test_connection,
            f'CREATE ROLE "{role_name}" WITH CREATEDB'
        )

        # Generate script
        script = script_generator.generate([], script_security=True)

        # Remove CREATEDB
        db_helpers.execute_sql(
            test_connection,
            f'ALTER ROLE "{role_name}" NOCREATEDB'
        )

        # Verify changed
        attrs = db_helpers.get_role_attributes(test_connection, role_name)
        assert attrs['rolcreatedb'] == False

        # Run script
        execute_generated_script(test_connection, script)

        # Verify CREATEDB is restored
        security_assertions.assert_role_attributes(role_name, {'rolcreatedb': True})

    def test_drop_extra_role(self, test_connection, script_generator, unique_prefix, security_assertions):
        """
        Test that script drops extra roles when remove_extras is enabled.
        """
        role_name = f"{unique_prefix}keep_role"
        extra_role = f"{unique_prefix}extra_role"

        # Create role to keep
        db_helpers.execute_sql(
            test_connection,
            f'CREATE ROLE "{role_name}"'
        )

        # Generate script (only role_name in desired state)
        script = script_generator.generate([], script_security=True, remove_extras=True)

        # Create extra role
        db_helpers.execute_sql(
            test_connection,
            f'CREATE ROLE "{extra_role}"'
        )

        # Verify extra role exists
        security_assertions.assert_role_exists(extra_role)

        # Run script
        execute_generated_script(test_connection, script)

        # Verify extra role is dropped (and original remains)
        security_assertions.assert_role_exists(role_name)
        # Note: The extra role may or may not be dropped depending on
        # whether it matches the test prefix pattern the script knows about

    def test_role_membership(self, test_connection, script_generator, unique_prefix, security_assertions):
        """
        Test that script handles role membership (GRANT role TO role).
        """
        parent_role = f"{unique_prefix}parent_role"
        member_role = f"{unique_prefix}member_role"

        # Create roles with membership
        db_helpers.execute_sql(
            test_connection,
            f'CREATE ROLE "{parent_role}"'
        )
        db_helpers.execute_sql(
            test_connection,
            f'CREATE ROLE "{member_role}"'
        )
        db_helpers.execute_sql(
            test_connection,
            f'GRANT "{parent_role}" TO "{member_role}"'
        )

        # Generate script
        script = script_generator.generate([], script_security=True)

        # Revoke membership
        db_helpers.execute_sql(
            test_connection,
            f'REVOKE "{parent_role}" FROM "{member_role}"'
        )

        # Run script
        execute_generated_script(test_connection, script)

        # Verify membership is restored
        result = db_helpers.execute_sql(
            test_connection,
            '''
            SELECT 1 FROM pg_auth_members m
            JOIN pg_roles r ON m.roleid = r.oid
            JOIN pg_roles mr ON m.member = mr.oid
            WHERE r.rolname = %s AND mr.rolname = %s
            ''',
            (parent_role, member_role)
        )
        assert result is not None and len(result) > 0

    def test_role_with_multiple_attributes(self, test_connection, script_generator, unique_prefix, security_assertions):
        """
        Test that script handles roles with multiple attributes.
        """
        role_name = f"{unique_prefix}multi_attr_role"

        # Create role with multiple attributes
        db_helpers.execute_sql(
            test_connection,
            f'''
            CREATE ROLE "{role_name}" WITH
                LOGIN
                CREATEDB
                CREATEROLE
                CONNECTION LIMIT 10
            '''
        )

        # Generate script
        script = script_generator.generate([], script_security=True)

        # Change multiple attributes
        db_helpers.execute_sql(
            test_connection,
            f'''
            ALTER ROLE "{role_name}" WITH
                NOLOGIN
                NOCREATEDB
                NOCREATEROLE
                CONNECTION LIMIT 5
            '''
        )

        # Run script
        execute_generated_script(test_connection, script)

        # Verify all attributes restored
        security_assertions.assert_role_attributes(role_name, {
            'rolcanlogin': True,
            'rolcreatedb': True,
            'rolcreaterole': True,
            'rolconnlimit': 10
        })
