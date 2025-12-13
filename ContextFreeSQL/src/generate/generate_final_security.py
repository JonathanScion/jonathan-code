from io import StringIO
from src.defs.script_defs import DBType, DBSyntax, ScriptingOptions
from src.utils import funcs as utils
import pandas as pd

"""
Security Generation Module - Split into phases based on dependencies:

ORDER OF OPERATIONS:
1. CREATE ROLE / ALTER ROLE  -> After schemas, before tables (roles don't depend on objects)
2. Role Memberships          -> After roles exist
3. Table/Column Permissions  -> After tables exist
4. Function Permissions      -> After coded entities (functions/procedures)
5. RLS Policies              -> After tables exist
6. REVOKE extra permissions  -> Before dropping roles (if remove_all_extra_ents)
7. DROP extra roles          -> At the very end (after all owned objects are dropped)
"""


def _write_drop_if_exists(sql_buffer: StringIO, table_name: str):
    """Helper to write the drop-if-exists pattern for temp tables."""
    sql_buffer.write(f"\tperform n.nspname, c.relname\n")
    sql_buffer.write(f"\tFROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace\n")
    sql_buffer.write(f"\tWHERE n.nspname like 'pg_temp_%' AND c.relname='{table_name.lower()}' AND pg_catalog.pg_table_is_visible(c.oid);\n")
    sql_buffer.write(f"\tIF FOUND THEN\n")
    sql_buffer.write(f"\t\tDROP TABLE {table_name};\n")
    sql_buffer.write(f"\tEND IF;\n")


def generate_security_state_tables(db_type: DBType, sql_buffer: StringIO, db_schema):
    """Generate temp tables to hold the desired security state for comparison."""

    if db_type != DBType.PostgreSQL:
        return  # Security scripting only implemented for PostgreSQL

    sql_buffer.write("\n")
    sql_buffer.write("--Creating Security State Tables-------------------------------------------\n")

    # Roles state table
    _write_drop_if_exists(sql_buffer, "ScriptRoles")
    sql_buffer.write("\tCREATE TEMP TABLE ScriptRoles (\n")
    sql_buffer.write("\t\trolname varchar(128) NOT NULL,\n")
    sql_buffer.write("\t\trolsuper boolean,\n")
    sql_buffer.write("\t\trolinherit boolean,\n")
    sql_buffer.write("\t\trolcreaterole boolean,\n")
    sql_buffer.write("\t\trolcreatedb boolean,\n")
    sql_buffer.write("\t\trolcanlogin boolean,\n")
    sql_buffer.write("\t\trolreplication boolean,\n")
    sql_buffer.write("\t\trolconnlimit integer,\n")
    sql_buffer.write("\t\trolpassword varchar(256),\n")
    sql_buffer.write("\t\trolvaliduntil timestamp,\n")
    sql_buffer.write("\t\trolbypassrls boolean,\n")
    sql_buffer.write("\t\troleStat smallint DEFAULT 0\n")  # 0=equal, 1=add, 2=drop, 3=alter
    sql_buffer.write("\t);\n\n")

    # Role memberships state table
    _write_drop_if_exists(sql_buffer, "ScriptRoleMemberships")
    sql_buffer.write("\tCREATE TEMP TABLE ScriptRoleMemberships (\n")
    sql_buffer.write("\t\trole_name varchar(128) NOT NULL,\n")
    sql_buffer.write("\t\tmember_name varchar(128) NOT NULL,\n")
    sql_buffer.write("\t\tadmin_option boolean,\n")
    sql_buffer.write("\t\tmembershipStat smallint DEFAULT 0\n")
    sql_buffer.write("\t);\n\n")

    # Table permissions state table
    _write_drop_if_exists(sql_buffer, "ScriptTablePermissions")
    sql_buffer.write("\tCREATE TEMP TABLE ScriptTablePermissions (\n")
    sql_buffer.write("\t\tgrantor varchar(128),\n")
    sql_buffer.write("\t\tgrantee varchar(128) NOT NULL,\n")
    sql_buffer.write("\t\ttable_schema varchar(128) NOT NULL,\n")
    sql_buffer.write("\t\ttable_name varchar(128) NOT NULL,\n")
    sql_buffer.write("\t\tprivilege_type varchar(64) NOT NULL,\n")
    sql_buffer.write("\t\tis_grantable varchar(3),\n")
    sql_buffer.write("\t\tpermStat smallint DEFAULT 0\n")
    sql_buffer.write("\t);\n\n")

    # Column permissions state table
    _write_drop_if_exists(sql_buffer, "ScriptColumnPermissions")
    sql_buffer.write("\tCREATE TEMP TABLE ScriptColumnPermissions (\n")
    sql_buffer.write("\t\tgrantor varchar(128),\n")
    sql_buffer.write("\t\tgrantee varchar(128) NOT NULL,\n")
    sql_buffer.write("\t\ttable_schema varchar(128) NOT NULL,\n")
    sql_buffer.write("\t\ttable_name varchar(128) NOT NULL,\n")
    sql_buffer.write("\t\tcolumn_name varchar(128) NOT NULL,\n")
    sql_buffer.write("\t\tprivilege_type varchar(64) NOT NULL,\n")
    sql_buffer.write("\t\tis_grantable varchar(3),\n")
    sql_buffer.write("\t\tpermStat smallint DEFAULT 0\n")
    sql_buffer.write("\t);\n\n")

    # Function permissions state table
    _write_drop_if_exists(sql_buffer, "ScriptFunctionPermissions")
    sql_buffer.write("\tCREATE TEMP TABLE ScriptFunctionPermissions (\n")
    sql_buffer.write("\t\tgrantor varchar(128),\n")
    sql_buffer.write("\t\tgrantee varchar(128) NOT NULL,\n")
    sql_buffer.write("\t\troutine_schema varchar(128) NOT NULL,\n")
    sql_buffer.write("\t\troutine_name varchar(128) NOT NULL,\n")
    sql_buffer.write("\t\tspecific_name varchar(256),\n")
    sql_buffer.write("\t\tprivilege_type varchar(64) NOT NULL,\n")
    sql_buffer.write("\t\tis_grantable varchar(3),\n")
    sql_buffer.write("\t\tpermStat smallint DEFAULT 0\n")
    sql_buffer.write("\t);\n\n")

    # RLS policies state table
    _write_drop_if_exists(sql_buffer, "ScriptRLSPolicies")
    sql_buffer.write("\tCREATE TEMP TABLE ScriptRLSPolicies (\n")
    sql_buffer.write("\t\ttable_schema varchar(128) NOT NULL,\n")
    sql_buffer.write("\t\ttable_name varchar(128) NOT NULL,\n")
    sql_buffer.write("\t\tpolicy_name varchar(128) NOT NULL,\n")
    sql_buffer.write("\t\tpermissive varchar(16),\n")
    sql_buffer.write("\t\troles text,\n")
    sql_buffer.write("\t\tcommand varchar(16),\n")
    sql_buffer.write("\t\tusing_expression text,\n")
    sql_buffer.write("\t\twith_check_expression text,\n")
    sql_buffer.write("\t\tpolicyStat smallint DEFAULT 0\n")
    sql_buffer.write("\t);\n\n")


