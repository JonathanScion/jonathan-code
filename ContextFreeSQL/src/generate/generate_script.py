from io import StringIO
from src.data_load.from_db.load_from_db_pg import DBSchema
from src.defs.script_defs import DBType, DBSyntax, ScriptingOptions
from src.generate.generate_db_ent_types.schemas import create_db_state_schemas
from src.generate.generate_db_ent_types.generate_state_tables.tables import create_db_state_temp_tables_for_tables
import pandas as pd
from src.generate.generate_final_indexes_fks import generate_pre_drop_post_add_indexes_fks

def generate_all_script(schema_tables: DBSchema, db_type: DBType, tbl_ents: pd.DataFrame, scrpt_ops: ScriptingOptions) -> str:
    db_syntax = DBSyntax.get_syntax(db_type)
    buffer = StringIO()

    if db_type == DBType.PostgreSQL:
        buffer.write("DO $$\n")
        buffer.write("BEGIN --overall code\n") #!see old_sample_out.sql: the BEGIN is after all declarations (after <buffer.write(f"\tDECLARE {db_syntax.var_prefix}sqlCode> below)

    # 1. Add header
    header = build_script_header(db_syntax = db_syntax, scrpt_ops = scrpt_ops, filename = 'theSome.sql')
    buffer.write(header)
    buffer.write(f"\tDECLARE {db_syntax.var_prefix}sqlCode {db_syntax.nvarchar_type} {db_syntax.max_length_str} {db_syntax.declare_separator} {db_syntax.var_prefix}schemaChanged {db_syntax.boolean_type} {db_syntax.set_operator} False;\n")
    buffer.write("\tBEGIN --the code\n")
    buffer.write("\tperform n.nspname, c.relname\n")
    buffer.write("\tFROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace\n")
    buffer.write("\tWHERE n.nspname LIKE 'pg_temp_%' AND c.relname='scriptoutput' AND pg_catalog.pg_table_is_visible(c.oid);\n")
    buffer.write("\tIF FOUND THEN\n")
    buffer.write("\t\tDROP TABLE scriptoutput;\n")
    buffer.write("\tEND IF;\n")
    buffer.write("\tCREATE TEMP TABLE scriptoutput\n")
    buffer.write("\t(\n")
    buffer.write("\t\tSQLText character varying\n")
    buffer.write("\t);\n")
   
    
    # 2. State tables
    # bOnlyData = tblEnts.Select("ScriptSchema=False AND ScriptData=True").Length > 0
    # if oScriptOps.ScriptSchemas and (not bOnlyData):
    schemas_buffer = create_db_state_schemas(db_type, schema_tables.tables, schema_tables.schemas , scrpt_ops.all_schemas, scrpt_ops.remove_all_extra_ents)
    buffer.write(schemas_buffer.getvalue())
    tables_buffer: StringIO = create_db_state_temp_tables_for_tables(
            db_type = db_type,
            tbl_ents = tbl_ents,
            script_ops = scrpt_ops,
            schema_tables = schema_tables
        )
    buffer.write(tables_buffer.getvalue())

    #!here will 
    #create_db_state_temp_tables_for_coded (CreateDBStateTempTables_ForCoded)
    

    # Create StringBuilders for schema objects
    #!reactivate this when doing security
    """
    create_principals = StringIO()
    drop_principals = StringIO()
    create_role_members = StringIO()
    drop_role_members = StringIO()
    create_permissions = StringIO()
    drop_permissions = StringIO()
    """

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

    generate_pre_drop_post_add_indexes_fks(db_type = db_type, j2_index_pre_drop  =j2_index_pre_drop, j2_index_post_add = j2_index_post_add, 
                                          j2_fk_pre_drop=j2_fk_pre_drop, j2_fk_post_add=j2_fk_post_add, 
                                          pre_add_constraints_data_checks = scrpt_ops.pre_add_constraints_data_checks)

    
  
    # Bad data check StringBuilders
    bad_data_pre_add_indx = StringIO()
    bad_data_pre_add_fk = StringIO()
    
    # Write script header to buffer
    #reactivate below when got security (of coure, security will now be built from the ground up around pg)
    """
    # Write principals if needed
    if create_principals.getvalue():
        buffer.write("--Creating Principals (users)-----------------------------------------------------\n")
        buffer.write(create_principals.getvalue())
        buffer.write("\n")
    
    # Write role members if needed
    if create_role_members.getvalue():
        buffer.write("--Creating Role Memberships-----------------------------------------------------\n")
        buffer.write(create_role_members.getvalue())
        buffer.write("\n")
    
    # Write permissions if needed
    if create_permissions.getvalue():
        buffer.write("--Creating Permissions-----------------------------------------------------\n")
        buffer.write(create_permissions.getvalue())
        buffer.write("\n")
    """
    
    # Write schemas if needed
    if create_schemas.getvalue():
        buffer.write("--Creating Schemas----------------------------------------------------------------\n")
        buffer.write(create_schemas.getvalue())
        buffer.write("\n")

    
    # Write DB state tables
    buffer.write(script_db_state_tables.getvalue())
    buffer.write("\n")
    
    # Write add tables if needed
    if add_tables.getvalue():
        buffer.write("--Adding Tables--------------------------------------------------------------------\n")
        buffer.write(add_tables.getvalue())
        buffer.write("\n")
    
    # Write post-data column alters if needed
    if col_alters_post_data.getvalue():
        buffer.write("--Column Changes Once We Got Data--------------------------------------------------------------------\n")
        buffer.write(col_alters_post_data.getvalue())
        buffer.write("\n")
    
    # Write drop schemas if needed
    if drop_schemas.getvalue():
        buffer.write("--Dropping Extra Schemas----------------------------------------------------------------\n")
        buffer.write(drop_schemas.getvalue())
        buffer.write("\n")
    
    # Write FK pre-drop if needed
    if j2_fk_pre_drop.getvalue():
        buffer.write("--Pre-Dropping Foreign keys (some might be added later)---------------------------------------------------------------\n")
        buffer.write(j2_fk_pre_drop.getvalue())
        buffer.write("\n")
    
    # Write index pre-drop if needed
    if j2_index_pre_drop.getvalue():
        buffer.write("--Pre-Dropping Indexes (some might be added later)---------------------------------------------------------------\n")
        buffer.write(j2_index_pre_drop.getvalue())
        buffer.write("\n")
    
    # Write defaults drop if needed
    if j2_defaults_drop.getvalue():
        buffer.write("--Dropping Defaults (some might be added later)---------------------------------------------------------------\n")
        buffer.write(j2_defaults_drop.getvalue())
        buffer.write("\n")
    
    # Write check constraints drop if needed
    if j2_ccs_drop.getvalue():
        buffer.write("--Dropping Check Constraints (some might be added later)---------------------------------------------------------------\n")
        buffer.write(j2_ccs_drop.getvalue())
        buffer.write("\n")
    
    # Write add/alter/drop columns if needed
    if j2_cols_ad_alter_drop.getvalue():
        buffer.write("--Adding, Altering and dropping columns---------------------------------------------------------------\n")
        buffer.write(j2_cols_ad_alter_drop.getvalue())
        buffer.write("\n")
    
    #! Script data
    #go over .net code at this point, see whats going on, convert yada yada
    """
    script_data(
        db_info.conn_str,
        db_type,
        tbl_ents,
        buffer,
        schema_tables,
        script_ops
    )"""
    
    # Write not null alter columns if needed (after getting data)
    got_data = True  # This should be set based on the script_data function result
    if got_data and j2_alter_cols_not_null.getvalue():
        buffer.write("--Once got data, some columns may be changed to NOT NULL-----------------------------------------------\n")
        buffer.write(j2_alter_cols_not_null.getvalue())
        buffer.write("\n")
    
    # Write defaults add if needed
    if j2_defaults_add.getvalue():
        buffer.write("--Adding Defaults---------------------------------------------------------------\n")
        buffer.write(j2_defaults_add.getvalue())
        buffer.write("\n")
    
    # Write data checks (pre-adding constraints) if needed
    if bad_data_pre_add_indx.getvalue() or bad_data_pre_add_fk.getvalue():
        buffer.write("--Pre-adding constraints data checks: now got final data (whether data was scripted or not) time to do the checks-----------------------\n")
        if bad_data_pre_add_indx.getvalue():
            buffer.write(bad_data_pre_add_indx.getvalue())
            buffer.write("\n")
        if bad_data_pre_add_fk.getvalue():
            buffer.write(bad_data_pre_add_fk.getvalue())
            buffer.write("\n")
    
    # Write check constraints add if needed
    if j2_ccs_add.getvalue():
        buffer.write("--Adding Check Constraints---------------------------------------------------------------\n")
        buffer.write(j2_ccs_add.getvalue())
        buffer.write("\n")
    
    # Write index post-add if needed
    if j2_index_post_add.getvalue():
        buffer.write("--Post-Adding Indexes (some might have been dropped before)---------------------------------------------------------------\n")
        buffer.write(j2_index_post_add.getvalue())
        buffer.write("\n")
    
    # Write FK post-add if needed
    if j2_fk_post_add.getvalue():
        buffer.write("--Post-Adding Foreign Keys (some might be added later)---------------------------------------------------------------\n")
        buffer.write(j2_fk_post_add.getvalue())
        buffer.write("\n")
    
    # Skip to label
    # Label: SkipTillGotFullTablesData in VB.NET
    
    # Write coded entities if needed
    if j2_coded_ents.getvalue():
        buffer.write("--Coded Entities---------------------------------------------------------------\n")
        buffer.write(j2_coded_ents.getvalue())
        buffer.write("\n")
    
    # Write enable/disable entities if needed
    if enable_disable_ents.getvalue():
        buffer.write("--Enabling and Disabling Entities----------------------------------------------------------------\n")
        buffer.write(enable_disable_ents.getvalue())
        buffer.write("\n")
    
    # Write drop tables if needed
    if drop_tables.getvalue():
        buffer.write("--Dropping Tables-------------------------------------------------------------------------\n")
        buffer.write(drop_tables.getvalue())
        buffer.write("\n")
    
    # Write drop role members if needed
    if drop_role_members.getvalue():
        buffer.write("--Dropping Role Memberships-----------------------------------------------------\n")
        buffer.write(drop_role_members.getvalue())
        buffer.write("\n")
    
    # Write drop permissions if needed
    if drop_permissions.getvalue():
        buffer.write("--Dropping Permissions-----------------------------------------------------\n")
        buffer.write(drop_permissions.getvalue())
        buffer.write("\n")
    
    # Write drop principals if needed
    if drop_principals.getvalue():
        buffer.write("--Dropping Principals (users, roles)---------------------------------------------------\n")
        buffer.write(drop_principals.getvalue())
        buffer.write("\n")
    
    # Add transaction commit if needed
    if script_ops.as_transaction:
        append_commit_changes(buffer)
    
    # Label: EndOfScript in VB.NET
    
    # Database-specific cleanup
    if db_type == DBType.PostgreSQL:
        buffer.write("END; --overall code\n")
        buffer.write("$$\n")
        buffer.write(";SELECT * FROM scriptoutput\n")
    elif db_type == DBType.MSSQL:
        buffer.write("SET NOCOUNT OFF\n")
    
    #end out buffer
    if db_type == DBType.PostgreSQL:
        buffer.write("END; --overall code\n")  # close all openings of PG code
        buffer.write("$$\n")
        buffer.write(";select * from scriptoutput\n")

    elif db_type == DBType.MSSQL:
        buffer.write("SET NOCOUNT OFF\n")

    # Get final string and clean up
    result = buffer.getvalue()
    buffer.close()
    
    return result


