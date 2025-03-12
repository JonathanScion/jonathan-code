from io import StringIO
from enum import Enum
import pandas as pd
from typing import Optional, Dict, List, Tuple, Any

class E_DBType(Enum):
    MSSQL = "MSSQL"
    PostgreSQL = "PostgreSQL"
    MySQL = "MySQL"

class ScriptingOptions:
    def __init__(self):
        self.pre_add_constraints_data_checks = False
        self.remove_all_extra_ents = False
        self.as_transaction = False
        self.instance_id = None
        self.rndph_db_id = None
        self.rndph_conn_str = None
        self.data_only_get_schema_from_d_table = False

class DBInfo:
    def __init__(self):
        self.conn_str = ""
        self.src_db_type = E_DBType.MSSQL
        self.dst_db_type = E_DBType.MSSQL

class ScriptTableOptions:
    def __init__(self):
        pass

def generate_code(
    db_info: DBInfo,
    tbl_ents: pd.DataFrame,
    script_ops: ScriptingOptions,
    schema_tables: Dict[str, Any],
    output: StringIO = None
) -> StringIO:
    """
    Generate database schema migration code
    
    Args:
        db_info: Database connection information
        tbl_ents: Entities table
        script_ops: Scripting options
        schema_tables: Schema tables information
        output: StringIO output buffer, created if None
        
    Returns:
        StringIO with the generated script
    """
    if output is None:
        output = StringIO()
    
    # Variable declarations for script header
    script_header = StringIO()
    script_header.write("DECLARE @table_schema NVARCHAR(128);\n")
    script_header.write("DECLARE @table_name NVARCHAR(128);\n")
    script_header.write("DECLARE @index_name NVARCHAR(128);\n")
    script_header.write("DECLARE @fk_name NVARCHAR(128);\n")
    script_header.write("DECLARE @col_name NVARCHAR(128);\n")
    script_header.write("DECLARE @user_type_name NVARCHAR(128);\n")
    script_header.write("DECLARE @max_length SMALLINT;\n")
    script_header.write("DECLARE @precision SMALLINT;\n")
    script_header.write("DECLARE @scale SMALLINT;\n")
    script_header.write("DECLARE @is_nullable BIT;\n")
    script_header.write("DECLARE @is_identity BIT;\n")
    script_header.write("DECLARE @is_computed BIT;\n")
    script_header.write("DECLARE @collation_name NVARCHAR(128);\n")
    script_header.write("DECLARE @computed_definition NVARCHAR(MAX);\n")
    script_header.write("DECLARE @SQL_CREATE NVARCHAR(MAX);\n")
    script_header.write("DECLARE @SQL_ALTER NVARCHAR(MAX);\n")
    script_header.write("DECLARE @SQL_DROP NVARCHAR(MAX);\n")
    script_header.write("DECLARE @diff_descr NVARCHAR(MAX);\n")
    script_header.write("DECLARE @ent_type NVARCHAR(25);\n")
    
    if script_ops.pre_add_constraints_data_checks:
        script_header.write("DECLARE @GotBadData BIT; --for data checks, before adding/reactivating indexes and constraints\n")
    
    # Initialize StringBuilders for various parts of the script
    j2_index_pre_drop = StringIO()
    j2_index_post_add = StringIO()
    j2_fk_pre_drop = StringIO()
    j2_fk_post_add = StringIO()
    j2_cols_ad_alter_drop = StringIO()
    j2_alter_cols_not_null = StringIO()
    j2_defaults_drop = StringIO()
    j2_defaults_add = StringIO()
    j2_ccs_drop = StringIO()
    j2_ccs_add = StringIO()
    drop_tables = StringIO()
    add_tables = StringIO()
    
    # Get count of tables to script
    num_tables_script = len(tbl_ents[(tbl_ents['enttype'] == 'Table') & (tbl_ents['scriptschema'] == True)])
    
    # Generate script components based on conditions
    if num_tables_script > 0 or script_ops.remove_all_extra_ents:
        generate_pre_drop_post_add_indexes_fks(
            db_info.dst_db_type, 
            j2_index_pre_drop, 
            j2_index_post_add, 
            j2_fk_pre_drop, 
            j2_fk_post_add, 
            script_ops.pre_add_constraints_data_checks
        )
        
        generate_add_alter_drop_cols(
            db_info.dst_db_type,
            j2_cols_ad_alter_drop,
            j2_alter_cols_not_null
        )
        
        generate_drop_add_defaults(
            db_info.dst_db_type,
            j2_defaults_drop,
            j2_defaults_add
        )
        
        if db_info.dst_db_type == E_DBType.MSSQL:
            generate_drop_add_cc(
                db_info.dst_db_type,
                j2_ccs_drop,
                j2_ccs_add
            )
        
        generate_add_tables(
            db_info.dst_db_type,
            add_tables
        )
        
        if script_ops.remove_all_extra_ents:
            generate_drop_tables(
                db_info.dst_db_type,
                drop_tables
            )
    
    # Coded entities
    j2_coded_ents = StringIO()
    rows_coded_ents = tbl_ents[tbl_ents['enttype'] == 'Coded']
    
    if len(rows_coded_ents) > 0 or script_ops.remove_all_extra_ents:
        generate_coded_ents(
            db_info.dst_db_type,
            j2_coded_ents,
            script_ops
        )
    
    # Add comment and SQL code declaration
    script_header.write("----anything below here is old Johannes\n")
    script_header.write("DECLARE @sqlCode NVARCHAR(MAX), @schemaChanged BIT = 0;\n")
    
    # Database-specific code
    if db_info.src_db_type == E_DBType.PostgreSQL:
        script_header.write("BEGIN --overall code\n")
        script_header.write("PERFORM n.nspname, c.relname\n")
        script_header.write("FROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace\n")
        script_header.write("WHERE n.nspname LIKE 'pg_temp_%' AND c.relname='scriptoutput' AND pg_catalog.pg_table_is_visible(c.oid);\n")
        script_header.write("IF FOUND THEN\n")
        script_header.write("  DROP TABLE scriptoutput;\n")
        script_header.write("END IF;\n")
        script_header.write("CREATE TEMP TABLE scriptoutput\n")
        script_header.write("(\n")
        script_header.write("  SQLText CHARACTER VARYING\n")
        script_header.write(");\n")
    
    # Transaction handling
    if script_ops.as_transaction:
        script_header.write("BEGIN TRY\n")
        script_header.write("  BEGIN TRANSACTION;\n\n")
    
    # Create StringBuilders for schema objects
    create_principals = StringIO()
    create_role_members = StringIO()
    create_permissions = StringIO()
    create_schemas = StringIO()
    script_db_state_tables = StringIO()
    col_alters_post_data = StringIO()
    drop_schemas = StringIO()
    enable_disable_ents = StringIO()
    drop_role_members = StringIO()
    drop_permissions = StringIO()
    drop_principals = StringIO()
    
    # Generate DB state tables
    script_db_state_tables = create_db_state_temp_tables_for_tables(
        db_info.dst_db_type,
        tbl_ents,
        script_ops,
        schema_tables,
        False,  # scripting_data
        None,   # script_table_ops
        script_ops.pre_add_constraints_data_checks
    )
    
    # Bad data check StringBuilders
    bad_data_pre_add_indx = StringIO()
    bad_data_pre_add_fk = StringIO()
    
    # Write script header to output
    output.write(script_header.getvalue())
    
    # Write principals if needed
    if create_principals.getvalue():
        output.write("--Creating Principals (users)-----------------------------------------------------\n")
        output.write(create_principals.getvalue())
        output.write("\n")
    
    # Write role members if needed
    if create_role_members.getvalue():
        output.write("--Creating Role Memberships-----------------------------------------------------\n")
        output.write(create_role_members.getvalue())
        output.write("\n")
    
    # Write permissions if needed
    if create_permissions.getvalue():
        output.write("--Creating Permissions-----------------------------------------------------\n")
        output.write(create_permissions.getvalue())
        output.write("\n")
    
    # Write schemas if needed
    if create_schemas.getvalue():
        output.write("--Creating Schemas----------------------------------------------------------------\n")
        output.write(create_schemas.getvalue())
        output.write("\n")
    
    # Write DB state tables
    output.write(script_db_state_tables.getvalue())
    output.write("\n")
    
    # Write add tables if needed
    if add_tables.getvalue():
        output.write("--Adding Tables--------------------------------------------------------------------\n")
        output.write(add_tables.getvalue())
        output.write("\n")
    
    # Write post-data column alters if needed
    if col_alters_post_data.getvalue():
        output.write("--Column Changes Once We Got Data--------------------------------------------------------------------\n")
        output.write(col_alters_post_data.getvalue())
        output.write("\n")
    
    # Write drop schemas if needed
    if drop_schemas.getvalue():
        output.write("--Dropping Extra Schemas----------------------------------------------------------------\n")
        output.write(drop_schemas.getvalue())
        output.write("\n")
    
    # Write FK pre-drop if needed
    if j2_fk_pre_drop.getvalue():
        output.write("--Pre-Dropping Foreign keys (some might be added later)---------------------------------------------------------------\n")
        output.write(j2_fk_pre_drop.getvalue())
        output.write("\n")
    
    # Write index pre-drop if needed
    if j2_index_pre_drop.getvalue():
        output.write("--Pre-Dropping Indexes (some might be added later)---------------------------------------------------------------\n")
        output.write(j2_index_pre_drop.getvalue())
        output.write("\n")
    
    # Write defaults drop if needed
    if j2_defaults_drop.getvalue():
        output.write("--Dropping Defaults (some might be added later)---------------------------------------------------------------\n")
        output.write(j2_defaults_drop.getvalue())
        output.write("\n")
    
    # Write check constraints drop if needed
    if j2_ccs_drop.getvalue():
        output.write("--Dropping Check Constraints (some might be added later)---------------------------------------------------------------\n")
        output.write(j2_ccs_drop.getvalue())
        output.write("\n")
    
    # Write add/alter/drop columns if needed
    if j2_cols_ad_alter_drop.getvalue():
        output.write("--Adding, Altering and dropping columns---------------------------------------------------------------\n")
        output.write(j2_cols_ad_alter_drop.getvalue())
        output.write("\n")
    
    # Script data
    script_data(
        db_info.conn_str,
        db_info.src_db_type,
        tbl_ents,
        output,
        schema_tables,
        script_ops
    )
    
    # Write not null alter columns if needed (after getting data)
    got_data = True  # This should be set based on the script_data function result
    if got_data and j2_alter_cols_not_null.getvalue():
        output.write("--Once got data, some columns may be changed to NOT NULL-----------------------------------------------\n")
        output.write(j2_alter_cols_not_null.getvalue())
        output.write("\n")
    
    # Write defaults add if needed
    if j2_defaults_add.getvalue():
        output.write("--Adding Defaults---------------------------------------------------------------\n")
        output.write(j2_defaults_add.getvalue())
        output.write("\n")
    
    # Write data checks (pre-adding constraints) if needed
    if bad_data_pre_add_indx.getvalue() or bad_data_pre_add_fk.getvalue():
        output.write("--Pre-adding constraints data checks: now got final data (whether data was scripted or not) time to do the checks-----------------------\n")
        if bad_data_pre_add_indx.getvalue():
            output.write(bad_data_pre_add_indx.getvalue())
            output.write("\n")
        if bad_data_pre_add_fk.getvalue():
            output.write(bad_data_pre_add_fk.getvalue())
            output.write("\n")
    
    # Write check constraints add if needed
    if j2_ccs_add.getvalue():
        output.write("--Adding Check Constraints---------------------------------------------------------------\n")
        output.write(j2_ccs_add.getvalue())
        output.write("\n")
    
    # Write index post-add if needed
    if j2_index_post_add.getvalue():
        output.write("--Post-Adding Indexes (some might have been dropped before)---------------------------------------------------------------\n")
        output.write(j2_index_post_add.getvalue())
        output.write("\n")
    
    # Write FK post-add if needed
    if j2_fk_post_add.getvalue():
        output.write("--Post-Adding Foreign Keys (some might be added later)---------------------------------------------------------------\n")
        output.write(j2_fk_post_add.getvalue())
        output.write("\n")
    
    # Skip to label
    # Label: SkipTillGotFullTablesData in VB.NET
    
    # Write coded entities if needed
    if j2_coded_ents.getvalue():
        output.write("--Coded Entities---------------------------------------------------------------\n")
        output.write(j2_coded_ents.getvalue())
        output.write("\n")
    
    # Write enable/disable entities if needed
    if enable_disable_ents.getvalue():
        output.write("--Enabling and Disabling Entities----------------------------------------------------------------\n")
        output.write(enable_disable_ents.getvalue())
        output.write("\n")
    
    # Write drop tables if needed
    if drop_tables.getvalue():
        output.write("--Dropping Tables-------------------------------------------------------------------------\n")
        output.write(drop_tables.getvalue())
        output.write("\n")
    
    # Write drop role members if needed
    if drop_role_members.getvalue():
        output.write("--Dropping Role Memberships-----------------------------------------------------\n")
        output.write(drop_role_members.getvalue())
        output.write("\n")
    
    # Write drop permissions if needed
    if drop_permissions.getvalue():
        output.write("--Dropping Permissions-----------------------------------------------------\n")
        output.write(drop_permissions.getvalue())
        output.write("\n")
    
    # Write drop principals if needed
    if drop_principals.getvalue():
        output.write("--Dropping Principals (users, roles)---------------------------------------------------\n")
        output.write(drop_principals.getvalue())
        output.write("\n")
    
    # Add transaction commit if needed
    if script_ops.as_transaction:
        append_commit_changes(output)
    
    # Label: EndOfScript in VB.NET
    
    # Database-specific cleanup
    if db_info.dst_db_type == E_DBType.PostgreSQL:
        output.write("END; --overall code\n")
        output.write("$$\n")
        output.write(";SELECT * FROM scriptoutput\n")
    elif db_info.dst_db_type == E_DBType.MSSQL:
        output.write("SET NOCOUNT OFF\n")
    
    return output