def generate_security_inserts(db_type: DBType, sql_buffer: StringIO, db_schema, scripted_tables: list = None):
    """Generate INSERT statements to populate security state tables with desired state."""

    if db_type != DBType.PostgreSQL:
        return

    sql_buffer.write("--Populating Security State Tables-----------------------------------------\n")

    # Insert roles
    if not db_schema.roles.empty:
        sql_buffer.write("-- Roles\n")
        for _, row in db_schema.roles.iterrows():
            rolname = utils.quote_str_or_null(row.get('rolname'))
            rolsuper = 'true' if row.get('rolsuper') else 'false'
            rolinherit = 'true' if row.get('rolinherit') else 'false'
            rolcreaterole = 'true' if row.get('rolcreaterole') else 'false'
            rolcreatedb = 'true' if row.get('rolcreatedb') else 'false'
            rolcanlogin = 'true' if row.get('rolcanlogin') else 'false'
            rolreplication = 'true' if row.get('rolreplication') else 'false'
            rolconnlimit = row.get('rolconnlimit', -1)
            rolpassword = utils.quote_str_or_null(row.get('rolpassword'))
            rolvaliduntil = utils.quote_str_or_null(str(row.get('rolvaliduntil')) if row.get('rolvaliduntil') else None)
            rolbypassrls = 'true' if row.get('rolbypassrls') else 'false'

            sql_buffer.write(f"INSERT INTO ScriptRoles (rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, ")
            sql_buffer.write(f"rolcanlogin, rolreplication, rolconnlimit, rolpassword, rolvaliduntil, rolbypassrls) ")
            sql_buffer.write(f"VALUES ({rolname}, {rolsuper}, {rolinherit}, {rolcreaterole}, {rolcreatedb}, ")
            sql_buffer.write(f"{rolcanlogin}, {rolreplication}, {rolconnlimit}, {rolpassword}, {rolvaliduntil}, {rolbypassrls});\n")
        sql_buffer.write("\n")

    # Insert role memberships
    if not db_schema.role_memberships.empty:
        sql_buffer.write("-- Role Memberships\n")
        for _, row in db_schema.role_memberships.iterrows():
            role_name = utils.quote_str_or_null(row.get('role_name'))
            member_name = utils.quote_str_or_null(row.get('member_name'))
            admin_option = 'true' if row.get('admin_option') else 'false'

            sql_buffer.write(f"INSERT INTO ScriptRoleMemberships (role_name, member_name, admin_option) ")
            sql_buffer.write(f"VALUES ({role_name}, {member_name}, {admin_option});\n")
        sql_buffer.write("\n")

    # Insert table permissions (filtered by scripted tables if specified)
    if not db_schema.table_permissions.empty:
        sql_buffer.write("-- Table Permissions\n")
        table_perms = db_schema.table_permissions
        if scripted_tables:
            # Filter to only include permissions for tables we're scripting
            table_perms = table_perms[
                table_perms.apply(lambda r: f"{r['table_schema']}.{r['table_name']}" in scripted_tables, axis=1)
            ]
        for _, row in table_perms.iterrows():
            grantor = utils.quote_str_or_null(row.get('grantor'))
            grantee = utils.quote_str_or_null(row.get('grantee'))
            table_schema = utils.quote_str_or_null(row.get('table_schema'))
            table_name = utils.quote_str_or_null(row.get('table_name'))
            privilege_type = utils.quote_str_or_null(row.get('privilege_type'))
            is_grantable = utils.quote_str_or_null(row.get('is_grantable'))

            sql_buffer.write(f"INSERT INTO ScriptTablePermissions (grantor, grantee, table_schema, table_name, privilege_type, is_grantable) ")
            sql_buffer.write(f"VALUES ({grantor}, {grantee}, {table_schema}, {table_name}, {privilege_type}, {is_grantable});\n")
        sql_buffer.write("\n")

    # Insert column permissions (filtered by scripted tables if specified)
    if not db_schema.column_permissions.empty:
        sql_buffer.write("-- Column Permissions\n")
        col_perms = db_schema.column_permissions
        if scripted_tables:
            col_perms = col_perms[
                col_perms.apply(lambda r: f"{r['table_schema']}.{r['table_name']}" in scripted_tables, axis=1)
            ]
        for _, row in col_perms.iterrows():
            grantor = utils.quote_str_or_null(row.get('grantor'))
            grantee = utils.quote_str_or_null(row.get('grantee'))
            table_schema = utils.quote_str_or_null(row.get('table_schema'))
            table_name = utils.quote_str_or_null(row.get('table_name'))
            column_name = utils.quote_str_or_null(row.get('column_name'))
            privilege_type = utils.quote_str_or_null(row.get('privilege_type'))
            is_grantable = utils.quote_str_or_null(row.get('is_grantable'))

            sql_buffer.write(f"INSERT INTO ScriptColumnPermissions (grantor, grantee, table_schema, table_name, column_name, privilege_type, is_grantable) ")
            sql_buffer.write(f"VALUES ({grantor}, {grantee}, {table_schema}, {table_name}, {column_name}, {privilege_type}, {is_grantable});\n")
        sql_buffer.write("\n")

    # Insert function permissions (filtered by scripted functions if we have a list)
    if not db_schema.function_permissions.empty:
        sql_buffer.write("-- Function Permissions\n")
        for _, row in db_schema.function_permissions.iterrows():
            grantor = utils.quote_str_or_null(row.get('grantor'))
            grantee = utils.quote_str_or_null(row.get('grantee'))
            routine_schema = utils.quote_str_or_null(row.get('routine_schema'))
            routine_name = utils.quote_str_or_null(row.get('routine_name'))
            specific_name = utils.quote_str_or_null(row.get('specific_name'))
            privilege_type = utils.quote_str_or_null(row.get('privilege_type'))
            is_grantable = utils.quote_str_or_null(row.get('is_grantable'))

            sql_buffer.write(f"INSERT INTO ScriptFunctionPermissions (grantor, grantee, routine_schema, routine_name, specific_name, privilege_type, is_grantable) ")
            sql_buffer.write(f"VALUES ({grantor}, {grantee}, {routine_schema}, {routine_name}, {specific_name}, {privilege_type}, {is_grantable});\n")
        sql_buffer.write("\n")

    # Insert RLS policies (filtered by scripted tables if specified)
    if not db_schema.rls_policies.empty:
        sql_buffer.write("-- RLS Policies\n")
        rls_pols = db_schema.rls_policies
        if scripted_tables:
            rls_pols = rls_pols[
                rls_pols.apply(lambda r: f"{r['table_schema']}.{r['table_name']}" in scripted_tables, axis=1)
            ]
        for _, row in rls_pols.iterrows():
            table_schema = utils.quote_str_or_null(row.get('table_schema'))
            table_name = utils.quote_str_or_null(row.get('table_name'))
            policy_name = utils.quote_str_or_null(row.get('policy_name'))
            permissive = utils.quote_str_or_null(row.get('permissive'))
            roles = utils.quote_str_or_null(row.get('roles'))
            command = utils.quote_str_or_null(row.get('command'))
            using_expr = utils.quote_str_or_null(row.get('using_expression'))
            with_check_expr = utils.quote_str_or_null(row.get('with_check_expression'))

            sql_buffer.write(f"INSERT INTO ScriptRLSPolicies (table_schema, table_name, policy_name, permissive, roles, command, using_expression, with_check_expression) ")
            sql_buffer.write(f"VALUES ({table_schema}, {table_name}, {policy_name}, {permissive}, {roles}, {command}, {using_expr}, {with_check_expr});\n")
        sql_buffer.write("\n")


