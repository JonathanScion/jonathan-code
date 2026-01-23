from io import StringIO
import os
import pandas as pd
from src.data_load.from_db.load_from_db_pg import DBSchema
from src.defs.script_defs import DBType, DBSyntax, ScriptingOptions, InputOutput, ListTables, SQLScriptParams
from src.generate.generate_db_ent_types.schemas import create_db_state_schemas
from src.generate.generate_db_ent_types.generate_state_tables.tables import create_db_state_temp_tables_for_tables
from src.generate.generate_db_ent_types.generate_state_tables.coded import create_db_state_temp_tables_for_coded
from src.utils import code_funcs

from src.generate.generate_final_indexes_fks import generate_pre_drop_post_add_indexes_fks
from src.generate.generate_final_tables import generate_add_tables, generate_drop_tables
from src.generate.generate_final_columns import generate_add_alter_drop_cols
from src.generate.generate_final_data import script_data
from src.generate.generate_final_coded_ents import generate_drop_coded_ents, generate_add_coded_ents
from src.generate.generate_final_html_report  import generate_html_report
from src.generate.generate_final_code_diffs import generate_code_diffs
from src.generate.generate_final_security import (
    generate_security_state_tables, generate_security_inserts, generate_security_state_updates,
    generate_create_roles, generate_grant_table_permissions,
    generate_grant_function_permissions, generate_revoke_and_drop_extra_security
)