def create_db_state_temp_tables_for_tables(
    db_type: E_DBType,
    tbl_ents: pd.DataFrame,
    script_ops: ScriptingOptions,
    schema_tables: Dict[str, Any],
    scripting_data: bool = False,
    script_table_ops: Optional[ScriptTableOptions] = None,
    pre_add_constraints_data_checks: bool = False
) -> StringIO:
    """
    Create database state temporary tables for tables
    
    Args:
        db_type: Database type
        tbl_ents: Entities table
        script_ops: Scripting options
        schema_tables: Schema tables information
        scripting_data: Whether data is being scripted
        script_table_ops: Script table options
        pre_add_constraints_data_checks: Whether to perform data checks before adding constraints
        
    Returns:
        StringIO with generated script
    """
    script_db_state_tables = StringIO()
    
    # Filter for tables to script
    got_rndph_tables = False  # You would need to determine this
    filter_if_got_rndph = "" if not got_rndph_tables else " and rndphentkey is null"
    mask = (tbl_ents['scriptschema'] == True) & (tbl_ents['enttype'] == 'Table')
    
    if filter_if_got_rndph:
        mask = mask & tbl_ents['rndphentkey'].isna()
    
    rows_tables_script = tbl_ents[mask].sort_values('scriptsortorder')
    
    # Prepare lists of tables we're working with
    table_schema_name_in_scripting = StringIO()
    overall_table_schema_name_in_scripting = StringIO()
    
    for i, row in enumerate(rows_tables_script.itertuples()):
        if db_type == E_DBType.MSSQL:
            table_schema_name = f"'{row.entschema}{row.entname}'"
            overall_table_schema_name = f"'{row.entschema}{row.entname}'"
        elif db_type == E_DBType.PostgreSQL:
            table_schema_name = f"'{row.entschema.lower()}{row.entname.lower()}'"
            overall_table_schema_name = f"'{row.entschema.lower()}{row.entname.lower()}'"
        
        table_schema_name_in_scripting.write(table_schema_name)
        overall_table_schema_name_in_scripting.write(overall_table_schema_name)
        
        if i < len(rows_tables_script) - 1:
            table_schema_name_in_scripting.write(",")
            overall_table_schema_name_in_scripting.write(",")
    
    # Handle Randolph tables if present
    rndph_table_key_in = StringIO()
    rndph_table_schema_name_in_scripting = StringIO()
    
    if got_rndph_tables:
        rndph_mask = (tbl_ents['scriptschema'] == True) & (tbl_ents['rndphentkey'].str.startswith('T', na=False))
        rows_rndph_ent_tables = tbl_ents[rndph_mask]
        
        if overall_table_schema_name_in_scripting.getvalue() and len(rows_rndph_ent_tables) > 0:
            overall_table_schema_name_in_scripting.write(",")
        
        for i, row in enumerate(rows_rndph_ent_tables.itertuples()):
            rndph_table_key_in.write(row.entkey[1:])  # Substring starting at index 1
            rndph_table_schema_name = f"'{row.entschema}{row.entname}'"
            
            rndph_table_schema_name_in_scripting.write(rndph_table_schema_name)
            overall_table_schema_name_in_scripting.write(rndph_table_schema_name)
            
            if i < len(rows_rndph_ent_tables) - 1:
                rndph_table_key_in.write(",")
                rndph_table_schema_name_in_scripting.write(",")
                overall_table_schema_name_in_scripting.write(",")
    
    # Start DB state temp tables section
    script_db_state_tables.write("--DB State Temp Tables for Tables\n")
    
    # Get all tables for scripting
    all_tables_mask = (tbl_ents['scriptschema'] == True) & (tbl_ents['enttype'] == 'Table')
    all_tables_script = tbl_ents[all_tables_mask].sort_values('scriptsortorder')
    
    # Create temp tables for state tracking
    bad_data_pre_add_indx = StringIO()
    bad_data_pre_add_fk = StringIO()
    
    # Create DB state tables
    create_db_state_tables(
        script_db_state_tables,
        all_tables_script,
        db_type,
        schema_tables,
        got_rndph_tables,
        rndph_table_schema_name_in_scripting.getvalue(),
        script_ops.rndph_conn_str,
        rndph_table_key_in.getvalue(),
        script_ops.instance_id,
        script_ops.rndph_db_id
    )
    
    # Create DB state columns
    create_db_state_columns(
        script_db_state_tables,
        table_schema_name_in_scripting.getvalue(),
        rndph_table_key_in.getvalue(),
        overall_table_schema_name_in_scripting.getvalue(),
        db_type,
        schema_tables,
        script_ops.rndph_conn_str,
        script_ops.instance_id,
        script_ops.rndph_db_id
    )
    
    # Create DB state defaults
    create_db_state_defaults(
        script_db_state_tables,
        table_schema_name_in_scripting.getvalue(),
        rndph_table_key_in.getvalue(),
        overall_table_schema_name_in_scripting.getvalue(),
        db_type,
        schema_tables,
        script_ops.rndph_conn_str,
        script_ops.instance_id,
        script_ops.rndph_db_id
    )
    
    # Create DB state check constraints (MSSQL only)
    if db_type == E_DBType.MSSQL:
        create_db_state_check_constraints(
            script_db_state_tables,
            table_schema_name_in_scripting.getvalue(),
            rndph_table_key_in.getvalue(),
            overall_table_schema_name_in_scripting.getvalue(),
            db_type,
            schema_tables,
            script_ops.rndph_conn_str,
            script_ops.instance_id,
            script_ops.rndph_db_id
        )
    
    # Create DB state indexes
    create_db_state_indexes(
        script_db_state_tables,
        table_schema_name_in_scripting.getvalue(),
        rndph_table_key_in.getvalue(),
        overall_table_schema_name_in_scripting.getvalue(),
        db_type,
        schema_tables,
        script_ops.pre_add_constraints_data_checks,
        bad_data_pre_add_indx,
        script_ops.rndph_conn_str,
        script_ops.instance_id,
        script_ops.rndph_db_id
    )
    
    # Create DB state foreign keys
    create_db_state_fks(
        script_db_state_tables,
        table_schema_name_in_scripting.getvalue(),
        rndph_table_key_in.getvalue(),
        overall_table_schema_name_in_scripting.getvalue(),
        db_type,
        schema_tables,
        script_ops.pre_add_constraints_data_checks,
        script_ops.remove_all_extra_ents,
        bad_data_pre_add_fk,
        script_ops.rndph_conn_str,
        script_ops.instance_id,
        script_ops.rndph_db_id
    )
    
    script_db_state_tables.write("--End DB State Temp Tables for Tables\n")
    
    return script_db_state_tables