def generate_security_state_updates(db_type: DBType, sql_buffer: StringIO):
    """Generate UPDATE statements to mark security entities for add/drop/alter."""

    if db_type != DBType.PostgreSQL:
        return

    sql_buffer.write("--Updating Security State-------------------------------------------------\n")

    # Update roles state: compare with pg_roles
    sql_buffer.write("-- Mark roles to ADD (exist in script but not in DB)\n")
    sql_buffer.write("UPDATE ScriptRoles SET roleStat = 1 WHERE NOT EXISTS (\n")
    sql_buffer.write("\tSELECT 1 FROM pg_roles pr WHERE pr.rolname = ScriptRoles.rolname\n")
    sql_buffer.write(");\n\n")

    sql_buffer.write("-- Mark roles to ALTER (exist in both but attributes differ)\n")
    sql_buffer.write("UPDATE ScriptRoles SET roleStat = 3 WHERE EXISTS (\n")
    sql_buffer.write("\tSELECT 1 FROM pg_roles pr WHERE pr.rolname = ScriptRoles.rolname\n")
    sql_buffer.write("\t\tAND (pr.rolsuper <> ScriptRoles.rolsuper\n")
    sql_buffer.write("\t\t\tOR pr.rolinherit <> ScriptRoles.rolinherit\n")
    sql_buffer.write("\t\t\tOR pr.rolcreaterole <> ScriptRoles.rolcreaterole\n")
    sql_buffer.write("\t\t\tOR pr.rolcreatedb <> ScriptRoles.rolcreatedb\n")
    sql_buffer.write("\t\t\tOR pr.rolcanlogin <> ScriptRoles.rolcanlogin\n")
    sql_buffer.write("\t\t\tOR pr.rolreplication <> ScriptRoles.rolreplication\n")
    sql_buffer.write("\t\t\tOR pr.rolconnlimit <> ScriptRoles.rolconnlimit\n")
    sql_buffer.write("\t\t\tOR pr.rolbypassrls <> ScriptRoles.rolbypassrls)\n")
    sql_buffer.write(") AND roleStat = 0;\n\n")

    # Update role memberships state
    sql_buffer.write("-- Mark role memberships to ADD\n")
    sql_buffer.write("UPDATE ScriptRoleMemberships SET membershipStat = 1 WHERE NOT EXISTS (\n")
    sql_buffer.write("\tSELECT 1 FROM pg_auth_members am\n")
    sql_buffer.write("\tJOIN pg_roles r ON am.roleid = r.oid\n")
    sql_buffer.write("\tJOIN pg_roles m ON am.member = m.oid\n")
    sql_buffer.write("\tWHERE r.rolname = ScriptRoleMemberships.role_name\n")
    sql_buffer.write("\t\tAND m.rolname = ScriptRoleMemberships.member_name\n")
    sql_buffer.write(");\n\n")

    # Update table permissions state
    sql_buffer.write("-- Mark table permissions to ADD\n")
    sql_buffer.write("UPDATE ScriptTablePermissions SET permStat = 1 WHERE NOT EXISTS (\n")
    sql_buffer.write("\tSELECT 1 FROM information_schema.table_privileges tp\n")
    sql_buffer.write("\tWHERE tp.grantee = ScriptTablePermissions.grantee\n")
    sql_buffer.write("\t\tAND tp.table_schema = ScriptTablePermissions.table_schema\n")
    sql_buffer.write("\t\tAND tp.table_name = ScriptTablePermissions.table_name\n")
    sql_buffer.write("\t\tAND tp.privilege_type = ScriptTablePermissions.privilege_type\n")
    sql_buffer.write(");\n\n")

    # Update column permissions state
    sql_buffer.write("-- Mark column permissions to ADD\n")
    sql_buffer.write("UPDATE ScriptColumnPermissions SET permStat = 1 WHERE NOT EXISTS (\n")
    sql_buffer.write("\tSELECT 1 FROM information_schema.column_privileges cp\n")
    sql_buffer.write("\tWHERE cp.grantee = ScriptColumnPermissions.grantee\n")
    sql_buffer.write("\t\tAND cp.table_schema = ScriptColumnPermissions.table_schema\n")
    sql_buffer.write("\t\tAND cp.table_name = ScriptColumnPermissions.table_name\n")
    sql_buffer.write("\t\tAND cp.column_name = ScriptColumnPermissions.column_name\n")
    sql_buffer.write("\t\tAND cp.privilege_type = ScriptColumnPermissions.privilege_type\n")
    sql_buffer.write(");\n\n")

    # Update function permissions state
    sql_buffer.write("-- Mark function permissions to ADD\n")
    sql_buffer.write("UPDATE ScriptFunctionPermissions SET permStat = 1 WHERE NOT EXISTS (\n")
    sql_buffer.write("\tSELECT 1 FROM information_schema.routine_privileges rp\n")
    sql_buffer.write("\tWHERE rp.grantee = ScriptFunctionPermissions.grantee\n")
    sql_buffer.write("\t\tAND rp.routine_schema = ScriptFunctionPermissions.routine_schema\n")
    sql_buffer.write("\t\tAND rp.routine_name = ScriptFunctionPermissions.routine_name\n")
    sql_buffer.write("\t\tAND rp.privilege_type = ScriptFunctionPermissions.privilege_type\n")
    sql_buffer.write(");\n\n")

    # Update RLS policies state
    sql_buffer.write("-- Mark RLS policies to ADD\n")
    sql_buffer.write("UPDATE ScriptRLSPolicies SET policyStat = 1 WHERE NOT EXISTS (\n")
    sql_buffer.write("\tSELECT 1 FROM pg_policies pp\n")
    sql_buffer.write("\tWHERE pp.schemaname = ScriptRLSPolicies.table_schema\n")
    sql_buffer.write("\t\tAND pp.tablename = ScriptRLSPolicies.table_name\n")
    sql_buffer.write("\t\tAND pp.policyname = ScriptRLSPolicies.policy_name\n")
    sql_buffer.write(");\n\n")

    # Mark RLS policies to ALTER (exist but differ)
    sql_buffer.write("-- Mark RLS policies to ALTER\n")
    sql_buffer.write("UPDATE ScriptRLSPolicies SET policyStat = 3 WHERE EXISTS (\n")
    sql_buffer.write("\tSELECT 1 FROM pg_policies pp\n")
    sql_buffer.write("\tWHERE pp.schemaname = ScriptRLSPolicies.table_schema\n")
    sql_buffer.write("\t\tAND pp.tablename = ScriptRLSPolicies.table_name\n")
    sql_buffer.write("\t\tAND pp.policyname = ScriptRLSPolicies.policy_name\n")
    sql_buffer.write("\t\tAND (COALESCE(pp.qual::text,'') <> COALESCE(ScriptRLSPolicies.using_expression,'')\n")
    sql_buffer.write("\t\t\tOR COALESCE(pp.with_check::text,'') <> COALESCE(ScriptRLSPolicies.with_check_expression,''))\n")
    sql_buffer.write(") AND policyStat = 0;\n\n")