def build_script_header(db_syntax: DBSyntax, scrpt_ops: ScriptingOptions, filename: str) -> str:   
    header = StringIO()
    
    # Write header lines
    header.write("------------------------Context Free Script------------------------------------------\n")
    header.write("--Parameters: @print: PRINT english description of what the script is doing\n")
    header.write("--            @printExec: PRINT the SQL statements the script generates\n")
    header.write("--            @execCode: EXECUTE the script on the database\n")
    header.write("\n")
    header.write("--feel free to change these flags\n")
    
    # Write variable declarations
    header.write(f"\tDECLARE {db_syntax.var_prefix}print {db_syntax.boolean_type} ")
    header.write(f"\t{db_syntax.set_operator} 1{db_syntax.declare_separator} \n")
    header.write(f"\t\t{db_syntax.var_prefix}printExec {db_syntax.boolean_type} ")
    header.write(f"\t{db_syntax.set_operator} 1{db_syntax.declare_separator} \n")
    header.write(f"\t\t{db_syntax.var_prefix}execCode {db_syntax.boolean_type} ")
    header.write(f"\t{db_syntax.set_operator} 1;\n")
    header.write("-------------------------------------------------------------------------------------\n")
    header.write("\n")

     # Add additional variable declarations
    header.write(f"DECLARE {db_syntax.var_prefix}table_schema {db_syntax.nvarchar_type} (128);\n")
    header.write(f"DECLARE {db_syntax.var_prefix}table_name {db_syntax.nvarchar_type} (128);\n")
    header.write(f"DECLARE {db_syntax.var_prefix}index_name {db_syntax.nvarchar_type} (128);\n")
    header.write(f"DECLARE {db_syntax.var_prefix}fk_name {db_syntax.nvarchar_type} (128);\n")
    header.write(f"DECLARE {db_syntax.var_prefix}col_name {db_syntax.nvarchar_type} (128);\n")
    header.write(f"DECLARE {db_syntax.var_prefix}user_type_name {db_syntax.nvarchar_type} (128);\n")
    header.write(f"DECLARE {db_syntax.var_prefix}max_length smallint;\n")
    header.write(f"DECLARE {db_syntax.var_prefix}precision smallint;\n")
    header.write(f"DECLARE {db_syntax.var_prefix}scale smallint;\n")
    header.write(f"DECLARE {db_syntax.var_prefix}is_nullable bit;\n")
    header.write(f"DECLARE {db_syntax.var_prefix}is_identity bit;\n")
    header.write(f"DECLARE {db_syntax.var_prefix}is_computed bit;\n")
    header.write(f"DECLARE {db_syntax.var_prefix}collation_name {db_syntax.nvarchar_type} (128);\n")
    header.write(f"DECLARE {db_syntax.var_prefix}computed_definition {db_syntax.nvarchar_type} {db_syntax.max_length_str};\n")
    header.write(f"DECLARE {db_syntax.var_prefix}SQL_CREATE {db_syntax.nvarchar_type} {db_syntax.max_length_str};\n")
    header.write(f"DECLARE {db_syntax.var_prefix}SQL_ALTER {db_syntax.nvarchar_type} {db_syntax.max_length_str};\n")
    header.write(f"DECLARE {db_syntax.var_prefix}SQL_DROP {db_syntax.nvarchar_type} {db_syntax.max_length_str};\n")
    header.write(f"DECLARE {db_syntax.var_prefix}diff_descr {db_syntax.nvarchar_type} {db_syntax.max_length_str};\n")
    header.write(f"DECLARE {db_syntax.var_prefix}ent_type {db_syntax.nvarchar_type} (25);\n")

     # Add conditional variable declaration
    if hasattr(db_syntax, 'pre_add_constraints_data_checks') and scrpt_ops.pre_add_constraints_data_checks:
        header.write(f"DECLARE {db_syntax.var_prefix}GotBadData {db_syntax.boolean_type}; --for data checks, before adding\reactivating idnexes and constraints\n")
   
    
    
    # Get content and clean up
    header_content = header.getvalue()
    header.close()
    
    # Write to file
    with open(filename, 'w') as f:
        f.write(header_content)
    
    return header_content