# Helper functions

def generate_pre_drop_post_add_indexes_fks(
    db_type: E_DBType,
    j2_index_pre_drop: StringIO,
    j2_index_post_add: StringIO,
    j2_fk_pre_drop: StringIO,
    j2_fk_post_add: StringIO,
    pre_add_constraints_data_checks: bool
):
    """Generate pre-drop and post-add scripts for indexes and foreign keys"""
    # Implementation would go here
    pass


def generate_add_alter_drop_cols(
    db_type: E_DBType,
    j2_cols_ad_alter_drop: StringIO,
    j2_alter_cols_not_null: StringIO
):
    """Generate scripts for adding, altering, and dropping columns"""
    # Implementation would go here
    pass


def generate_drop_add_defaults(
    db_type: E_DBType,
    j2_defaults_drop: StringIO,
    j2_defaults_add: StringIO
):
    """Generate scripts for dropping and adding defaults"""
    # Implementation would go here
    pass


def generate_drop_add_cc(
    db_type: E_DBType,
    j2_ccs_drop: StringIO,
    j2_ccs_add: StringIO
):
    """Generate scripts for dropping and adding check constraints"""
    # Implementation would go here
    pass


def generate_add_tables(
    db_type: E_DBType,
    add_tables: StringIO
):
    """Generate scripts for adding tables"""
    # Implementation would go here
    pass