# ============================================================================
# PHASE 1: CREATE/ALTER ROLES - Runs early, after schemas, before tables
# ============================================================================
def generate_create_roles(db_type: DBType, sql_buffer: StringIO):
    """Generate CREATE ROLE and ALTER ROLE statements.
    Runs EARLY in script - roles must exist before we can grant permissions to them."""

    if db_type != DBType.PostgreSQL:
        return

    sql_buffer.write("\n")
    sql_buffer.write("--Creating/Altering Roles (early - before tables)-------------------------\n")
    sql_buffer.write("declare temprow record;\n")
    sql_buffer.write("BEGIN\n")
    sql_buffer.write("\tFOR temprow IN\n")
    sql_buffer.write("\t\tSELECT * FROM ScriptRoles WHERE roleStat IN (1, 3)\n")
    sql_buffer.write("\tLOOP\n")
    utils.add_print(db_type, 2, sql_buffer, "'' || CASE WHEN temprow.roleStat = 1 THEN 'Creating role: ' ELSE 'Altering role: ' END || temprow.rolname")

    # Build CREATE/ALTER ROLE statement
    sql_buffer.write("\t\tIF temprow.roleStat = 1 THEN\n")
    sql_buffer.write("\t\t\t-- Create new role\n")
    sql_buffer.write("\t\t\tEXECUTE 'CREATE ROLE ' || quote_ident(temprow.rolname) ||\n")
    sql_buffer.write("\t\t\t\tCASE WHEN temprow.rolcanlogin THEN ' LOGIN' ELSE ' NOLOGIN' END ||\n")
    sql_buffer.write("\t\t\t\tCASE WHEN temprow.rolsuper THEN ' SUPERUSER' ELSE ' NOSUPERUSER' END ||\n")
    sql_buffer.write("\t\t\t\tCASE WHEN temprow.rolcreatedb THEN ' CREATEDB' ELSE ' NOCREATEDB' END ||\n")
    sql_buffer.write("\t\t\t\tCASE WHEN temprow.rolcreaterole THEN ' CREATEROLE' ELSE ' NOCREATEROLE' END ||\n")
    sql_buffer.write("\t\t\t\tCASE WHEN temprow.rolinherit THEN ' INHERIT' ELSE ' NOINHERIT' END ||\n")
    sql_buffer.write("\t\t\t\tCASE WHEN temprow.rolreplication THEN ' REPLICATION' ELSE ' NOREPLICATION' END ||\n")
    sql_buffer.write("\t\t\t\tCASE WHEN temprow.rolbypassrls THEN ' BYPASSRLS' ELSE ' NOBYPASSRLS' END ||\n")
    sql_buffer.write("\t\t\t\tCASE WHEN temprow.rolconnlimit >= 0 THEN ' CONNECTION LIMIT ' || temprow.rolconnlimit ELSE '' END ||\n")
    sql_buffer.write("\t\t\t\tCASE WHEN temprow.rolpassword IS NOT NULL THEN ' ENCRYPTED PASSWORD ' || quote_literal(temprow.rolpassword) ELSE '' END ||\n")
    sql_buffer.write("\t\t\t\tCASE WHEN temprow.rolvaliduntil IS NOT NULL THEN ' VALID UNTIL ' || quote_literal(temprow.rolvaliduntil::text) ELSE '' END;\n")
    sql_buffer.write("\t\tELSE\n")
    sql_buffer.write("\t\t\t-- Alter existing role\n")
    sql_buffer.write("\t\t\tEXECUTE 'ALTER ROLE ' || quote_ident(temprow.rolname) ||\n")
    sql_buffer.write("\t\t\t\tCASE WHEN temprow.rolcanlogin THEN ' LOGIN' ELSE ' NOLOGIN' END ||\n")
    sql_buffer.write("\t\t\t\tCASE WHEN temprow.rolsuper THEN ' SUPERUSER' ELSE ' NOSUPERUSER' END ||\n")
    sql_buffer.write("\t\t\t\tCASE WHEN temprow.rolcreatedb THEN ' CREATEDB' ELSE ' NOCREATEDB' END ||\n")
    sql_buffer.write("\t\t\t\tCASE WHEN temprow.rolcreaterole THEN ' CREATEROLE' ELSE ' NOCREATEROLE' END ||\n")
    sql_buffer.write("\t\t\t\tCASE WHEN temprow.rolinherit THEN ' INHERIT' ELSE ' NOINHERIT' END ||\n")
    sql_buffer.write("\t\t\t\tCASE WHEN temprow.rolreplication THEN ' REPLICATION' ELSE ' NOREPLICATION' END ||\n")
    sql_buffer.write("\t\t\t\tCASE WHEN temprow.rolbypassrls THEN ' BYPASSRLS' ELSE ' NOBYPASSRLS' END ||\n")
    sql_buffer.write("\t\t\t\tCASE WHEN temprow.rolconnlimit >= 0 THEN ' CONNECTION LIMIT ' || temprow.rolconnlimit ELSE '' END;\n")
    sql_buffer.write("\t\tEND IF;\n")
    sql_buffer.write("\tEND LOOP;\n")
    sql_buffer.write("END;\n")

    # Role memberships (GRANT role TO role) - right after roles are created
    sql_buffer.write("\n--Granting Role Memberships-----------------------------------------------\n")
    sql_buffer.write("declare temprow record;\n")
    sql_buffer.write("BEGIN\n")
    sql_buffer.write("\tFOR temprow IN\n")
    sql_buffer.write("\t\tSELECT * FROM ScriptRoleMemberships WHERE membershipStat = 1\n")
    sql_buffer.write("\tLOOP\n")
    utils.add_print(db_type, 2, sql_buffer, "'Granting ' || temprow.role_name || ' TO ' || temprow.member_name")
    sql_buffer.write("\t\tEXECUTE 'GRANT ' || quote_ident(temprow.role_name) || ' TO ' || quote_ident(temprow.member_name) ||\n")
    sql_buffer.write("\t\t\tCASE WHEN temprow.admin_option THEN ' WITH ADMIN OPTION' ELSE '' END;\n")
    sql_buffer.write("\tEND LOOP;\n")
    sql_buffer.write("END;\n")