#core proc for this whole app
def generate_all_script(schema_tables: DBSchema, db_type: DBType, tbl_ents: pd.DataFrame, scrpt_ops: ScriptingOptions, input_output: InputOutput, got_specific_tables: bool, tables_data: ListTables | None = None, sql_script_params: SQLScriptParams | None = None) -> str:
    db_syntax = DBSyntax.get_syntax(db_type)
    buffer = StringIO()

    # Use default SQLScriptParams if not provided
    if sql_script_params is None:
        sql_script_params = SQLScriptParams()

    if db_type == DBType.PostgreSQL:
        buffer.write("DO $$\n")

    # 1. Add header
    script_filename = os.path.basename(input_output.output_sql)
    # Determine if file-based features are needed (for basePath variable)
    needs_base_path = (
        sql_script_params.html_report or
        sql_script_params.export_csv or
        (tables_data is not None and tables_data.from_file)
    )
    # Get base path for CSV files (directory where HTML output goes)
    base_path = os.path.dirname(input_output.html_output_path).replace("\\", "/") if (needs_base_path and input_output.html_output_path) else ""
    header = build_script_header(db_syntax=db_syntax, scrpt_ops=scrpt_ops, sql_script_params=sql_script_params, filename=script_filename, base_path=base_path, include_base_path=needs_base_path)
    buffer.write(header)

    buffer.write(f"\tDECLARE {db_syntax.var_prefix}sqlCode {db_syntax.nvarchar_type} {db_syntax.max_length_str} {db_syntax.declare_separator} {db_syntax.var_prefix}schemaChanged {db_syntax.boolean_type} {db_syntax.set_operator} False;\n")
    if db_type == DBType.PostgreSQL:
        buffer.write("BEGIN --main DO block\n")

    buffer.write("\tBEGIN --script initialization and execution\n")
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
    create_schemas, drop_schemas = create_db_state_schemas(db_type, schema_tables.tables, schema_tables.schemas , scrpt_ops.all_schemas, scrpt_ops.remove_all_extra_ents)
    

    script_db_state_tables: StringIO = create_db_state_temp_tables_for_tables(
            db_type = db_type,
            tbl_ents = tbl_ents,
            script_ops = scrpt_ops,
            schema_tables = schema_tables,
            got_specific_tables = got_specific_tables
        )

    
    script_db_state_coded: StringIO = create_db_state_temp_tables_for_coded( #CreateDBStateTempTables_ForCoded
            db_type = db_type,
            tbl_ents = tbl_ents,
            script_ops = scrpt_ops,
            schema_tables = schema_tables
        )
    
    buffer.write("\t--Iterate tables, generate all code----------------\n")

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
    j2_cols_add_alter_drop = StringIO()
    j2_alter_cols_not_null = StringIO()
    j2_defaults_drop = StringIO()
    j2_defaults_add = StringIO()
    j2_ccs_drop = StringIO()
    j2_ccs_add = StringIO()
    drop_tables = StringIO()
    add_tables = StringIO()
    drop_coded_ents = StringIO()  # DROP views/functions BEFORE column changes
    add_coded_ents = StringIO()   # CREATE views/functions AFTER column changes
    html_report = StringIO()

    generate_pre_drop_post_add_indexes_fks(db_type = db_type, j2_index_pre_drop  =j2_index_pre_drop, j2_index_post_add = j2_index_post_add,
                                          j2_fk_pre_drop=j2_fk_pre_drop, j2_fk_post_add=j2_fk_post_add,
                                          pre_add_constraints_data_checks = scrpt_ops.pre_add_constraints_data_checks)
    if scrpt_ops.remove_all_extra_ents:
        generate_drop_tables(db_type=db_type, sql_buffer=drop_tables)
    generate_add_tables(db_type=db_type, sql_buffer=add_tables)
    generate_add_alter_drop_cols(db_type=db_type, sql_buffer=j2_cols_add_alter_drop, j2_alter_cols_not_null=j2_alter_cols_not_null)
    # Split coded entities: DROP before columns, CREATE after columns
    generate_drop_coded_ents(db_type=db_type, sql_buffer=drop_coded_ents, remove_all_extra_ents = scrpt_ops.remove_all_extra_ents, got_specific_tables = got_specific_tables)
    generate_add_coded_ents(db_type=db_type, sql_buffer=add_coded_ents, got_specific_tables = got_specific_tables)
    generate_html_report(db_type=db_type, sql_buffer=add_coded_ents, input_output=input_output)
    generate_code_diffs(db_type=db_type, sql_buffer=add_coded_ents, input_output=input_output)


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
        buffer.write("\t--Creating Schemas----------------------------------------------------------------\n")
        buffer.write(create_schemas.getvalue())
        buffer.write("\n\n")

    # Write DB state tables: for tables, for coded, for security. all state tables
    buffer.write(script_db_state_tables.getvalue())
    buffer.write("\n\n")
    buffer.write(script_db_state_coded.getvalue())
    buffer.write("\n\n")

    # Security state tables (if security scripting is enabled)
    if scrpt_ops.script_security:
        security_buffer = StringIO()
        generate_security_state_tables(db_type, security_buffer, schema_tables)
        # Get list of scripted tables for filtering permissions
        scripted_tables = None
        if got_specific_tables:
            scripted_tables = [f"{row['entschema']}.{row['entname']}" for _, row in tbl_ents[tbl_ents['enttype'] == 'Table'].iterrows()]
        generate_security_inserts(db_type, security_buffer, schema_tables, scripted_tables)
        generate_security_state_updates(db_type, security_buffer)
        buffer.write(security_buffer.getvalue())
        buffer.write("\n\n")

    # PHASE 1: Create roles (after security state tables, before tables)
    # Roles must exist before we can grant permissions to them
    if scrpt_ops.script_security:
        roles_buffer = StringIO()
        generate_create_roles(db_type, roles_buffer)
        if roles_buffer.getvalue():
            buffer.write(roles_buffer.getvalue())
            buffer.write("\n\n")

    # Write add tables if needed
    if add_tables.getvalue():
        buffer.write("\t--Adding Tables--------------------------------------------------------------------\n")
        buffer.write(add_tables.getvalue())
        buffer.write("\n\n")

    # PHASE 2: Grant table/column permissions (after tables exist)
    if scrpt_ops.script_security:
        table_perms_buffer = StringIO()
        generate_grant_table_permissions(db_type, table_perms_buffer)
        if table_perms_buffer.getvalue():
            buffer.write(table_perms_buffer.getvalue())
            buffer.write("\n\n")

    # Write post-data column alters if needed
    col_alters_post_data: StringIO = StringIO() #! there was a comment in .net: "some of the ALTER i do only after i got the data in. like changing to NULL... anything else?". but i dont see it used anywhere. remove.
    if col_alters_post_data.getvalue():
        buffer.write("\t--Column Changes Once We Got Data--------------------------------------------------------------------\n")
        buffer.write(col_alters_post_data.getvalue())
        buffer.write("\n\n")
    
    # Write drop schemas if needed
    if drop_schemas.getvalue():
        buffer.write("\t--Dropping Extra Schemas----------------------------------------------------------------\n")
        buffer.write(drop_schemas.getvalue())
        buffer.write("\n\n")
    
    # Write FK pre-drop if needed
    if j2_fk_pre_drop.getvalue():
        buffer.write("\t--Pre-Dropping Foreign keys (some might be added later)---------------------------------------------------------------\n")
        buffer.write(j2_fk_pre_drop.getvalue())
        buffer.write("\n\n")
    
    # Write index pre-drop if needed
    if j2_index_pre_drop.getvalue():
        buffer.write("\t--Pre-Dropping Indexes (some might be added later)---------------------------------------------------------------\n")
        buffer.write(j2_index_pre_drop.getvalue())
        buffer.write("\n\n")

    # Write DROP coded entities BEFORE column changes (views may depend on columns being dropped)
    if drop_coded_ents.getvalue():
        buffer.write("--Dropping Coded Entities (views, functions, etc.) - must happen before column changes-------\n")
        buffer.write(drop_coded_ents.getvalue())
        buffer.write("\n")

    # Write defaults drop if needed
    if j2_defaults_drop.getvalue():
        buffer.write("\t--Dropping Defaults (some might be added later)---------------------------------------------------------------\n")
        buffer.write(j2_defaults_drop.getvalue())
        buffer.write("\n\n")
    
    # Write check constraints drop if needed
    if j2_ccs_drop.getvalue():
        buffer.write("\t--Dropping Check Constraints (some might be added later)---------------------------------------------------------------\n")
        buffer.write(j2_ccs_drop.getvalue())
        buffer.write("\n\n")
    
    # Write add/alter/drop columns if needed
    if j2_cols_add_alter_drop.getvalue():
        buffer.write("\t--Adding, Altering and dropping columns---------------------------------------------------------------\n")
        buffer.write(j2_cols_add_alter_drop.getvalue())
        buffer.write("\n\n")
    
    scrpt_ops.data_scripting_generate_dml_statements = True #! test, remove
    #scrpt_ops.data_scripting_leave_report_fields_updated_save_old_value = True #! test, remove
    script_data(schema_tables = schema_tables, db_type=db_type, tbl_ents=tbl_ents, script_ops=scrpt_ops, out_buffer=buffer, db_syntax=db_syntax, input_output=input_output, tables_data=tables_data, sql_script_params=sql_script_params)
    
    # Write not null alter columns if needed (after getting data)
    got_data = True  # This should be set based on the script_data function result
    if got_data and j2_alter_cols_not_null.getvalue():
        buffer.write("\t--Once got data, some columns may be changed to NOT NULL-----------------------------------------------\n")
        buffer.write(j2_alter_cols_not_null.getvalue())
        buffer.write("\n\n")
    
    # Write defaults add if needed
    #!still need to implement defaults... is it part of columns?
    if j2_defaults_add.getvalue():
        buffer.write("\t--Adding Defaults---------------------------------------------------------------\n")
        buffer.write(j2_defaults_add.getvalue())
        buffer.write("\n\n")
    
    # Write data checks (pre-adding constraints) if needed
    if bad_data_pre_add_indx.getvalue() or bad_data_pre_add_fk.getvalue():
        buffer.write("\t--Pre-adding constraints data checks: now got final data (whether data was scripted or not) time to do the checks-----------------------\n")
        if bad_data_pre_add_indx.getvalue():
            buffer.write(bad_data_pre_add_indx.getvalue())
            buffer.write("\n\n")
        if bad_data_pre_add_fk.getvalue():
            buffer.write(bad_data_pre_add_fk.getvalue())
            buffer.write("\n\n")
    
    # Write check constraints add if needed
    if j2_ccs_add.getvalue():
        buffer.write("\t--Adding Check Constraints---------------------------------------------------------------\n")
        buffer.write(j2_ccs_add.getvalue())
        buffer.write("\n\n")
    
    # Write index post-add if needed
    if j2_index_post_add.getvalue():
        buffer.write("\t--Post-Adding Indexes (some might have been dropped before)---------------------------------------------------------------\n")
        buffer.write(j2_index_post_add.getvalue())
        buffer.write("\n\n")
    
    # Write FK post-add if needed
    if j2_fk_post_add.getvalue():
        buffer.write("\t--Post-Adding Foreign Keys (some might be added later)---------------------------------------------------------------\n")
        buffer.write(j2_fk_post_add.getvalue())
        buffer.write("\n\n")
    
    # Skip to label
    # Label: SkipTillGotFullTablesData in VB.NET
    
    # Write ADD coded entities (CREATE views/functions after column changes are complete)
    if add_coded_ents.getvalue():
        buffer.write("--Adding Coded Entities (views, functions, etc.)---------------------------------------------------------------\n")
        buffer.write(add_coded_ents.getvalue())
        buffer.write("\n")

    # PHASE 3: Grant function permissions (after coded entities exist)
    if scrpt_ops.script_security:
        func_perms_buffer = StringIO()
        generate_grant_function_permissions(db_type, func_perms_buffer)
        if func_perms_buffer.getvalue():
            buffer.write(func_perms_buffer.getvalue())
            buffer.write("\n\n")

    # Write HTML report if needed
    if html_report.getvalue():
        buffer.write("--HTML Report---------------------------------------------------------------\n")
        buffer.write(html_report.getvalue())
        buffer.write("\n")
    
    # Write enable/disable entities if needed
    #!reactivate
    """if enable_disable_ents.getvalue():
        buffer.write("--Enabling and Disabling Entities----------------------------------------------------------------\n")
        buffer.write(enable_disable_ents.getvalue())
        buffer.write("\n")"""
    
    # Write drop tables if needed
    if drop_tables.getvalue():
        buffer.write("\t--Dropping Tables-------------------------------------------------------------------------\n")
        buffer.write(drop_tables.getvalue())
        buffer.write("\n\n")

    # PHASE 4: Revoke extra permissions and drop extra roles (at the very end)
    # Must run after all objects are potentially dropped so roles can be safely removed
    if scrpt_ops.script_security:
        drop_security_buffer = StringIO()
        generate_revoke_and_drop_extra_security(db_type, drop_security_buffer, scrpt_ops.remove_all_extra_ents)
        if drop_security_buffer.getvalue():
            buffer.write(drop_security_buffer.getvalue())
            buffer.write("\n\n")

    # Write drop role members if needed
    #!reactivate
    """if drop_role_members.getvalue():
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
        buffer.write("\n")"""
    
    #end out buffer
    if db_type == DBType.PostgreSQL:
        buffer.write("END; --main DO block\n")
        buffer.write("$$\n")
        buffer.write(";select * from scriptoutput\n")

    elif db_type == DBType.MSSQL:
        buffer.write("SET NOCOUNT OFF\n")

    # Get final string and clean up
    result = buffer.getvalue()
    buffer.close()
    
    return result