def generate_drop_tables(
    db_type: E_DBType,
    drop_tables: StringIO
):
    """Generate scripts for dropping tables"""
    # Implementation would go here
    pass


def generate_coded_ents(
    db_type: E_DBType,
    j2_coded_ents: StringIO,
    script_ops: ScriptingOptions
):
    """Generate scripts for coded entities"""
    # Implementation would go here
    pass


def script_data(
    conn_str: str,
    src_db_type: E_DBType,
    tbl_ents: pd.DataFrame,
    output: StringIO,
    schema_tables: Dict[str, Any],
    script_ops: ScriptingOptions
):
    """Generate scripts for data"""
    # Implementation would go here
    pass


def append_commit_changes(output: StringIO):
    """Append transaction commit statements"""
    # Implementation would go here
    pass


def create_db_state_tables(
    output: StringIO,
    tbl_ents_to_script: pd.DataFrame,
    db_type: E_DBType,
    schema_tables: Dict[str, Any],
    got_rndph_tables: bool,
    rndph_table_schema_name_in_scripting: str,
    rndph_conn_str: str,
    rndph_table_key_in: str,
    instance_id: str,
    rndph_db_id: str
):
    """Create DB state tables"""
    # Implementation would go here
    pass


def create_db_state_columns(
    output: StringIO,
    table_schema_name_in_scripting: str,
    rndph_table_key_in: str,
    overall_table_schema_name_in_scripting: str,
    db_type: E_DBType,
    schema_tables: Dict[str, Any],
    rndph_conn_str: str,
    instance_id: str,
    rndph_db_id: str
):
    """Create DB state columns"""
    # Implementation would go here
    pass