# ============================================================================
# PHASE 2: TABLE/COLUMN PERMISSIONS - Runs after tables exist
# ============================================================================
def generate_grant_table_permissions(db_type: DBType, sql_buffer: StringIO):
    """Generate GRANT statements for table and column permissions.
    Runs AFTER tables are created."""

    if db_type != DBType.PostgreSQL:
        return

    # Table permissions
    sql_buffer.write("\n--Granting Table Permissions (after tables exist)------------------------\n")
    sql_buffer.write("declare temprow record;\n")
    sql_buffer.write("BEGIN\n")
    sql_buffer.write("\tFOR temprow IN\n")
    sql_buffer.write("\t\tSELECT * FROM ScriptTablePermissions WHERE permStat = 1\n")
    sql_buffer.write("\tLOOP\n")
    utils.add_print(db_type, 2, sql_buffer, "'Granting ' || temprow.privilege_type || ' ON ' || temprow.table_schema || '.' || temprow.table_name || ' TO ' || temprow.grantee")
    sql_buffer.write("\t\tEXECUTE 'GRANT ' || temprow.privilege_type || ' ON ' || quote_ident(temprow.table_schema) || '.' || quote_ident(temprow.table_name) ||\n")
    sql_buffer.write("\t\t\t' TO ' || quote_ident(temprow.grantee) ||\n")
    sql_buffer.write("\t\t\tCASE WHEN temprow.is_grantable = 'YES' THEN ' WITH GRANT OPTION' ELSE '' END;\n")
    sql_buffer.write("\tEND LOOP;\n")
    sql_buffer.write("END;\n")

    # Column permissions
    sql_buffer.write("\n--Granting Column Permissions---------------------------------------------\n")
    sql_buffer.write("declare temprow record;\n")
    sql_buffer.write("BEGIN\n")
    sql_buffer.write("\tFOR temprow IN\n")
    sql_buffer.write("\t\tSELECT * FROM ScriptColumnPermissions WHERE permStat = 1\n")
    sql_buffer.write("\tLOOP\n")
    utils.add_print(db_type, 2, sql_buffer, "'Granting ' || temprow.privilege_type || ' (' || temprow.column_name || ') ON ' || temprow.table_schema || '.' || temprow.table_name || ' TO ' || temprow.grantee")
    sql_buffer.write("\t\tEXECUTE 'GRANT ' || temprow.privilege_type || ' (' || quote_ident(temprow.column_name) || ') ON ' ||\n")
    sql_buffer.write("\t\t\tquote_ident(temprow.table_schema) || '.' || quote_ident(temprow.table_name) ||\n")
    sql_buffer.write("\t\t\t' TO ' || quote_ident(temprow.grantee) ||\n")
    sql_buffer.write("\t\t\tCASE WHEN temprow.is_grantable = 'YES' THEN ' WITH GRANT OPTION' ELSE '' END;\n")
    sql_buffer.write("\tEND LOOP;\n")
    sql_buffer.write("END;\n")

    # RLS Policies (also depends on tables)
    sql_buffer.write("\n--Creating/Altering RLS Policies------------------------------------------\n")
    sql_buffer.write("declare temprow record;\n")
    sql_buffer.write("BEGIN\n")
    sql_buffer.write("\tFOR temprow IN\n")
    sql_buffer.write("\t\tSELECT * FROM ScriptRLSPolicies WHERE policyStat IN (1, 3)\n")
    sql_buffer.write("\tLOOP\n")
    utils.add_print(db_type, 2, sql_buffer, "'' || CASE WHEN temprow.policyStat = 1 THEN 'Creating' ELSE 'Replacing' END || ' RLS policy: ' || temprow.policy_name || ' ON ' || temprow.table_schema || '.' || temprow.table_name")

    sql_buffer.write("\t\t-- Drop existing policy if altering\n")
    sql_buffer.write("\t\tIF temprow.policyStat = 3 THEN\n")
    sql_buffer.write("\t\t\tEXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(temprow.policy_name) || ' ON ' ||\n")
    sql_buffer.write("\t\t\t\tquote_ident(temprow.table_schema) || '.' || quote_ident(temprow.table_name);\n")
    sql_buffer.write("\t\tEND IF;\n")

    sql_buffer.write("\t\t-- Create policy\n")
    sql_buffer.write("\t\tEXECUTE 'CREATE POLICY ' || quote_ident(temprow.policy_name) || ' ON ' ||\n")
    sql_buffer.write("\t\t\tquote_ident(temprow.table_schema) || '.' || quote_ident(temprow.table_name) ||\n")
    sql_buffer.write("\t\t\tCASE WHEN temprow.permissive = 'PERMISSIVE' THEN ' AS PERMISSIVE' ELSE ' AS RESTRICTIVE' END ||\n")
    sql_buffer.write("\t\t\t' FOR ' || COALESCE(temprow.command, 'ALL') ||\n")
    sql_buffer.write("\t\t\tCASE WHEN temprow.roles IS NOT NULL AND temprow.roles <> '{}'  THEN ' TO ' || array_to_string(temprow.roles::text[], ', ') ELSE '' END ||\n")
    sql_buffer.write("\t\t\tCASE WHEN temprow.using_expression IS NOT NULL THEN ' USING (' || temprow.using_expression || ')' ELSE '' END ||\n")
    sql_buffer.write("\t\t\tCASE WHEN temprow.with_check_expression IS NOT NULL THEN ' WITH CHECK (' || temprow.with_check_expression || ')' ELSE '' END;\n")
    sql_buffer.write("\tEND LOOP;\n")
    sql_buffer.write("END;\n")