def build_script_header(db_syntax: DBSyntax, scrpt_ops: ScriptingOptions, sql_script_params: SQLScriptParams, filename: str, base_path: str = "", include_base_path: bool = False) -> str:
    header = StringIO()

    # Helper to convert Python bool to SQL boolean value
    def bool_to_sql(val: bool) -> str:
        if db_syntax.boolean_true_value == "1":
            return "1" if val else "0"
        else:
            return "true" if val else "false"

    # Write header line
    header.write("------------------------Context Free Script------------------------------------------\n")
    header.write("--feel free to change these parameter flags to control script behavior\n")
    header.write("\n")

    # Write variable declarations with inline comments
    header.write(f"\tDECLARE {db_syntax.var_prefix}print {db_syntax.boolean_type} ")
    header.write(f"{db_syntax.set_operator} {bool_to_sql(sql_script_params.print)}{db_syntax.declare_separator} -- Print descriptions of what the script is doing\n")
    header.write(f"\t{db_syntax.var_prefix}printExec {db_syntax.boolean_type} ")
    header.write(f"{db_syntax.set_operator} {bool_to_sql(sql_script_params.print_exec)}{db_syntax.declare_separator} -- Print the SQL statements the script generates\n")
    header.write(f"\t{db_syntax.var_prefix}execCode {db_syntax.boolean_type} ")
    header.write(f"{db_syntax.set_operator} {bool_to_sql(sql_script_params.exec_code)}; -- Execute the SQL statements on the database\n")
    header.write(f"\t{db_syntax.var_prefix}htmlReport {db_syntax.boolean_type} ")
    header.write(f"{db_syntax.set_operator} {bool_to_sql(sql_script_params.html_report)}; -- Generate HTML comparison report for data differences\n")
    header.write(f"\t{db_syntax.var_prefix}exportCsv {db_syntax.boolean_type} ")
    header.write(f"{db_syntax.set_operator} {bool_to_sql(sql_script_params.export_csv)}; -- Export source/target data to CSV files\n")
    if include_base_path:
        header.write(f"\t{db_syntax.var_prefix}basePath TEXT ")
        header.write(f"{db_syntax.set_operator} '{base_path}'; -- Base path for CSV/HTML files. MODIFY THIS if you move the script!\n")
    header.write("\t-------------------------------------------------------------------------------------\n")
    header.write("\n")

    # Add additional variable declarations
    header.write(f"\tDECLARE {db_syntax.var_prefix}table_schema {db_syntax.nvarchar_type} (128);\n")
    header.write(f"\tDECLARE {db_syntax.var_prefix}table_name {db_syntax.nvarchar_type} (128);\n")
    header.write(f"\tDECLARE {db_syntax.var_prefix}index_name {db_syntax.nvarchar_type} (128);\n")
    header.write(f"\tDECLARE {db_syntax.var_prefix}fk_name {db_syntax.nvarchar_type} (128);\n")
    header.write(f"\tDECLARE {db_syntax.var_prefix}col_name {db_syntax.nvarchar_type} (128);\n")
    header.write(f"\tDECLARE {db_syntax.var_prefix}user_type_name {db_syntax.nvarchar_type} (128);\n")
    header.write(f"\tDECLARE {db_syntax.var_prefix}max_length smallint;\n")
    header.write(f"\tDECLARE {db_syntax.var_prefix}precision smallint;\n")
    header.write(f"\tDECLARE {db_syntax.var_prefix}scale smallint;\n")
    header.write(f"\tDECLARE {db_syntax.var_prefix}is_nullable bit;\n")
    header.write(f"\tDECLARE {db_syntax.var_prefix}is_identity bit;\n")
    header.write(f"\tDECLARE {db_syntax.var_prefix}is_computed bit;\n")
    header.write(f"\tDECLARE {db_syntax.var_prefix}collation_name {db_syntax.nvarchar_type} (128);\n")
    header.write(f"\tDECLARE {db_syntax.var_prefix}computed_definition {db_syntax.nvarchar_type} {db_syntax.max_length_str};\n")
    header.write(f"\tDECLARE {db_syntax.var_prefix}SQL_CREATE {db_syntax.nvarchar_type} {db_syntax.max_length_str};\n")
    header.write(f"\tDECLARE {db_syntax.var_prefix}SQL_ALTER {db_syntax.nvarchar_type} {db_syntax.max_length_str};\n")
    header.write(f"\tDECLARE {db_syntax.var_prefix}SQL_DROP {db_syntax.nvarchar_type} {db_syntax.max_length_str};\n")
    header.write(f"\tDECLARE {db_syntax.var_prefix}diff_descr {db_syntax.nvarchar_type} {db_syntax.max_length_str};\n")
    header.write(f"\tDECLARE {db_syntax.var_prefix}ent_type {db_syntax.nvarchar_type} (25);\n")
    # Variables for dynamic column list building in EXTRA2 detection (rows to delete)
    header.write(f"\tDECLARE {db_syntax.var_prefix}v_extra2_cols TEXT;\n")
    header.write(f"\tDECLARE {db_syntax.var_prefix}v_extra2_select_cols TEXT;\n")

    # Add conditional variable declaration
    if hasattr(db_syntax, 'pre_add_constraints_data_checks') and scrpt_ops.pre_add_constraints_data_checks:
        header.write(f"\tDECLARE {db_syntax.var_prefix}GotBadData {db_syntax.boolean_type}; --for data checks, before adding\reactivating idnexes and constraints\n")
   
    
    
    # Get content and clean up
    header_content = header.getvalue()
    header.close()

    return header_content