def create_db_state_defaults(
    output: StringIO,
    table_schema_name_in_scripting: str,
    rndph_table_key_in: str,
    overall_table_schema_name_in_scripting: str,
    db_type: E_DBType,
    schema_tables: Dict[str, Any],
    rndph_conn_str: str,
    instance_id: str,
    rndph_db_id: str
):
    """Create DB state defaults"""
    # Implementation would go here
    pass


def create_db_state_check_constraints(
    output: StringIO,
    table_schema_name_in_scripting: str,
    rndph_table_key_in: str,
    overall_table_schema_name_in_scripting: str,
    db_type: E_DBType,
    schema_tables: Dict[str, Any],
    rndph_conn_str: str,
    instance_id: str,
    rndph_db_id: str
):
    """Create DB state check constraints"""
    # Implementation would go here
    pass


def create_db_state_indexes(
    output: StringIO,
    table_schema_name_in_scripting: str,
    rndph_table_key_in: str,
    overall_table_schema_name_in_scripting: str,
    db_type: E_DBType,
    schema_tables: Dict[str, Any],
    pre_add_constraints_data_checks: bool,
    bad_data_pre_add_indx: StringIO,
    rndph_conn_str: str,
    instance_id: str,
    rndph_db_id: str
):
    """Create DB state indexes"""
    # Implementation would go here
    pass


def create_db_state_fks(
    output: StringIO,
    table_schema_name_in_scripting: str,
    rndph_table_key_in: str,
    overall_table_schema_name_in_scripting: str,
    db_type: E_DBType,
    schema_tables: Dict[str, Any],
    pre_add_constraints_data_checks: bool,
    remove_all_extra_ents: bool,
    bad_data_pre_add_fk: StringIO,
    rndph_conn_str: str,
    instance_id: str,
    rndph_db_id: str
):
    """Create DB state foreign keys"""
    # Implementation would go here
    pass


def get_table_names_to_script(tbl_ents: pd.DataFrame) -> str:
    """
    Generate a comma-separated string of table names for scripting
    
    Args:
        tbl_ents: Entities table
        
    Returns:
        Comma-separated string of table names
    """
    mask = (tbl_ents['scriptschema'] == True) & (tbl_ents['enttype'] == 'Table')
    tables = tbl_ents[mask]
    
    table_names = []
    for _, row in tables.iterrows():
        table_names.append(f"'{row['entschema']}{row['entname']}'")
    
    return ','.join(table_names)