# ============================================================================
# PHASE 3: FUNCTION PERMISSIONS - Runs after coded entities
# ============================================================================
def generate_grant_function_permissions(db_type: DBType, sql_buffer: StringIO):
    """Generate GRANT statements for function/procedure permissions.
    Runs AFTER coded entities (functions/procedures) are created."""

    if db_type != DBType.PostgreSQL:
        return

    sql_buffer.write("\n--Granting Function Permissions (after coded entities)-------------------\n")
    sql_buffer.write("declare temprow record;\n")
    sql_buffer.write("BEGIN\n")
    sql_buffer.write("\tFOR temprow IN\n")
    sql_buffer.write("\t\tSELECT * FROM ScriptFunctionPermissions WHERE permStat = 1\n")
    sql_buffer.write("\tLOOP\n")
    utils.add_print(db_type, 2, sql_buffer, "'Granting ' || temprow.privilege_type || ' ON FUNCTION ' || temprow.routine_schema || '.' || temprow.routine_name || ' TO ' || temprow.grantee")
    sql_buffer.write("\t\t-- Note: specific_name includes parameter signature for overloaded functions\n")
    sql_buffer.write("\t\tEXECUTE 'GRANT ' || temprow.privilege_type || ' ON FUNCTION ' ||\n")
    sql_buffer.write("\t\t\tquote_ident(temprow.routine_schema) || '.' || temprow.specific_name ||\n")
    sql_buffer.write("\t\t\t' TO ' || quote_ident(temprow.grantee) ||\n")
    sql_buffer.write("\t\t\tCASE WHEN temprow.is_grantable = 'YES' THEN ' WITH GRANT OPTION' ELSE '' END;\n")
    sql_buffer.write("\tEND LOOP;\n")
    sql_buffer.write("END;\n")


# ============================================================================
# PHASE 4: REVOKE EXTRA & DROP ROLES - Runs at the very end
# ============================================================================
def generate_revoke_and_drop_extra_security(db_type: DBType, sql_buffer: StringIO, remove_extra_ents: bool):
    """Generate REVOKE for extra permissions and DROP for extra roles.
    Runs at the END of script, after all objects are handled."""

    if db_type != DBType.PostgreSQL:
        return

    if not remove_extra_ents:
        return

    sql_buffer.write("\n--Revoking Extra Role Memberships (not in script)------------------------\n")
    sql_buffer.write("declare temprow record;\n")
    sql_buffer.write("BEGIN\n")
    sql_buffer.write("\tFOR temprow IN\n")
    sql_buffer.write("\t\tSELECT r.rolname as role_name, m.rolname as member_name\n")
    sql_buffer.write("\t\tFROM pg_auth_members am\n")
    sql_buffer.write("\t\tJOIN pg_roles r ON am.roleid = r.oid\n")
    sql_buffer.write("\t\tJOIN pg_roles m ON am.member = m.oid\n")
    sql_buffer.write("\t\tWHERE r.rolname NOT LIKE 'pg_%'\n")
    sql_buffer.write("\t\t\tAND m.rolname NOT LIKE 'pg_%'\n")
    sql_buffer.write("\t\t\tAND NOT EXISTS (\n")
    sql_buffer.write("\t\t\t\tSELECT 1 FROM ScriptRoleMemberships sm\n")
    sql_buffer.write("\t\t\t\tWHERE sm.role_name = r.rolname AND sm.member_name = m.rolname\n")
    sql_buffer.write("\t\t\t)\n")
    sql_buffer.write("\tLOOP\n")
    utils.add_print(db_type, 2, sql_buffer, "'Revoking extra membership: ' || temprow.role_name || ' FROM ' || temprow.member_name")
    sql_buffer.write("\t\tEXECUTE 'REVOKE ' || quote_ident(temprow.role_name) || ' FROM ' || quote_ident(temprow.member_name);\n")
    sql_buffer.write("\tEND LOOP;\n")
    sql_buffer.write("END;\n")

    sql_buffer.write("\n--Dropping Extra Roles (not in script)------------------------------------\n")
    sql_buffer.write("declare temprow record;\n")
    sql_buffer.write("BEGIN\n")
    sql_buffer.write("\tFOR temprow IN\n")
    sql_buffer.write("\t\tSELECT pr.rolname\n")
    sql_buffer.write("\t\tFROM pg_roles pr\n")
    sql_buffer.write("\t\tWHERE pr.rolname NOT LIKE 'pg_%'\n")
    sql_buffer.write("\t\t\tAND pr.rolname NOT IN ('postgres')\n")
    sql_buffer.write("\t\t\tAND NOT EXISTS (\n")
    sql_buffer.write("\t\t\t\tSELECT 1 FROM ScriptRoles sr WHERE sr.rolname = pr.rolname\n")
    sql_buffer.write("\t\t\t)\n")
    sql_buffer.write("\tLOOP\n")
    utils.add_print(db_type, 2, sql_buffer, "'Dropping extra role: ' || temprow.rolname")
    sql_buffer.write("\t\t-- Note: This will fail if role owns objects. Consider REASSIGN OWNED first.\n")
    sql_buffer.write("\t\tBEGIN\n")
    sql_buffer.write("\t\t\tEXECUTE 'DROP ROLE ' || quote_ident(temprow.rolname);\n")
    sql_buffer.write("\t\tEXCEPTION WHEN dependent_objects_still_exist THEN\n")
    utils.add_print(db_type, 3, sql_buffer, "'  Cannot drop role ' || temprow.rolname || ' - owns objects. Use REASSIGN OWNED BY ' || temprow.rolname || ' TO postgres; first.'")
    sql_buffer.write("\t\tEND;\n")
    sql_buffer.write("\tEND LOOP;\n")
    sql_buffer.write("END;\n")


# ============================================================================
# LEGACY: Combined function (kept for backwards compatibility)
# ============================================================================
def generate_security_operations(db_type: DBType, sql_buffer: StringIO, remove_extra_ents: bool):
    """DEPRECATED: Use the individual phase functions instead.
    This combines all operations but doesn't respect proper ordering."""

    if db_type != DBType.PostgreSQL:
        return

    sql_buffer.write("\n")
    sql_buffer.write("BEGIN --security operations (combined - consider using phased approach)\n")

    # All operations in one block (legacy behavior)
    generate_create_roles(db_type, sql_buffer)
    generate_grant_table_permissions(db_type, sql_buffer)
    generate_grant_function_permissions(db_type, sql_buffer)

    if remove_extra_ents:
        generate_revoke_and_drop_extra_security(db_type, sql_buffer, remove_extra_ents)

    sql_buffer.write("END; --security operations\n")
