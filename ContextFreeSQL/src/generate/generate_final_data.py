import pandas as pd
from io import StringIO
import re
import os
import csv
from enum import Enum
from typing import Optional, Dict, List
import datetime


from src.data_load.from_db.load_from_db_pg import DBSchema
from src.defs.script_defs import DBType, DBSyntax, ScriptingOptions, ScriptTableOptions, InputOutput, ListTables
from src.utils import funcs as utils
from src.utils import code_funcs 
from src.generate.generate_final_create_table import get_create_table_from_sys_tables, get_col_sql


class RowState(Enum):
    EQUAL = 0
    EXTRA1 = 1
    EXTRA2 = 2
    DIFF = 3


# Constants
DIFF_BIT_FLD = "_diffbit_"
FLD_COMPARE_STATE = "_cmprstate_"
EXISTING_FLD_VAL_PREFIX = "_existingval_"
NO_UPDATE_FLD = "_noupdate_"
DATA_WINDOW_COL_USED = "_dataWindowcolused_"
FLAG_CREATED = "_JustCreated"
FLD_COLS_CELLS_EXCLUDE_FOR_ROW = "_nh_row_cells_excluded_"

def script_data(schema_tables: DBSchema, db_type: DBType, tbl_ents: pd.DataFrame, script_ops: ScriptingOptions, db_syntax: DBSyntax, out_buffer: StringIO, input_output: InputOutput, tables_data: ListTables | None = None):
            
    # Get entities that need data scripting
    drows_ents = tbl_ents[(tbl_ents["enttype"] == "Table") & (tbl_ents["scriptdata"] == True)].sort_values("scriptsortorder").to_dict('records')
    
    if len(drows_ents) == 0:
        return  # No data, nothing to script
    
    out_buffer.write("\t--Data-----------------------------------------------------------------------------\n")

    # Handle option combination
    if script_ops.data_scripting_generate_dml_statements:
        script_ops.data_scripting_leave_report_fields_updated = True

    # General variable declarations
    if script_ops.data_scripting_generate_dml_statements:
        out_buffer.write(f"\tDECLARE {db_syntax.var_prefix}{FLD_COMPARE_STATE} smallint;\n")

    out_buffer.write(f"\tDECLARE {db_syntax.var_prefix}NumNonEqualRecs INT;\n")

    # Flag for table creates
    for drow_ent in drows_ents: 
        s_ent_full_name = drow_ent["entschema"] + "." + drow_ent["entname"].replace("'", "''")
        s_ent_var_name = re.sub(r"[ \\/\\$#:,\.]", "_", drow_ent["entschema"] + "_" + drow_ent["entname"])
        s_flag_ent_created = s_ent_var_name + FLAG_CREATED
        
        if db_type == DBType.MSSQL:
            s_ent_full_name_sql = f"[{drow_ent['entschema']}].[{drow_ent['entname']}]"
        else:  # PostgreSQL
            s_ent_full_name_sql = s_ent_full_name
        
        # Declare flag variable
        declare_stmt = "DECLARE " if db_type == DBType.MSSQL else ""
        out_buffer.write(f"\t{declare_stmt}{db_syntax.var_prefix}{s_flag_ent_created} {db_syntax.boolean_type} {db_syntax.var_set_value} false; --This flag is used in case the script was doing schema, and this table was just created. this script is not doing schema for '{s_ent_full_name_sql}'so the table wasn't just created. set it to 1 if it did, in which case the script will just do a bunch of INSERTs as against comparing to existing data\n")
    
    # Need two rounds: one for insertions and one for deletes/updates
    ar_tables_empty = []
    ar_tables_identity = []

    # Track columns per table for CSV export
    table_columns_map = {}  # key: s_ent_full_name, value: list of column names
    table_key_columns_map = {}  # key: s_ent_full_name, value: list of primary key column names

    # Start with INSERTs
    out_buffer.write("\tBEGIN --Data Code\n")

    # Initialize dataStat = 0 for all tables being scripted for data
    if db_type == DBType.PostgreSQL:
        for drow_ent in drows_ents:
            out_buffer.write(f"\t\tUPDATE ScriptTables SET dataStat = 0 WHERE LOWER(ScriptTables.table_schema) = LOWER('{drow_ent['entschema']}') AND LOWER(ScriptTables.table_name) = LOWER('{drow_ent['entname']}');\n")

    if len(drows_ents) > 0:
        if db_type == DBType.MSSQL:
            out_buffer.write(f"\t\tIF ({db_syntax.var_prefix}schemaChanged=1 and {db_syntax.var_prefix}execCode=0)\n")
            out_buffer.write("\t\t\tPRINT '--Note: Changes were found in the schema but not executed (because execution flag is turned off) - Data migration may therefore not work'\n")
        else:  # PostgreSQL
            out_buffer.write(f"\t\tIF ({db_syntax.var_prefix}schemaChanged=True and {db_syntax.var_prefix}execCode=False) THEN\n")
            utils.add_print(db_type, 3, out_buffer, "'Note: Changes were found in the schema but not executed (because execution flag is turned off) - Data migration may therefore not work'")
            out_buffer.write("\t\tEND IF;\n")
    
    
    ar_warned_no_script_data_tables = []
    s_where = None
    ar_no_script = []
    
    # 1st round: insertions #2278
    for drow_ent in drows_ents:
        s_ent_full_name = drow_ent["entschema"] + "." + drow_ent["entname"].replace("'", "''")
        
        if db_type == DBType.MSSQL:
            s_ent_full_name_sql = f"[{drow_ent['entschema']}].[{drow_ent['entname']}]"
        else:  # PostgreSQL
            s_ent_full_name_sql = s_ent_full_name
            
        s_ent_var_name = re.sub(r"[ \\/\\$#:,\.]", "_", drow_ent["entschema"] + "_" + drow_ent["entname"])
        
        
        
        # Handle optional WHERE clause
        #! implement. from original GetWHEREFromSettingsDSet
        #if drow_ent["TableToScript"] is not None:
        #    s_where = utils.get_where_from_settings_dset(drow_ent["TableToScript"])
        #else:
        #    s_where = None
        #and we're gonna have something like:         
            # if s_where:
            #    s_sql += f" WHERE {s_where}"
        tbl_data = schema_tables.tables_data[s_ent_full_name]
      
        
        # Skip empty tables
        if len(schema_tables.tables_data[s_ent_full_name_sql]) == 0:
            ar_tables_empty.append(s_ent_full_name_sql)
            # Create empty CSV with headers if from_file is enabled
            if tables_data and tables_data.from_file and db_type == DBType.PostgreSQL:
                csv_output_dir = os.path.dirname(input_output.html_output_path).replace("\\", "/")
                csv_file_path = f"{csv_output_dir}/{drow_ent['entschema']}_{drow_ent['entname']}.csv"
                os.makedirs(csv_output_dir, exist_ok=True)
                # Get column names from schema for empty table
                empty_tbl_cols = schema_tables.columns[
                    (schema_tables.columns["object_id"] == drow_ent["entkey"]) &
                    ((schema_tables.columns["is_computed"] == 0) | (schema_tables.columns["is_computed"].isnull()))
                ].sort_values("column_id")["col_name"].tolist()
                # Write CSV with just headers
                with open(csv_file_path, 'w', newline='') as f:
                    writer = csv.writer(f)
                    writer.writerow(empty_tbl_cols)

            # Still need to set JustCreated flag for empty tables (needed in second round)
            s_flag_ent_created = s_ent_var_name + FLAG_CREATED
            if len(tbl_ents[(tbl_ents["scriptschema"] == True) & (tbl_ents["enttype"] == "Table")]) > 0:
                if db_type == DBType.MSSQL:
                    out_buffer.write(f"\t\tIF EXISTS(SELECT * FROM #ScriptTables WHERE table_schema='{drow_ent['entschema']}' AND table_name='{drow_ent['entname'].replace("'", "''")}' AND tablestat=1)\n")
                    out_buffer.write(f"\t\t\tSET {db_syntax.var_prefix}{s_flag_ent_created}=1\n")
                    out_buffer.write("\t\tELSE\n")
                    out_buffer.write(f"\t\t\tSET {db_syntax.var_prefix}{s_flag_ent_created}=0\n")
                else:  # PostgreSQL
                    out_buffer.write(f"\t\tperform 1 from scripttables T WHERE T.table_schema='{drow_ent['entschema']}' AND T.table_name='{drow_ent['entname'].replace("'", "''")}' AND tablestat=1;\n")
                    out_buffer.write("\t\tIF FOUND THEN\n")
                    out_buffer.write(f"\t\t\t{db_syntax.var_prefix}{s_flag_ent_created} := true;\n")
                    out_buffer.write("\t\tELSE\n")
                    out_buffer.write(f"\t\t\t{db_syntax.var_prefix}{s_flag_ent_created} := false;\n")
                    out_buffer.write("\t\tEND IF;\n")
            continue
            
        s_flag_ent_created = s_ent_var_name + FLAG_CREATED
        
        # Set flag if table was just created
        
        if len(tbl_ents[(tbl_ents["scriptschema"] == True) & (tbl_ents["enttype"] == "Table")]) > 0:
            if db_type == DBType.MSSQL:
                out_buffer.write(f"\t\tIF EXISTS(SELECT * FROM #ScriptTables WHERE table_schema='{drow_ent['entschema']}' AND table_name='{drow_ent['entname'].replace("'", "''")}' AND tablestat=1)\n")
                out_buffer.write(f"\t\t\tSET {db_syntax.var_prefix}{s_flag_ent_created}=1\n")
                out_buffer.write("\t\tELSE\n")
                out_buffer.write(f"\t\t\tSET {db_syntax.var_prefix}{s_flag_ent_created}=0\n")
            else:  # PostgreSQL
                out_buffer.write(f"\t\tperform 1 from scripttables T WHERE T.table_schema='{drow_ent['entschema']}' AND T.table_name='{drow_ent['entname'].replace("'", "''")}' AND tablestat=1;\n")
                out_buffer.write("\t\tIF FOUND THEN\n")
                out_buffer.write(f"\t\t\t{db_syntax.var_prefix}{s_flag_ent_created} := true;\n")
                out_buffer.write("\t\tELSE\n")
                out_buffer.write(f"\t\t\t{db_syntax.var_prefix}{s_flag_ent_created} := false;\n")
                out_buffer.write("\t\tEND IF;\n")
        else:
            # Table definitely not just created because we didn't script schema
            if db_type == DBType.MSSQL:
                out_buffer.write(f"\t\tSET {db_syntax.var_prefix}{s_flag_ent_created}=0\n")
            else:  # PostgreSQL
                out_buffer.write(f"\t\t{db_syntax.var_prefix}{s_flag_ent_created} := False;\n")

        out_buffer.write("\n")
        
        # Get column info (drows_cols to hold a list of columns)
        if db_type == DBType.MSSQL:
            if script_ops.data_window_only:
                drows_cols = schema_tables.columns[
                    (schema_tables.columns["object_id"] == drow_ent["entkey"]) & 
                    (schema_tables.columns["is_computed"] == 0) &
                    (schema_tables.columns[DATA_WINDOW_COL_USED] == 1)
                ].sort_values("column_id").to_dict('records')
            else:
                drows_cols = schema_tables.columns[
                    (schema_tables.columns["object_id"] == drow_ent["entkey"]) & 
                    (schema_tables.columns["is_computed"] == 0)
                ].sort_values("column_id").to_dict('records')
        else:  # PostgreSQL
            if script_ops.data_window_only:
                drows_cols = schema_tables.columns[
                    (schema_tables.columns["object_id"] == drow_ent["entkey"]) & 
                    ((schema_tables.columns["is_computed"] == 0) | (schema_tables.columns["is_computed"].isnull())) &
                    (schema_tables.columns[DATA_WINDOW_COL_USED] == 1)
                ].sort_values("column_id").to_dict('records')
            else:
                drows_cols = schema_tables.columns[
                    (schema_tables.columns["object_id"] == drow_ent["entkey"]) & 
                    ((schema_tables.columns["is_computed"] == 0) | (schema_tables.columns["is_computed"].isnull()))
                ].sort_values("column_id").to_dict('records')
        
        # Load columns for faster iteration #2411
        ar_cols = []
        ar_key_cols = []
        ar_no_key_cols = []
        
        for drow_col in drows_cols:
            if drow_col["col_name"] not in tbl_data.columns:
                continue
            if utils.c_to_bool(drow_col.get("is_computed", False), False):
                continue
            ar_cols.append(drow_col["col_name"])
            
        if len(ar_cols) == 0:
            utils.add_print(db_type, 2, out_buffer, f"'Data table ''{s_ent_full_name}'' has no columns to be scripted'")
            continue
            
        #this is 'settings override' feature which i had in the old one. never used it much, don't think i'll reactivate it
        # Find uniqueness constraints (load them on ar_warned_no_script_data_tables)
        b_got_settings_override = False
        
        #if drow_ent["TableToScript"] is not None:            
            #tbl_settings = ds_data.tables.get("TableNameSettings")
            #b_got_settings_override = True
        tbl_settings = None
        drows_unq_cols, drow_unq_index=[], []  # Default to an empty list    ``    
        if (not b_got_settings_override) or (tbl_settings is None):
            if db_type == DBType.MSSQL:
                drow_unq_index = schema_tables.indexes[
                    (schema_tables.indexes["object_id"] == drow_ent["entkey"]) & 
                    (schema_tables.indexes["is_unique"] == 1)
                ].sort_values("is_primary_key", ascending=False).to_dict('records')
            else:  # PostgreSQL
                drow_unq_index = schema_tables.indexes[
                    (schema_tables.indexes["object_id"] == drow_ent["entkey"]) & 
                    (schema_tables.indexes["is_unique"] == 1)
                ].sort_values("is_primary_key", ascending=False).to_dict('records')
                
            if len(drow_unq_index) == 0:
                if s_ent_full_name not in ar_warned_no_script_data_tables:
                    utils.add_print(db_type, 2, out_buffer, f"'Data table ''{s_ent_full_name}'' has no uniqueness. Data cannot be scripted'")
                    ar_warned_no_script_data_tables.append(s_ent_full_name)
                continue

            
            if db_type == DBType.MSSQL:
                drows_unq_cols = schema_tables.index_cols[
                    (schema_tables.index_cols["object_id"] == drow_ent["entkey"]) & 
                    (schema_tables.index_cols["index_id"] == drow_unq_index[0]["index_id"])
                ].to_dict('records')
            else:  # PostgreSQL
                drows_unq_cols = schema_tables.index_cols[
                    (schema_tables.index_cols["object_id"] == drow_ent["entkey"]) & 
                    (schema_tables.index_cols["index_id"] == drow_unq_index[0]["index_id"])
                ].to_dict('records')
        #else:
            #drows_unq_cols = tbl_settings[tbl_settings["IsKey"] == True].to_dict('records')
            
        # Build key columns list
        s_got_key_cols_for_msg = []
        for drow_col in drows_unq_cols:
            s_got_key_cols_for_msg.append(drow_col["col_name"])
            if drow_col["col_name"] not in tbl_data.columns:
                continue
            ar_key_cols.append(drow_col["col_name"])
            
        if len(ar_key_cols) == 0:
            ar_no_script.append(s_ent_full_name)
            additional_msg = ""
            if s_got_key_cols_for_msg:
                key_cols_text = ", ".join(s_got_key_cols_for_msg)
                additional_msg = f" (there were unique fields but they're not in our data to be scripted: {key_cols_text})"
            utils.add_print(db_type, 2, out_buffer, f"'Data table ''{s_ent_full_name}'' has no primary key columns. Data cannot be scripted.{additional_msg}'")
            continue
            
        # Find non-key columns
        for s_col_name in ar_cols:
            if s_col_name in ar_key_cols:
                continue
            ar_no_key_cols.append(s_col_name)

        # Store columns for CSV export
        table_columns_map[s_ent_full_name] = ar_cols.copy()
        table_key_columns_map[s_ent_full_name] = ar_key_cols.copy()

        # Check for identity columns
        if db_type == DBType.MSSQL:
            i_num_cols_identity = len(schema_tables.columns[
                (schema_tables.columns["object_id"] == drow_ent["entkey"]) & 
                (schema_tables.columns["is_identity"] == 1)
            ])
        else:  # PostgreSQL
            i_num_cols_identity = len(schema_tables.columns[
                (schema_tables.columns["object_id"] == drow_ent["entkey"]) & 
                (schema_tables.columns["is_identity"] == 1)
            ])
            
        if i_num_cols_identity > 0:
            ar_tables_identity.append(s_ent_full_name_sql)
            
        # Create temporary table
        s_temp_table_name = re.sub(r"[ \\/\\$#:,\.]", "_", drow_ent["entschema"] + "_" + drow_ent["entname"])
        
        if db_type == DBType.MSSQL:
            out_buffer.write(f"\t\tIF (OBJECT_ID('tempdb..#{s_temp_table_name}') IS NOT NULL)\n")
            out_buffer.write(f"\t\t\tDROP TABLE #{s_temp_table_name}\n")
        else:  # PostgreSQL
            out_buffer.write(f"\t\tperform n.nspname, c.relname\n")
            out_buffer.write(f"\t\tFROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace\n")
            out_buffer.write(f"\t\tWHERE n.nspname like 'pg_temp_%' AND c.relname='{s_temp_table_name}' AND pg_catalog.pg_table_is_visible(c.oid);\n")
            out_buffer.write("\t\tIF FOUND THEN\n")
            out_buffer.write(f"\t\t\tDROP TABLE {s_temp_table_name};\n")
            out_buffer.write("\t\tEND IF;\n")

        # Handle DML statement generation
        if script_ops.data_scripting_generate_dml_statements: #2508
            if db_type == DBType.MSSQL:
                out_buffer.write(f"IF (@printExec=1 AND @execCode=0 AND @{s_flag_ent_created}=1) --Table was just created, but we want to print and not execute (so its not really created, can't really compare against existing data, table is not there\n")
                out_buffer.write("BEGIN\n")
                
                out_buffer.write("\t--we are in PRINT mode here. Table needs to be created but wasn't (because we're printing, not executing) so just spew out the full INSERT statements\n")
                
                # IDENTITY_INSERT
                if s_ent_full_name_sql in ar_tables_identity:
                    out_buffer.write(f"\tPRINT 'SET IDENTITY_INSERT {s_ent_full_name_sql} ON'\n")
                    
                # Generate INSERT statements
                i_count = 0
                i_col_count = len(ar_cols)
                
                for index, row in tbl_data.iterrows():
                    out_buffer.write(f"\tPRINT 'INSERT INTO {s_ent_full_name_sql} (\n")
                    i_count = 1
                    for s_col_name in ar_cols:
                        out_buffer.write(f"[{s_col_name}]")
                        if i_count < i_col_count:
                            out_buffer.write(",")
                        i_count += 1
                    out_buffer.write(")\n")
                    out_buffer.write(" VALUES (")
                    i_count = 1
                    for s_col_name in ar_cols:
                        o_val = row.get(s_col_name)
                        if pd.isna(o_val):  # Equivalent to IsDBNull
                            out_buffer.write("NULL")
                        else:
                            out_buffer.write("''")
                            if isinstance(o_val, (datetime.datetime, datetime.date)):
                                out_buffer.write(o_val.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3])
                            else:
                                out_buffer.write(str(o_val).replace("'", "''"))
                            out_buffer.write("''")
                        if i_count < i_col_count:
                            out_buffer.write(",")
                        i_count += 1
                    out_buffer.write(")'\n")
                    
                # Turn off IDENTITY_INSERT
                if s_ent_full_name_sql in ar_tables_identity:
                    out_buffer.write(f"\tPRINT 'SET IDENTITY_INSERT {s_ent_full_name_sql} OFF'\n")
                    
                out_buffer.write("\n")
                out_buffer.write(f"END --of Batch INSERT of all the data into {s_ent_full_name}\n")
                out_buffer.write("ELSE\n")
                out_buffer.write("BEGIN --and this begins the INSERT as against potentially existing data\n")
                
            elif db_type == DBType.PostgreSQL:
                out_buffer.write(f"\t\tIF (printExec=True AND execCode=False AND {s_flag_ent_created}=True) THEN --Table was just created, but we want to print and not execute (so its not really created, can't really compare against existing data, table is not there\n")
                out_buffer.write("\t\t\t--we are in PRINT mode here. Table needs to be created but wasn't (because we're printing, not executing) so just spew out the full INSERT statements\n")

                if tables_data and tables_data.from_file:
                    # Print the COPY command user can execute to load from CSV
                    csv_output_dir = os.path.dirname(input_output.html_output_path).replace("\\", "/")
                    csv_file_path = f"{csv_output_dir}/{drow_ent['entschema']}_{drow_ent['entname']}.csv"
                    col_names = ", ".join(ar_cols)
                    copy_cmd = f"COPY {s_ent_full_name_sql} ({col_names}) FROM ''{csv_file_path}'' WITH (FORMAT CSV, HEADER);"
                    out_buffer.write(f"\t\t\tINSERT INTO scriptoutput (SQLText)\n")
                    out_buffer.write(f"\t\t\t\tVALUES ('{copy_cmd}');\n")
                else:
                    # Generate INSERT statements for PostgreSQL
                    i_count = 0
                    i_col_count = len(ar_cols)
                    s_overriding = " OVERRIDING SYSTEM VALUE" if s_ent_full_name_sql in ar_tables_identity else ""

                    for index, row in tbl_data.iterrows():
                        s_insert_into = []
                        s_insert_into.append(f"INSERT INTO {s_ent_full_name_sql} (")
                        i_count = 1
                        for s_col_name in ar_cols:
                            s_insert_into.append(s_col_name)
                            if i_count < i_col_count:
                                s_insert_into.append(",")
                            i_count += 1
                        s_insert_into.append(f"){s_overriding}\n")
                        s_insert_into.append("\t\tVALUES (")
                        i_count = 1
                        for s_col_name in ar_cols:
                            o_val = row.get(s_col_name)
                            if pd.isna(o_val):  # Equivalent to IsDBNull
                                s_insert_into.append("NULL")
                            elif isinstance(o_val, (datetime.datetime, datetime.date)):
                                s_insert_into.append("''")
                                s_insert_into.append(o_val.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3])
                                s_insert_into.append("''")
                            else:
                                # Use helper to handle float-to-int conversion and proper quoting
                                # Note: we need double quotes here since this is inside a string literal
                                formatted = utils.format_value_for_sql(o_val)
                                s_insert_into.append(formatted.replace("'", "''"))
                            if i_count < i_col_count:
                                s_insert_into.append(",")
                            i_count += 1
                        s_insert_into.append(");'")

                        full_insert = "".join(s_insert_into)
                        out_buffer.write(f"\t\t\tINSERT INTO scriptoutput (SQLText)\n")
                        out_buffer.write(f"\t\t\t\tVALUES ('--{full_insert});\n")

                out_buffer.write("\n")
                out_buffer.write(f"\t\t--END IF;--of Batch INSERT of all the data into {s_ent_full_name}\n")
                out_buffer.write("\t\tELSE --and this begins the INSERT as against potentially existing data\n")

        # Write table name comment
        out_buffer.write(f"\t\t--Data for '{s_ent_full_name}'\n") #2618
        # Set up temp table options
        ops_script_temp_table = ScriptTableOptions()
        ops_script_temp_table.table_name = s_temp_table_name
        ops_script_temp_table.column_identity = False
        ops_script_temp_table.indexes = False
        ops_script_temp_table.foreign_keys = False
        ops_script_temp_table.defaults = False
        ops_script_temp_table.check_constraints = False
        ops_script_temp_table.extended_props = False

        # Create temp table
        create_table = ""
        create_table_err = ""
        create_table, create_table_err  = get_create_table_from_sys_tables(
            db_type = db_type,
            table_schema = drow_ent['entschema'],
            table_name = drow_ent['entname'],
            schema_tables = schema_tables,
            script_table_ops = ops_script_temp_table,
            pre_add_constraints_data_checks = False,
            force_allow_null = True,
            as_temp_table = True)

        if create_table_err:
            utils.add_print(db_type, 2, out_buffer, f"'Table ''{s_ent_full_name}'' cannot be scripted: {create_table_err.replace("'", "''")}'")
            continue

        out_buffer.write("\t\t" + create_table + "\n\n")

        # Handle special case: data window with specific cells
        if script_ops.data_window_only and script_ops.data_window_got_specific_cells:
            out_buffer.write("\t\t--we are updating a 'Data Window' with specific cells selected. UPDATE needs to have special flags\n")
            for s_col_name in ar_cols:
                out_buffer.write(f"\t\tALTER TABLE {db_syntax.temp_table_prefix}{s_temp_table_name} ADD [{NO_UPDATE_FLD}{s_col_name}] BIT NULL;\n")
            out_buffer.write("\n")

        i_col_count = len(ar_cols)

        # Handle specific data cells scenario
        b_got_specific_data_cells = False
        if script_ops.data_window_only and script_ops.data_window_got_specific_cells:
            b_got_specific_data_cells = FLD_COLS_CELLS_EXCLUDE_FOR_ROW in tbl_data.columns

        # Insert data into temp table
        if tables_data and tables_data.from_file and db_type == DBType.PostgreSQL:
            # Write CSV file from Python and use COPY FROM to load it
            csv_output_dir = os.path.dirname(input_output.html_output_path).replace("\\", "/")
            csv_file_path = f"{csv_output_dir}/{drow_ent['entschema']}_{drow_ent['entname']}.csv"

            # Create directory if it doesn't exist
            os.makedirs(csv_output_dir, exist_ok=True)

            # Write CSV file with only the columns we need
            tbl_data[ar_cols].to_csv(csv_file_path, index=False)

            col_names = ", ".join(ar_cols)
            out_buffer.write(f"\t\t-- Loading data from CSV file: {csv_file_path}\n")
            out_buffer.write(f"\t\tEXECUTE format('COPY {s_temp_table_name} ({col_names}) FROM %L WITH (FORMAT CSV, HEADER)', '{csv_file_path}');\n")
        else:
            # Generate INSERT statements
            for index, row in tbl_data.iterrows():
                out_buffer.write(f"\t\tINSERT INTO {db_syntax.temp_table_prefix}{s_temp_table_name} (\n")
                i_count = 1
                for s_col_name in ar_cols:
                    if db_type == DBType.MSSQL:
                        out_buffer.write(f"[{s_col_name}]")
                    else:  # PostgreSQL
                        out_buffer.write(s_col_name)
                    if i_count < i_col_count:
                        out_buffer.write(",")
                    i_count += 1

                # Add specific cells columns if needed
                s_cells = None
                if b_got_specific_data_cells:
                    exclude_val = row.get(FLD_COLS_CELLS_EXCLUDE_FOR_ROW)
                    if not pd.isna(exclude_val):
                        s_cells = str(exclude_val).split("|")
                        for s_cell_col_name in s_cells:
                            if db_type == DBType.MSSQL:
                                out_buffer.write(f", [{NO_UPDATE_FLD}{s_cell_col_name}]")
                            else:  # PostgreSQL
                                out_buffer.write(f", {NO_UPDATE_FLD}{s_cell_col_name}")

                out_buffer.write("\t\t)\n")
                out_buffer.write("\t\t\tVALUES (")
                i_count = 1
                for s_col_name in ar_cols:
                    o_val = row.get(s_col_name)
                    if pd.isna(o_val):
                        out_buffer.write("NULL")
                    elif isinstance(o_val, (datetime.datetime, datetime.date)):
                        out_buffer.write("'")
                        out_buffer.write(o_val.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3])
                        out_buffer.write("'")
                    else:
                        # Use helper to handle float-to-int conversion and proper quoting
                        out_buffer.write(utils.format_value_for_sql(o_val))
                    if i_count < i_col_count:
                        out_buffer.write(",")
                    i_count += 1

                # Add values for specific cells columns
                if b_got_specific_data_cells and s_cells is not None:
                    for _ in s_cells:
                        out_buffer.write(",1")  # Mark as true

                out_buffer.write("\t\t);\n")

        out_buffer.write("\n")
        out_buffer.write("\t\t--add status field, and update it:\n")
        out_buffer.write(f"\t\tALTER TABLE {db_syntax.temp_table_prefix}{s_temp_table_name} ADD {FLD_COMPARE_STATE} smallint NULL;\n") #2707

        # Find records to add
        out_buffer.write("\t\t--Records to be added:\n")
        s_source_table_name = None
        #! see comments above. this feature not enable yet
        #if drow_ent["TableToScript"] is not None:
            #s_where = utils.get_where_from_settings_dset(drow_ent["TableToScript"])
        #else:
            #s_where = None

        if s_where:
            s_source_table_name = f"(SELECT * FROM {s_ent_full_name_sql} WHERE {s_where})"
        else:
            s_source_table_name = s_ent_full_name_sql

        # Generate SQL for data comparisons based on database type
        if db_type == DBType.MSSQL:
            out_buffer.write(f"UPDATE {db_syntax.temp_table_prefix}{s_temp_table_name} SET {FLD_COMPARE_STATE}={RowState.EXTRA1.value} FROM {db_syntax.temp_table_prefix}{s_temp_table_name} t LEFT JOIN {s_source_table_name} p ON ")
            
            # Key field comparisons
            i_count = 1
            i_col_count = len(ar_key_cols)
            for s_col_name in ar_key_cols:
                out_buffer.write(f"t.{s_col_name}=p.{s_col_name}")
                if i_count < i_col_count:
                    out_buffer.write(" AND ")
                i_count += 1
            
            out_buffer.write(" WHERE ")
            i_count = 1
            i_col_count = len(ar_key_cols)
            for s_col_name in ar_key_cols:
                out_buffer.write(f"p.{s_col_name} IS NULL")
                if i_count < i_col_count:
                    out_buffer.write(" OR ")
                i_count += 1
            
            out_buffer.write(";\n")
            out_buffer.write("--add all missing records:\n")
            out_buffer.write(f"IF ({db_syntax.var_prefix}execCode=1)\n")
            out_buffer.write("BEGIN\n")
            
            # Handle identity insert
            if s_ent_full_name_sql in ar_tables_identity:
                out_buffer.write(f"\tSET IDENTITY_INSERT {s_ent_full_name_sql} ON\n")
            
            # Generate insert statement
            out_buffer.write(f"\tSET @sqlCode = 'INSERT INTO {s_ent_full_name_sql}(")
            i_count = 1
            i_col_count = len(ar_cols)
            for s_col_name in ar_cols:
                out_buffer.write(f"[{s_col_name}]")
                if i_count < i_col_count:
                    out_buffer.write(", ")
                i_count += 1
            
            out_buffer.write(")\n")
            out_buffer.write(" SELECT ")
            i_count = 1
            i_col_count = len(ar_cols)
            for s_col_name in ar_cols:
                out_buffer.write(f"[{s_col_name}]")
                if i_count < i_col_count:
                    out_buffer.write(", ")
                i_count += 1
            
            out_buffer.write(f" FROM {db_syntax.temp_table_prefix}{s_temp_table_name} WHERE {FLD_COMPARE_STATE}={RowState.EXTRA1.value}'\n")
            out_buffer.write("\tEXEC(@sqlCode)\n")
            
            # Turn off identity insert if needed
            if s_ent_full_name_sql in ar_tables_identity:
                out_buffer.write(f"\tSET IDENTITY_INSERT {s_ent_full_name_sql} OFF\n")
            
            out_buffer.write(f"END --of INSERTing into {s_ent_full_name}\n")

        elif db_type == DBType.PostgreSQL:
            # PostgreSQL version - first check if source table exists
            out_buffer.write(f"\t\t-- Check if source table exists before comparison\n")
            out_buffer.write(f"\t\tPERFORM 1 FROM information_schema.tables t WHERE t.table_schema = '{drow_ent['entschema']}' AND t.table_name = '{drow_ent['entname']}';\n")
            out_buffer.write(f"\t\tIF NOT FOUND THEN\n")
            out_buffer.write(f"\t\t\t-- Source table does not exist, mark all records as needing to be added\n")
            out_buffer.write(f"\t\t\tUPDATE {s_temp_table_name} SET {FLD_COMPARE_STATE} = {RowState.EXTRA1.value};\n")
            utils.add_print(db_type, 3, out_buffer, f"'Table ''{s_ent_full_name}'' does not exist in database - all {len(tbl_data)} records will be marked for insertion'")
            out_buffer.write(f"\t\tELSE\n")
            out_buffer.write(f"\t\t\t-- Source table exists, proceed with comparison\n")
            out_buffer.write(f"\t\t\tUPDATE {s_temp_table_name} orig SET {FLD_COMPARE_STATE}={RowState.EXTRA1.value} FROM {db_syntax.temp_table_prefix}{s_temp_table_name} t LEFT JOIN {s_source_table_name} p ON ")
            
            # Key field comparisons
            i_count = 1
            i_col_count = len(ar_key_cols)
            for s_col_name in ar_key_cols:
                out_buffer.write(f"t.{s_col_name}=p.{s_col_name}")
                if i_count < i_col_count:
                    out_buffer.write(" AND ")
                i_count += 1
            
            out_buffer.write(" WHERE ")
            i_count = 1
            i_col_count = len(ar_key_cols)
            for s_col_name in ar_key_cols:
                out_buffer.write(f"orig.{s_col_name} = t.{s_col_name} ")
                if i_count < i_col_count:
                    out_buffer.write(" AND ")
                i_count += 1
            
            out_buffer.write(" AND ")
            i_count = 1
            i_col_count = len(ar_key_cols)
            for s_col_name in ar_key_cols:
                out_buffer.write(f"p.{s_col_name} IS NULL")
                if i_count < i_col_count:
                    out_buffer.write(" OR ")
                i_count += 1
            
            out_buffer.write(";\n")
            out_buffer.write("\t\t--add all missing records:\n")
            out_buffer.write(f"\t\tIF ({db_syntax.var_prefix}execCode=True) THEN\n")

            # Generate insert statement
            s_overriding = " OVERRIDING SYSTEM VALUE" if s_ent_full_name_sql in ar_tables_identity else ""
            out_buffer.write(f"\t\t\tsqlCode := 'INSERT INTO {s_ent_full_name_sql}(")
            i_count = 1
            i_col_count = len(ar_cols)
            for s_col_name in ar_cols:
                out_buffer.write(s_col_name)
                if i_count < i_col_count:
                    out_buffer.write(", ")
                i_count += 1

            out_buffer.write(f"){s_overriding}\n")
            out_buffer.write("\t\t\t SELECT ")
            i_count = 1
            i_col_count = len(ar_cols)
            for s_col_name in ar_cols:
                out_buffer.write(s_col_name)
                if i_count < i_col_count:
                    out_buffer.write(", ")
                i_count += 1

            out_buffer.write(f" FROM {db_syntax.temp_table_prefix}{s_temp_table_name} WHERE {FLD_COMPARE_STATE}={RowState.EXTRA1.value}';\n")
            out_buffer.write("\t\t\tEXECUTE sqlCode;\n")
            out_buffer.write(f"\t\tEND IF; -- of source table exists check\n")
            out_buffer.write(f"\t\tEND IF; --of INSERTing into {s_ent_full_name}\n")
     
        
        if script_ops.data_scripting_generate_dml_statements:
            out_buffer.write("\n")
        
            if db_type == DBType.MSSQL:
                out_buffer.write("--generating individual DML statements: INSERTS\n")
                out_buffer.write("IF (@printExec=1 ) --only if asked to print, since that's the only reason they are here\n")
                out_buffer.write("BEGIN\n")
                out_buffer.write(f"\tIF EXISTS(Select 1 from {db_syntax.temp_table_prefix}{s_temp_table_name} s WHERE s.{FLD_COMPARE_STATE}=1)\n")
                out_buffer.write("\tBEGIN\n")
                
                if s_ent_full_name_sql in ar_tables_identity:
                    out_buffer.write(f"\t\tSET @sqlCode='SET IDENTITY_INSERT {s_ent_full_name_sql} ON'\n")
                    utils.add_exec_sql(db_type, 2, out_buffer)
                
                # For MSSQL, remove the # in the temp table name
                cursor_temp_table_var_name = s_temp_table_name[1:] if db_type == DBType.MSSQL else s_temp_table_name
                
                out_buffer.write(f"\t\tDECLARE {cursor_temp_table_var_name} CURSOR FAST_FORWARD FOR\n")
                out_buffer.write("\t\tSelect ")
                
                for col_name_select in ar_cols:
                    out_buffer.write(f"[{col_name_select}],")
                
                out_buffer.write(FLD_COMPARE_STATE)
                out_buffer.write(f"\t\t FROM {db_syntax.temp_table_prefix}{s_temp_table_name} WHERE {FLD_COMPARE_STATE}={RowState.EXTRA1.value}\n")
                
                # Initialize string builders
                fields_var_names = []
                fields_var_names_declare = []
                field_list = []
                fields_var_names_value_list = []
                cols_var_names = []
                
                count = 1
                col_count = len(drows_cols)
                
                for row_col in drows_cols:
                    col_var_name = f"{s_ent_var_name}_{re.sub('[ \\/\\$#:,\\.]', '_', row_col['col_name'])}"
                    cols_var_names.append(col_var_name)
                    
                    fields_var_names_declare.append(f"@{col_var_name} {row_col['user_type_name']}{code_funcs.add_size_precision_scale(row_col)},@{DIFF_BIT_FLD}{col_var_name} bit")
                    
                    if script_ops.data_scripting_leave_report_fields_updated_save_old_value:
                        fields_var_names_declare.append(f", @{EXISTING_FLD_VAL_PREFIX}{col_var_name} {row_col['user_type_name']}{code_funcs.add_size_precision_scale(row_col)}")
                    
                    fields_var_names.append(f"@{col_var_name}")
                    field_list.append(f"[{row_col['col_name']}]")
                    
                    # Add value to SQL string based on type
                    code_funcs.add_value_to_sql_str(db_type, row_col["col_name"], col_var_name, row_col["user_type_name"], "\t\t", fields_var_names_value_list)
                    
                    fields_var_names.append(", ")
                    
                    if count < col_count:
                        fields_var_names_value_list.append("SET @sqlCode+=',' \n")
                        #field_list.append(", ") 2025-03-24 no need for it now that we have ','.join. python puts the commas there on its own
                        fields_var_names_declare.append(", ")
                    
                    count += 1
                
                # Finish building and write to output
                fields_var_names.append(f"@{FLD_COMPARE_STATE}")
                
                out_buffer.write(f"\t\tdeclare {', '.join(fields_var_names_declare)}\n")
                out_buffer.write(f"\t\tOPEN {cursor_temp_table_var_name}\n")
                out_buffer.write(f"\t\tFETCH NEXT FROM {cursor_temp_table_var_name} INTO {', '.join(fields_var_names)}\n")
                out_buffer.write("\t\tWHILE @@FETCH_STATUS = 0\n")
                out_buffer.write("\t\tBEGIN\n")
                out_buffer.write("\t\t\t--Does the row needs to be added, updated, removed?\n")
                out_buffer.write("\t\t\tSET @sqlCode = NULL --reset\n")
                out_buffer.write(f"\t\t\tIF (@{FLD_COMPARE_STATE}={RowState.EXTRA1.value}) --to be added\n")
                out_buffer.write("\t\t\tBEGIN\n")
                out_buffer.write(f"\t\t\t\tSET @sqlCode='INSERT INTO {s_ent_full_name_sql} ({', '.join(field_list)}) '\n")
                out_buffer.write("\t\t\t\tVALUES (''\n")
                
                for line in fields_var_names_value_list:
                    out_buffer.write(line)
                
                out_buffer.write("\t\t\t\tSET @sqlCode += ');'\n")
                out_buffer.write("\t\t\tEND\n")
                out_buffer.write("\t\t\tIF (@printExec=1) PRINT @sqlCode\n")
                out_buffer.write("\n")
                out_buffer.write(f"\t\t\tFETCH NEXT FROM {cursor_temp_table_var_name} INTO {', '.join(fields_var_names)}\n")
                out_buffer.write("\t\tEnd\n")
                out_buffer.write("\n")
                out_buffer.write(f"\t\tCLOSE {cursor_temp_table_var_name}\n")
                out_buffer.write(f"\t\tDEALLOCATE {cursor_temp_table_var_name}\n")
                
            elif db_type == DBType.PostgreSQL:
                out_buffer.write("\t\t--generating individual DML statements: INSERTS\n") #2908
                out_buffer.write("\t\tIF (printExec=True) THEN --only if asked to print, since that's the only reason they are here\n")
                out_buffer.write(f"\t\t\tPERFORM 1 from {db_syntax.temp_table_prefix}{s_temp_table_name} s WHERE s.{FLD_COMPARE_STATE}=1;\n")
                out_buffer.write("\t\t\tIF FOUND THEN\n")
                
                # Initialize string builders for PostgreSQL
                fields_var_names = []
                field_list = []
                fields_var_names_value_list = []
                cols_var_names = []
                
                count = 1
                col_count = len(drows_cols)
                
                for row_col in drows_cols:
                    col_var_name = f"{s_ent_var_name}_{re.sub('[ \\/\\$#:,\\.]', '_', row_col['col_name'])}"
                    cols_var_names.append(col_var_name)
                    
                    field_list.append(row_col["col_name"])

                    #if script_ops.data_scripting_leave_report_fields_updated_save_old_value:
                    #    fields_var_names_declare.append(f", @{EXISTING_FLD_VAL_PREFIX}{col_var_name} {row_col['user_type_name']}{code_funcs.add_size_precision_scale(row_col)}")
                    
                    # Add value to SQL string
                    code_funcs.add_value_to_sql_str(db_type, row_col["col_name"], col_var_name, row_col["user_type_name"], "\t\t\t\t\t\t", fields_var_names_value_list)

                    fields_var_names.append(", ")

                    if count < col_count:
                        fields_var_names_value_list.append("\t\t\t\t\t\tsqlCode = sqlCode || ','; \n")
                        #field_list.append(", ") ne nada... we are doing ','.join so proper commans will be there
                    
                    count += 1
                
                # Write PostgreSQL specific code
                out_buffer.write("\t\t\t\tdeclare temprow record;\n")
                out_buffer.write("\t\t\t\tBEGIN\n")
                out_buffer.write("\t\t\t\t\tFOR temprow IN\n")
                out_buffer.write("\t\t\t\t\t\tSELECT ")
                
                count = 1
                for row_col in drows_cols:
                    out_buffer.write(row_col["col_name"])
                    if count < col_count:
                        out_buffer.write(",")
                    count += 1
                
                out_buffer.write(f" FROM {db_syntax.temp_table_prefix}{s_temp_table_name} s WHERE s.{FLD_COMPARE_STATE}={RowState.EXTRA1.value}\n")
                out_buffer.write("\t\t\t\t\tLOOP\n")
                s_overriding = " OVERRIDING SYSTEM VALUE" if s_ent_full_name_sql in ar_tables_identity else ""
                out_buffer.write(f"\t\t\t\t\t\tsqlCode='INSERT INTO {s_ent_full_name_sql} ({', '.join(field_list)}){s_overriding} VALUES (';\n")

                out_buffer.writelines(fields_var_names_value_list)

                out_buffer.write("\t\t\t\t\t\tsqlCode = sqlCode ||  ')';\n")
                out_buffer.write("\t\t\t\t\t\tIF (printExec=True) THEN\n")
                out_buffer.write("\t\t\t\t\t\t\tINSERT INTO scriptoutput (SQLText)\n")
                out_buffer.write("\t\t\t\t\t\t\tVALUES (sqlCode);\n")
                out_buffer.write("\t\t\t\t\t\tEND IF;\n")
                out_buffer.write("\t\t\t\t\tEND LOOP;\n")
                out_buffer.write("\t\t\t\tEND; --of loop block \n")
            
            # Handle identity tables (MSSQL only - PostgreSQL uses OVERRIDING SYSTEM VALUE in INSERT)
            if db_type == DBType.MSSQL and s_ent_full_name_sql in ar_tables_identity:
                out_buffer.write(f"\t\tSET @sqlCode='SET IDENTITY_INSERT {s_ent_full_name_sql} OFF'\n")
                utils.add_exec_sql(db_type, 2, out_buffer)

            # Close the statements based on database type
            if db_type == DBType.MSSQL:
                out_buffer.write("END --of iterating cursor of data to insert\n")
                out_buffer.write(f"END --of generating DML statements: INSERT for {s_ent_full_name}\n")
            elif db_type == DBType.PostgreSQL:
                out_buffer.write("\t\t\tEND IF; --of IF FOUND record iteration (temprow) \n")
                out_buffer.write(f"\t\tEND IF; --of generating DML statements: INSERT for {s_ent_full_name}\n")
        
        # Additional closing statements if needed
        if script_ops.data_scripting_generate_dml_statements:
            if db_type == DBType.MSSQL:
                out_buffer.write("END --of INSERT as against potentially existing data\n")
            elif db_type == DBType.PostgreSQL:
                out_buffer.write("\t\tEND IF;--of INSERT as against potentially existing data\n")
        
        out_buffer.write("\n")

    # Second round: DELETES and UPDATES: most dependent to least dependent
    drows_ents = tbl_ents[(tbl_ents["enttype"] == "Table") & (tbl_ents["scriptdata"] == True)].sort_values("scriptsortorder").to_dict('records')
    for drow_ent in drows_ents:
        s_ent_full_name = f"{drow_ent['entschema']}.{drow_ent['entname'].replace("'", "''")}"
        if s_ent_full_name in ar_no_script:
            # Comment was already given for this table. No need for more
            # add_print(0, out_buffer, f"'Data table '{s_ent_full_name}' has no primary key columns. Data cannot be scripted'")
            continue

        s_ent_full_name_sql=''
        if db_type == DBType.MSSQL:
            s_ent_full_name_sql = f"[{drow_ent['entschema']}].[{drow_ent['entname']}]"
        elif db_type == DBType.PostgreSQL:
            s_ent_full_name_sql = f"{drow_ent['entschema']}.{drow_ent['entname']}"
        
        s_ent_var_name = re.sub(r'[ \\/\$#:,\.]', '_', f"{drow_ent['entschema']}_{drow_ent['entname']}")
        s_flag_ent_created = f"{s_ent_var_name}{FLAG_CREATED}"

        if s_ent_full_name_sql in ar_tables_empty:
            out_buffer.write(f"\t\t--Table {s_ent_full_name_sql} needs to be empty: just delete everything\n")

            if db_type == DBType.MSSQL:
                out_buffer.write(f"\t\tIF exists(select 1 from {s_ent_full_name_sql})\n")
                out_buffer.write("\t\tBEGIN\n")
                out_buffer.write(f"\t\t\tSET {db_syntax.var_prefix}sqlCode='DELETE {s_ent_full_name_sql}' --it should be empty, so just delete everything\n")
                utils.add_exec_sql(db_type, 3, out_buffer)
                out_buffer.write("\t\tEND\n")
            elif db_type == DBType.PostgreSQL:
                # Only check for existing data if table wasn't just created (it would be empty anyway)
                out_buffer.write(f"\t\tIF ({s_flag_ent_created} = False) THEN\n")
                out_buffer.write(f"\t\t\tIF exists(select 1 from {s_ent_full_name_sql}) THEN\n")
                out_buffer.write(f"\t\t\t\t{db_syntax.var_prefix}sqlCode := 'DELETE FROM {s_ent_full_name_sql}'; --it should be empty, so just delete everything\n")
                utils.add_exec_sql(db_type, 4, out_buffer)
                out_buffer.write("\t\t\tEND IF;\n")
                out_buffer.write("\t\tEND IF;\n")

            continue  # Table is empty - nothing to do here

        s_temp_table_name = f"{db_syntax.temp_table_prefix}{re.sub(r'[ \\/\$#:,\.]', '_', drow_ent['entschema'] + '_' + drow_ent['entname'])}"

        # Check for settings override
        tbl_settings = None
        got_settings_override = False
        
        #!like comments above, need to decide if we're reactivating this feature
        #if drow_ent['TableToScript'] is not None:
        #    ds_data = drow_ent['TableToScript']
        #    tbl_settings = ds_data.tables[TABLE_NAME_SETTINGS]
        #    got_settings_override = True

        # Get columns based on settings
        #if not got_settings_override or tbl_settings is None:
            #if script_ops.data_window_only:
            #    drows_cols = tbl_db_tables_cols.select(f"object_id={drow_ent['EntKey']} AND is_computed=0 AND {DATA_WINDOW_COL_USED}=1", "column_id")
            #else:

        
        drows_cols = []
        if db_type == DBType.MSSQL:
            drows_cols = schema_tables.columns[
                    (schema_tables.columns["object_id"] == drow_ent["entkey"]) & 
                    ((schema_tables.columns["is_computed"] == 0))
                ].sort_values("column_id").to_dict('records')
        elif db_type == DBType.PostgreSQL:
            drows_cols = schema_tables.columns[
                    (schema_tables.columns["object_id"] == drow_ent["entkey"]) & 
                    ((schema_tables.columns["is_computed"] == 0) | (schema_tables.columns["is_computed"].isnull()))
                ].sort_values("column_id").to_dict('records')
        #else:
            #drows_cols = tbl_settings.select("IsKey=true OR IsCompare=true")

        # Handle data window specific case
        tbl_data = None
        limit_cols_by_data_window = False
        
        #!reactivate feature when and if needed
        #if script_ops.data_window_only:
            #if drow_ent['TableToScript'] is not None:
                #ds_data = drow_ent['TableToScript']
                #tbl_data = ds_data.tables[TABLE_NAME_DATA]
                #if tbl_data is not None:
                #    limit_cols_by_data_window = True
        tbl_data = schema_tables.tables_data[s_ent_full_name] #so instead of the 'TablesToScript' deactivation above, i just put this
        
        # Load arrays for faster iteration
        ar_cols = [] #line 3073 in .net. we are 1 leve in, in iteration of drow_ent for deletes and updates
        ar_key_cols = []
        ar_no_key_cols = []
        ar_no_key_cols_no_compare = []
        
        for d_row_col in drows_cols:
            if limit_cols_by_data_window:
                if d_row_col['col_name'] not in tbl_data.columns:
                    continue
            
            ar_cols.append(d_row_col['col_name'])
            
            # Some types cannot be compared, mark them here
            if not utils.can_type_be_compared(d_row_col['user_type_name']):
                ar_no_key_cols_no_compare.append(d_row_col['col_name'])

        # Find uniqueness
        if not got_settings_override or tbl_settings is None:
            if db_type == DBType.MSSQL:
                drow_unq_index = schema_tables.indexes.query(f"object_id=={drow_ent['entkey']} & is_unique==1").sort_values("is_primary_key", ascending=False).to_dict('records')
            else:
                drow_unq_index = schema_tables.indexes.query(f"object_id=='{drow_ent['entkey']}' & is_unique==1").sort_values("is_primary_key", ascending=False).to_dict('records')
            
            if len(drow_unq_index) == 0:
                if s_ent_full_name not in ar_warned_no_script_data_tables:  # So won't warn twice
                    utils.add_print(db_type, 0, out_buffer, f"'Data table '{s_ent_full_name}' has no uniqueness. Data cannot be scripted'")
                continue
            
            if db_type == DBType.MSSQL:
                drows_unq_cols = schema_tables.index_cols.query(f"object_id=={drow_ent['entkey']} & index_id=={drow_unq_index[0]['index_id']}").to_dict('records')
            else:
                drows_unq_cols = schema_tables.index_cols.query(f"object_id=='{drow_ent['entkey']}' & index_name=='{drow_unq_index[0]['index_name']}'").to_dict('records')
        else:
            drows_unq_cols = tbl_settings.select("IsKey=true")

        for d_row_col in drows_unq_cols:
            ar_key_cols.append(d_row_col['col_name'])

        # Build non-key columns list
        for col_name in ar_cols:
            if col_name in ar_key_cols:
                continue
            ar_no_key_cols.append(col_name)

        # Records to be removed and updated
        out_buffer.write("--Records to be deleted or removed: Do not even check if the table was just created\n") #3213 in .net. in iteration for deletes and updates
        
        if db_type == DBType.MSSQL:
            out_buffer.write(f"IF (@{s_flag_ent_created}=0)  --Records to be deleted or removed: do not even check if the table was just created\n")
            out_buffer.write("BEGIN\n")
        elif db_type == DBType.PostgreSQL:
            out_buffer.write(f"IF ({s_flag_ent_created}=False) THEN --Records to be deleted or removed: do not even check if the table was just created\n")
            # Add check to skip data comparison if table has pending column additions and execCode=False
            # This prevents errors when trying to SELECT columns that don't exist in the target database
            out_buffer.write(f"-- Skip data comparison if table has pending column changes and execCode=False (columns don't exist yet)\n")
            out_buffer.write(f"IF (execCode = True OR NOT EXISTS(SELECT 1 FROM ScriptCols WHERE LOWER(ScriptCols.table_schema) = LOWER('{drow_ent['entschema']}') AND LOWER(ScriptCols.table_name) = LOWER('{drow_ent['entname']}') AND ScriptCols.colStat = 1)) THEN\n")

        out_buffer.write("--records to be removed:\n")
        # Insert the ones we're deleting, just before deleting them
        if db_type == DBType.MSSQL:
            out_buffer.write(f"SET @sqlCode='INSERT INTO {s_temp_table_name} (\n")
            
            for col_name in ar_cols:
                out_buffer.write(f"[{col_name}], ")
            
            out_buffer.write(f"{FLD_COMPARE_STATE})")  # Last field
            out_buffer.write(" SELECT ")
            
            for col_name in ar_cols:
                if db_type == DBType.MSSQL:
                    out_buffer.write(f"p.[{col_name}], ")
                elif db_type == DBType.PostgreSQL:
                    out_buffer.write(f"p.{col_name}, ")
            
            out_buffer.write(f"''{RowState.EXTRA2.value}''")
            
            # Check for WHERE clause
            #! again, this feature, may activate if there's a need, maybe never
            #s_where = None
            #if drow_ent['TableToScript'] is not None:
            #    s_where = utils.get_where_from_settings_dset(drow_ent['TableToScript'])
            
            #if s_where:
            #    s_source_table_name = f"(SELECT * FROM {s_ent_full_name_sql} WHERE {s_where.replace("'", "''")})"
            #else:
            s_source_table_name = s_ent_full_name_sql
            
            out_buffer.write(f" FROM {s_source_table_name} p LEFT JOIN {s_temp_table_name} t ON ")
            
            count = 1
            col_count = len(ar_key_cols)
            
            for col_name in ar_key_cols:
                out_buffer.write(f"p.{col_name}=t.{col_name}")
                if count < col_count:
                    out_buffer.write(" AND ")
                count += 1
            
            out_buffer.write(f" WHERE (t.[{ar_key_cols[0]}] IS NULL)'\n")
            
            if not script_ops.data_window_only:
                out_buffer.write("EXEC (@sqlCode)\n")
            else:
                out_buffer.write("--EXEC (@sqlCode) --deactivated since we're doing a 'Data Window'. Dont delete stuff that's outside\n")
        
        elif db_type == DBType.PostgreSQL:
            out_buffer.write(f"sqlCode :='INSERT INTO {s_temp_table_name} (\n")
            
            for col_name in ar_cols:
                out_buffer.write(f"{col_name}, ")
            
            out_buffer.write(f"{FLD_COMPARE_STATE})")  # Last field
            out_buffer.write(" SELECT ")
            
            for col_name in ar_cols:
                out_buffer.write(f"p.{col_name}, ")
            
            out_buffer.write(f"''{RowState.EXTRA2.value}''")
            
            # Check for WHERE clause
            # !again, this feature, may activate if there's a need, maybe never
            #s_where = None
            #if drow_ent['TableToScript'] is not None:
            #    s_where = utils.get_where_from_settings_dset(drow_ent['TableToScript'])
            
            #if s_where:
            #    s_source_table_name = f"(SELECT * FROM {s_ent_full_name_sql} WHERE {s_where.replace("'", "''")})"
            #else:
            s_source_table_name = s_ent_full_name_sql
            
            out_buffer.write(f" FROM {s_source_table_name} p LEFT JOIN {s_temp_table_name} t ON ")
            
            count = 1
            col_count = len(ar_key_cols)
            
            for col_name in ar_key_cols:
                out_buffer.write(f"p.{col_name}=t.{col_name}")
                if count < col_count:
                    out_buffer.write(" AND ")
                count += 1
            
            out_buffer.write(f" WHERE (t.{ar_key_cols[0]} IS NULL)';\n")
            
            if not script_ops.data_window_only:
                out_buffer.write("EXECUTE sqlCode;\n")
            else:
                out_buffer.write("--EXEC (@sqlCode) --deactivated since we're doing a 'Data Window'. Dont delete stuff that's outside\n")

        # Remove all extra records
        s_source_table_name = "" #3221 in .net
        if db_type == DBType.MSSQL:
            out_buffer.write("IF NOT (@printExec=1 AND @execCode=0 AND @" + s_flag_ent_created + "=1) --Table was just created, but we want to print and not execute (so its not really created, can't really compare against existing data, table is not there\n")
            out_buffer.write("BEGIN\n")
            out_buffer.write("\n")
            out_buffer.write("--remove all extra records:\n")
            out_buffer.write(f"If ({db_syntax.var_prefix}execCode=1)\n")
            out_buffer.write("BEGIN\n")
            
            if s_where:
                s_source_table_name = f"(SELECT * FROM {s_ent_full_name_sql} WHERE {s_where.replace("'", "''")})"
            else:
                s_source_table_name = s_ent_full_name_sql
            
            out_buffer.write(f"\tSET {db_syntax.var_prefix}sqlCode = 'DELETE {s_ent_full_name_sql} FROM {s_source_table_name} p LEFT JOIN {s_temp_table_name} t ON ")
            
            count = 1
            col_count = len(ar_key_cols)
            
            for col_name in ar_key_cols:
                out_buffer.write(f"p.{col_name}=t.{col_name}")
                if count < col_count:
                    out_buffer.write(" AND ")
                count += 1
            
            out_buffer.write(f" WHERE (t.[{ar_key_cols[0]}] IS NULL OR ({FLD_COMPARE_STATE}={RowState.EXTRA2.value}))'")
            out_buffer.write(f" --Need to check {FLD_COMPARE_STATE} in case we've asked a 'data report', then those extra records to be deleted will actually be in the temp table\n")
            
            if not script_ops.data_window_only:
                out_buffer.write(f"\tEXEC ({db_syntax.var_prefix}sqlCode)\n")
            else:
                out_buffer.write("--EXEC (@sqlCode) --deactivated since we're doing a 'Data Window'. Dont delete stuff that's outside\n")
            
            out_buffer.write("END --'of: 'remove all extra recods'\n")
        
        elif db_type == DBType.PostgreSQL:
            out_buffer.write(f"IF NOT (printExec=True AND execCode=False AND {s_flag_ent_created}=True) THEN --Table was just created, but we want to print and not execute (so its not really created, can't really compare against existing data, table is not there\n")
            out_buffer.write("--remove all extra records:\n")
            out_buffer.write(f"If ({db_syntax.var_prefix}execCode=True) THEN\n")
            
            if s_where:
                s_source_table_name = f"(SELECT * FROM {s_ent_full_name_sql} WHERE {s_where.replace("'", "''")})"
            else:
                s_source_table_name = s_ent_full_name_sql
            
            out_buffer.write(f"\tsqlCode = 'DELETE FROM {s_source_table_name} orig USING {s_temp_table_name} AS p LEFT JOIN {s_temp_table_name} AS t ON ")
            
            # Build WHERE key clause
            s_where_key_clause = []
            count = 1
            col_count = len(ar_key_cols)
            
            for col_name in ar_key_cols:
                out_buffer.write(f"p.{col_name}=t.{col_name}")
                s_where_key_clause.append(f"orig.{col_name}=t.{col_name}")
                
                if count < col_count:
                    out_buffer.write(" AND ")
                count += 1
            
            s_where_key_str = " AND ".join(s_where_key_clause)
            out_buffer.write(f" WHERE ({s_where_key_str}) AND (t.{ar_key_cols[0]} IS NULL OR (t.{FLD_COMPARE_STATE}={RowState.EXTRA2.value}))';")
            out_buffer.write(f" --Need to check {FLD_COMPARE_STATE} in case we've asked a 'data report', then those extra records to be deleted will actually be in the temp table\n")
            
            if not script_ops.data_window_only:
                out_buffer.write("EXECUTE sqlCode;\n")
            else:
                out_buffer.write("--EXEC (@sqlCode) --deactivated since we're doing a 'Data Window'. Dont delete stuff that's outside\n")
            
            out_buffer.write("END IF; --'of: 'remove all extra recods'\n")
            out_buffer.write("END IF; --Of 'Records to be deleted or removed: do not even check if the table was just created'\n")
            out_buffer.write("END IF; --of skip data comparison if table has pending column changes\n")
            out_buffer.write("END IF; --of table was just created\n")
        
        out_buffer.write("\n")

        # Records in both: find which need to be updated #3288
        # Wrap in check for JustCreated flag - if table was just created, temp table doesn't exist
        if db_type == DBType.PostgreSQL:
            out_buffer.write(f"IF ({s_flag_ent_created} = False) THEN -- Only check for updates if temp table exists\n")

        if db_type == DBType.MSSQL:
            if (len(ar_no_key_cols) - len(ar_no_key_cols_no_compare)) > 0:  # Could be a table that PK actually covers all fields
                out_buffer.write("--records in both: find which need to be updated\n")
                out_buffer.write(f"SET {db_syntax.var_prefix}sqlCode = 'UPDATE {s_temp_table_name} SET {FLD_COMPARE_STATE}={RowState.DIFF.value}\n")
                out_buffer.write(f" FROM {s_temp_table_name} t INNER JOIN {s_source_table_name} p ON ")
                
                count = 1
                col_count = len(ar_key_cols)
                
                for key_col_name in ar_key_cols:
                    out_buffer.write(f"t.{key_col_name} = p.{key_col_name}")
                    if count < col_count:
                        out_buffer.write(" AND ")
                    count += 1
                
                out_buffer.write(" WHERE ")
                
                count = 1
                col_count = len(ar_no_key_cols) - len(ar_no_key_cols_no_compare)
                
                for no_key_col_name in ar_no_key_cols:
                    if no_key_col_name in ar_no_key_cols_no_compare:
                        continue
                    
                    if script_ops.data_window_got_specific_cells:
                        out_buffer.write("((")
                    
                    out_buffer.write(f"(t.[{no_key_col_name}]<> p.[{no_key_col_name}]) OR (t.[{no_key_col_name}] IS NULL AND p.[{no_key_col_name}] IS NOT NULL) OR (t.[{no_key_col_name}] IS NOT NULL AND p.[{no_key_col_name}] IS NULL)")
                    
                    if script_ops.data_window_got_specific_cells:
                        out_buffer.write(f") AND {NO_UPDATE_FLD}{no_key_col_name} IS NULL)")
                    
                    if count < col_count:
                        out_buffer.write(" OR ")
                    
                    count += 1
                
                out_buffer.write("'\n")
                out_buffer.write("EXEC (@sqlCode)\n")
        
        elif db_type == DBType.PostgreSQL:
            if (len(ar_no_key_cols) - len(ar_no_key_cols_no_compare)) > 0:  # Could be a table that PK actually covers all fields
                out_buffer.write("--records in both: find which need to be updated\n")
                out_buffer.write(f"sqlCode = 'UPDATE {s_temp_table_name} orig SET {FLD_COMPARE_STATE}={RowState.DIFF.value}\n")
                out_buffer.write(f" FROM {s_temp_table_name} t WHERE (\n")
                
                count = 1
                col_count = len(ar_key_cols)
                
                for key_col_name in ar_key_cols:
                    out_buffer.write(f"orig.{key_col_name} = t.{key_col_name}")
                    if count < col_count:
                        out_buffer.write(" AND ")
                    count += 1
                
                out_buffer.write(") AND ( ")
                
                count = 1
                col_count = len(ar_no_key_cols) - len(ar_no_key_cols_no_compare)
                
                for no_key_col_name in ar_no_key_cols:
                    if no_key_col_name in ar_no_key_cols_no_compare:
                        continue
                    
                    if script_ops.data_window_got_specific_cells:
                        out_buffer.write("((")
                    
                    out_buffer.write(f"(orig.{no_key_col_name}<> t.{no_key_col_name}) OR (orig.{no_key_col_name} IS NULL AND t.{no_key_col_name} IS NOT NULL) OR (orig.{no_key_col_name} IS NOT NULL AND t.{no_key_col_name} IS NULL)")
                    
                    if script_ops.data_window_got_specific_cells:
                        out_buffer.write(f") AND {NO_UPDATE_FLD}{no_key_col_name} IS NULL)")
                    
                    if count < col_count:
                        out_buffer.write(" OR ")
                    
                    count += 1
                
                out_buffer.write(")';\n")
                out_buffer.write("EXECUTE sqlCode; --flagging the temp table with records that need to be updated\n")

        out_buffer.write("\n")
        out_buffer.write("--update fields that are different:\n") #3346. we are in the updates and deletes look per entity. so 2 tabs ident is good
        # Handle field updates
        if db_type == DBType.MSSQL:
            for col_name in ar_no_key_cols:
                # First, report it (this must be done BEFORE we actually update)
                if script_ops.data_scripting_leave_report_fields_updated:
                    out_buffer.write(f"--Updating differences in '{col_name}' for reporting purposes\n")
                    out_buffer.write(f"ALTER TABLE {s_temp_table_name} ADD [{DIFF_BIT_FLD}{col_name}] bit NULL\n")
                    
                    if script_ops.data_scripting_leave_report_fields_updated_save_old_value:
                        drows_col = schema_tables.columns.query(f"object_id={drow_ent['EntKey']} AND name='{col_name}'")
                        if len(drows_col) != 1:
                            raise Exception(f"Internal error: column '{col_name}' not found when about to script retaining its existing value")
                        
                        out_buffer.write("--and retaining old value for full report\n")
                        out_buffer.write(f"ALTER TABLE {s_temp_table_name} ADD [{EXISTING_FLD_VAL_PREFIX}{drows_col[0]['name']}] {drows_col[0]['user_type_name']} {code_funcs.add_size_precision_scale(drows_col[0])} NULL\n")
                    
                    out_buffer.write(f"SET @sqlCode='UPDATE {s_temp_table_name} SET [{DIFF_BIT_FLD}{col_name}] = 1, {FLD_COMPARE_STATE}={RowState.DIFF.value}\n")
                    
                    if script_ops.data_scripting_leave_report_fields_updated_save_old_value:
                        out_buffer.write(f",[{EXISTING_FLD_VAL_PREFIX}{col_name}] = p.[{col_name}]\n")
                    
                    out_buffer.write(f" FROM {s_temp_table_name} t INNER JOIN {s_source_table_name} p ON ")
                    
                    count = 1
                    col_count = len(ar_key_cols)
                    
                    for key_col_name in ar_key_cols:
                        out_buffer.write(f"t.{key_col_name} = p.{key_col_name}")
                        if count < col_count:
                            out_buffer.write(" AND ")
                        count += 1
                    
                    out_buffer.write(" WHERE ")
                    
                    if script_ops.data_window_got_specific_cells:
                        out_buffer.write("(")
                    
                    if col_name not in ar_no_key_cols_no_compare:
                        out_buffer.write(f"(t.[{col_name}]<> p.[{col_name}]) OR ")
                    else:
                        out_buffer.write(f"/*{col_name} is of a type that cannot be compared, so just updating if there is a NULL difference. Nothing else we can do*/")
                    
                    out_buffer.write(f"(t.[{col_name}] IS NULL AND p.[{col_name}] IS NOT NULL) OR (t.[{col_name}] IS NOT NULL AND p.[{col_name}] IS NULL)")
                    
                    if script_ops.data_window_got_specific_cells:
                        out_buffer.write(f") AND {NO_UPDATE_FLD}{col_name} IS NULL")
                    
                    out_buffer.write("'\n")
                    out_buffer.write("EXEC (@sqlCode)\n")
                
                out_buffer.write("If (@execCode=1)\n") #3390
                out_buffer.write("BEGIN\n")
                out_buffer.write(f"\tSET @sqlCode='UPDATE {s_ent_full_name_sql} SET [{col_name}] = t.[{col_name}]\n")
                out_buffer.write(f" FROM {s_ent_full_name_sql} p INNER JOIN {s_temp_table_name} t ON ")
                
                count = 1
                col_count = len(ar_key_cols)
                
                for key_col_name in ar_key_cols:
                    out_buffer.write(f"p.[{key_col_name}] = t.[{key_col_name}]")
                    if count < col_count:
                        out_buffer.write(" AND ")
                    count += 1
                
                out_buffer.write(" WHERE ")
                
                if script_ops.data_window_got_specific_cells:
                    out_buffer.write("(")
                
                if col_name not in ar_no_key_cols_no_compare:
                    out_buffer.write(f"(t.[{col_name}]<> p.[{col_name}]) OR ")
                else:
                    out_buffer.write(f"/*{col_name} is of a type that cannot be compared, so just updating if there is a NULL difference. Nothing else we can do*/")
                
                out_buffer.write(f"(t.[{col_name}] IS NULL AND p.[{col_name}] IS NOT NULL) OR (t.[{col_name}] IS NOT NULL AND p.[{col_name}] IS NULL)")
                
                if script_ops.data_window_got_specific_cells:
                    out_buffer.write(f") AND {NO_UPDATE_FLD}{col_name} IS NULL")
                
                out_buffer.write("'\n")
                out_buffer.write("\tEXEC (@sqlCode)\n")
                out_buffer.write("END\n")
        
        elif db_type == DBType.PostgreSQL: #3418
            # Skip update fields if table has pending column additions and execCode=False
            # This prevents errors when trying to access columns that don't exist in the target database
            out_buffer.write(f"-- Skip update fields if table has pending column changes and execCode=False (columns don't exist yet)\n")
            out_buffer.write(f"IF (execCode = True OR NOT EXISTS(SELECT 1 FROM ScriptCols WHERE LOWER(ScriptCols.table_schema) = LOWER('{drow_ent['entschema']}') AND LOWER(ScriptCols.table_name) = LOWER('{drow_ent['entname']}') AND ScriptCols.colStat = 1)) THEN\n")
            for col_name in ar_no_key_cols:
                # First, report it (this must be done BEFORE we actually update)
                if script_ops.data_scripting_leave_report_fields_updated:
                    out_buffer.write(f"--Updating differences in '{col_name}' for reporting purposes\n")
                    out_buffer.write(f"ALTER TABLE {s_temp_table_name} ADD {DIFF_BIT_FLD}{col_name} Boolean NULL;\n")
                    
                    if script_ops.data_scripting_leave_report_fields_updated_save_old_value:
                        if db_type == DBType.MSSQL:
                            drows_col = schema_tables.columns.query(f"object_id={drow_ent['EntKey']} AND col_name='{col_name}'")
                        elif db_type == DBType.PostgreSQL:
                            drows_col = schema_tables.columns.query(f"object_id=='{drow_ent['entkey']}' & col_name=='{col_name}'")
                        
                        if len(drows_col) != 1:
                            raise Exception(f"Internal error: column '{col_name}' not found when about to script retaining its existing value")
                        
                        out_buffer.write("--and retaining old value for full report\n")
                        precision_scale= code_funcs.add_size_precision_scale(drows_col.iloc[0])
                        add_col_sql = f"ALTER TABLE {s_temp_table_name} ADD {EXISTING_FLD_VAL_PREFIX}{drows_col.iloc[0]['col_name']} {drows_col.iloc[0]['user_type_name']} {precision_scale} NULL;\n"
                        out_buffer.write(add_col_sql )
                    
                    if db_type == DBType.MSSQL:
                        out_buffer.write(f"SET @sqlCode='UPDATE {s_temp_table_name} SET {DIFF_BIT_FLD}{col_name} = True, {FLD_COMPARE_STATE}={RowState.DIFF.value}\n")
                        
                        if script_ops.data_scripting_leave_report_fields_updated_save_old_value:
                            out_buffer.write(f",{EXISTING_FLD_VAL_PREFIX}{col_name} = p.{col_name}\n")
                        
                        out_buffer.write(f" FROM {s_temp_table_name} t INNER JOIN {s_source_table_name} p ON ")
                        
                        count = 1
                        col_count = len(ar_key_cols)
                        
                        for key_col_name in ar_key_cols:
                            out_buffer.write(f"t.{key_col_name}= p.{key_col_name}")
                            if count < col_count:
                                out_buffer.write(" AND ")
                            count += 1
                        
                        out_buffer.write(" WHERE ")
                        
                        if script_ops.data_window_got_specific_cells:
                            out_buffer.write("(")
                        
                        if col_name not in ar_no_key_cols_no_compare:
                            out_buffer.write(f"(t.{col_name}<> p.{col_name}) OR ")
                        else:
                            out_buffer.write(f"/*{col_name} is of a type that cannot be compared, so just updating if there is a NULL difference. Nothing else we can do*/")
                        
                        out_buffer.write(f"(t.{col_name} IS NULL AND p.{col_name} IS NOT NULL) OR (t.{col_name} IS NOT NULL AND p.{col_name} IS NULL)")
                        
                        if script_ops.data_window_got_specific_cells:
                            out_buffer.write(f") AND {NO_UPDATE_FLD}{col_name} IS NULL")
                        
                        out_buffer.write("';")
                        out_buffer.write("EXECUTE sqlCode;")
                    
                    elif db_type == DBType.PostgreSQL:
                        out_buffer.write(f"sqlCode='UPDATE {s_temp_table_name} orig SET {DIFF_BIT_FLD}{col_name} = True, {FLD_COMPARE_STATE}={RowState.DIFF.value}\n")
                        
                        if script_ops.data_scripting_leave_report_fields_updated_save_old_value:
                            out_buffer.write(f",{EXISTING_FLD_VAL_PREFIX}{col_name} = p.{col_name}\n")
                        
                        out_buffer.write(f" FROM {s_source_table_name} p ")
                        out_buffer.write(" WHERE (")
                        
                        count = 1
                        col_count = len(ar_key_cols)
                        
                        for key_col_name in ar_key_cols:
                            out_buffer.write(f"orig.{key_col_name} = p.{key_col_name}")
                            if count < col_count:
                                out_buffer.write(" AND ")
                            count += 1
                        
                        out_buffer.write(") AND (")
                        
                        if script_ops.data_window_got_specific_cells:
                            out_buffer.write("(")
                        
                        if col_name not in ar_no_key_cols_no_compare:
                            out_buffer.write(f"(orig.{col_name}<> p.{col_name}) OR ")
                        else:
                            out_buffer.write(f"/*{col_name} is of a type that cannot be compared, so just updating if there is a NULL difference. Nothing else we can do*/")
                        
                        out_buffer.write(f"(orig.{col_name} IS NULL AND p.{col_name} IS NOT NULL) OR (orig.{col_name} IS NOT NULL AND p.{col_name} IS NULL)")
                        
                        if script_ops.data_window_got_specific_cells:
                            out_buffer.write(f") AND {NO_UPDATE_FLD}{col_name} IS NULL")
                        
                        out_buffer.write(")';")
                        out_buffer.write("EXECUTE sqlCode;") #3494. and ther's no END IF below so for now deactivating
                        #out_buffer.write("END IF;\n")

                out_buffer.write("If (execCode=True) THEN\n")
                out_buffer.write(f"\tsqlCode ='UPDATE {s_ent_full_name_sql} orig SET {col_name} = p.{col_name}\n")
                out_buffer.write(f" FROM {s_temp_table_name} p \n")
                out_buffer.write(" WHERE (")

                # The table to itself - required in PG, not in MS
                count = 1
                col_count = len(ar_key_cols)
                for key_col_name in ar_key_cols:
                    out_buffer.write(f"orig.{key_col_name} = p.{key_col_name}")
                    if count < col_count:
                        out_buffer.write(" AND ")
                    count += 1

                out_buffer.write(") AND (")

                if script_ops.data_window_got_specific_cells:
                    out_buffer.write("(")

                if col_name not in ar_no_key_cols_no_compare:  # MPBF
                    out_buffer.write(f"(orig.{col_name}<> p.{col_name}) OR ")  # If that field cannot be compared (say, type XML) simply update if one is null and the other isn't
                else:
                    out_buffer.write(f"/*{col_name} is of a type that cannot be compared, so just updating if there is a NULL difference. Nothing else we can do*/")

                out_buffer.write(f"(orig.{col_name} IS NULL AND p.{col_name} IS NOT NULL) OR (orig.{col_name} IS NOT NULL AND p.{col_name} IS NULL))")

                if script_ops.data_window_got_specific_cells:
                    out_buffer.write(f") AND {NO_UPDATE_FLD}{col_name} IS NULL")

                out_buffer.write("';\n")
                out_buffer.write("\tEXECUTE sqlCode;\n")
                out_buffer.write("END IF;\n")
            out_buffer.write("END IF; --of skip update fields if table has pending column changes\n")


        # Generate individual DML statements for delete, update
        if script_ops.data_scripting_generate_dml_statements: #3531
            out_buffer.write("\n")
            
            if db_type == DBType.MSSQL:
                out_buffer.write("--generating individual DML statements: DELETE, UPDATE\n")
                out_buffer.write("IF (@printExec=1 ) --only if asked to print, since that's the only reason they are here\n")
                out_buffer.write("BEGIN\n")
                
                cursor_temp_table_var_name = s_temp_table_name[1:]  # Remove the #
                out_buffer.write(f"DECLARE {cursor_temp_table_var_name} CURSOR FAST_FORWARD FOR\n")
                out_buffer.write("SELECT ")
                
                for col_name_select in ar_cols:
                    out_buffer.write(f"[{col_name_select}], ")
                    if script_ops.data_scripting_leave_report_fields_updated_save_old_value:
                        if col_name_select not in ar_key_cols:  # We don't do it for key columns
                            out_buffer.write(f"[{EXISTING_FLD_VAL_PREFIX}{col_name_select}], ")
                
                out_buffer.write(f"[{FLD_COMPARE_STATE}]")
                
                if len(ar_no_key_cols) > 0:
                    out_buffer.write(",")
                
                # Add flag fields
                count = 1
                col_count = len(ar_no_key_cols)
                
                for col_name in ar_no_key_cols:
                    out_buffer.write(f"[{DIFF_BIT_FLD}{col_name}]")
                    if count < col_count:
                        out_buffer.write(",")
                    count += 1
                
                out_buffer.write(f" FROM {s_temp_table_name} WHERE {FLD_COMPARE_STATE} IN ({RowState.EXTRA2.value},{RowState.DIFF.value})\n")  # Deleted, updated
                
                # Create variable names and SQL builders
                fields_var_names = []
                field_list = []
                fields_update_set_list = StringIO()
                fields_flag_varnames = []
                cols_var_names = []
                
                count = 1
                col_count = len(drows_cols)
                
                for d_row_col in drows_cols:
                    if limit_cols_by_data_window:
                        if d_row_col['name'] not in tbl_data.columns:
                            continue
                    
                    col_var_name = f"{s_ent_var_name}_{re.sub(r'[ \\/\$#:,\.]', '_', d_row_col['col_name'])}"
                    cols_var_names.append(col_var_name)
                    
                    fields_var_names.append(f"@{col_var_name}")
                    field_list.append(f"[{d_row_col['col_name']}]")
                    
                    if script_ops.data_scripting_leave_report_fields_updated_save_old_value:
                        if d_row_col['col_name'] not in ar_key_cols:  # We don't do it for key columns
                            fields_var_names.append(f", @{EXISTING_FLD_VAL_PREFIX}{col_var_name}")
                            field_list.append(f", [{EXISTING_FLD_VAL_PREFIX}{d_row_col['col_name']}]")
                    
                    # Add update SET list according to type
                    add_var_update_to_sql_str(
                        db_type = db_type,
                        db_syntax = db_syntax,
                        col_name = d_row_col['col_name'],
                        var_name = col_var_name,
                        type_name = d_row_col['user_type_name'],
                        pref_each_line = "\t\t\t",
                        script = fields_update_set_list,
                        save_old_value = script_ops.data_scripting_leave_report_fields_updated_save_old_value
                    )
                    
                    fields_var_names.append(", ")
                    
                    if count < col_count:
                        field_list.append(", ")
                    
                    count += 1
                
                # Build flag variables names
                count = 1
                col_count = len(ar_no_key_cols)
                
                for col_name in ar_no_key_cols:
                    col_var_name = re.sub(r'[ \\/\$#:,\.]', '_', col_name)
                    fields_flag_varnames.append(f"@{DIFF_BIT_FLD}{s_ent_var_name}_{col_var_name}")
                    if count < col_count:
                        fields_flag_varnames.append(",")
                    count += 1
                
                # Build primary key WHERE clause
                str_where_pk = []
                count = 1
                col_count = len(drows_unq_cols)
                
                for d_row_col in drows_unq_cols:
                    col_var_name = re.sub(r'[ \\/\$#:,\.]', '_', d_row_col['col_name'])
                    where_part = f"[{d_row_col['col_name']}]='''+"
                    is_string, is_datetime = utils.is_type_string(d_row_col['user_type_name'])
                    if is_string:
                        where_part += f"@{s_ent_var_name}_{col_var_name}"
                    else:
                        where_part += f"CAST({db_syntax.var_prefix}{s_ent_var_name}_{col_var_name} AS character varying)"
                    
                    where_part += "+''''"
                    
                    if count < col_count:
                        where_part += "+' AND  \n"
                    
                    str_where_pk.append(where_part)
                    count += 1
                
                str_where_pk_joined = ''.join(str_where_pk)
                
                # Add comparison state variable
                fields_var_names.append(f"@{FLD_COMPARE_STATE}")
                
                if fields_flag_varnames:
                    fields_var_names.append(", ")
                
                # Write cursor operations
                out_buffer.write(f"OPEN {cursor_temp_table_var_name}\n")
                out_buffer.write(f"FETCH NEXT FROM {cursor_temp_table_var_name} INTO {''.join(fields_var_names)}{''.join(fields_flag_varnames)}\n")
                out_buffer.write("WHILE @@FETCH_STATUS = 0\n")
                out_buffer.write("BEGIN\n")
                out_buffer.write("\t--Does the row need to be added, updated, removed?\n")
                out_buffer.write("\tSET @sqlCode = NULL --reset\n")
                out_buffer.write(f"\tIF (@{FLD_COMPARE_STATE}={RowState.EXTRA2.value}) --to be dropped\n")
                out_buffer.write("\tBEGIN\n")
                out_buffer.write(f"\t\tSET @sqlCode='DELETE FROM {s_ent_full_name_sql} WHERE {str_where_pk_joined}\n")
                out_buffer.write("\tEND\n")
                out_buffer.write("\tELSE\n")
                out_buffer.write("\tBEGIN\n")
                out_buffer.write(f"\t\tIF (@{FLD_COMPARE_STATE}={RowState.DIFF.value}) --to be updated\n")
                out_buffer.write("\t\tBEGIN\n")
                out_buffer.write(f"\t\t\tSET @sqlCode='UPDATE {s_ent_full_name_sql} SET '\n")
                out_buffer.write(fields_update_set_list.getvalue())
                
                out_buffer.write(f"\t\t\tSET @sqlCode = LEFT(@sqlCode,LEN(@sqlCode)-1) + ' WHERE {str_where_pk_joined}\n")
                out_buffer.write("\t\tEND\n")
                out_buffer.write("\tEND\n")
                out_buffer.write("\tIF (@printExec=1) PRINT @sqlCode\n")
                out_buffer.write("\n")
                out_buffer.write(f"\tFETCH NEXT FROM {cursor_temp_table_var_name} INTO {''.join(fields_var_names)}{''.join(fields_flag_varnames)}\n")
                out_buffer.write("End\n")
                out_buffer.write("\n")
                out_buffer.write(f"CLOSE {cursor_temp_table_var_name}\n")
                out_buffer.write(f"DEALLOCATE {cursor_temp_table_var_name}\n")
                out_buffer.write("END --of generating DML statements: UPDATE, DELETE\n")
                out_buffer.write("\n")
            
            elif db_type == DBType.PostgreSQL: #3654
                out_buffer.write("--generating individual DML statements: DELETE, UPDATE\n")
                out_buffer.write("IF (printExec=True) THEN --only if asked to print, since that's the only reason they are here\n")
                out_buffer.write(f"\tPERFORM 1 from {db_syntax.temp_table_prefix}{s_temp_table_name} s WHERE s.{FLD_COMPARE_STATE} IN ({RowState.EXTRA2.value},{RowState.DIFF.value});\n")
                out_buffer.write("\tIF FOUND THEN\n")
                
                # Variables for PostgreSQL implementation
                fields_var_names = []
                field_list = []
                fields_var_names_value_list = []
                fields_update_set_list = StringIO()
                cols_var_names = []
                
                count = 1
                col_count = len(drows_cols)
                
                for d_row_col in drows_cols:
                    if d_row_col['col_name'] in ar_key_cols:
                        continue  # Skip key columns for this part
                    
                    col_var_name = f"{s_ent_var_name}_{re.sub(r'[ \\/\$#:,\.]', '_', d_row_col['col_name'])}"
                    cols_var_names.append(col_var_name)
                    
                    field_list.append(d_row_col['col_name'])
                    
                    # Add update SET list according to type
                    add_var_update_to_sql_str(
                        db_type = db_type,
                        db_syntax = db_syntax,
                        col_name = d_row_col['col_name'],
                        var_name = col_var_name,
                        type_name = d_row_col['user_type_name'],
                        pref_each_line = "\t\t\t",
                        script = fields_update_set_list,
                        save_old_value=script_ops.data_scripting_leave_report_fields_updated_save_old_value
                    )
                    
                    fields_var_names.append(", ")
                    
                    if count < col_count:
                        fields_var_names_value_list.append("\t\t\tsqlCode = sqlCode || ','; \n")
                        field_list.append(", ")
                    
                    count += 1
                
                # Build WHERE clause for PostgreSQL
                str_where_pk = []
                count = 1
                col_count = len(drows_unq_cols)
                
                for d_row_col in drows_unq_cols:
                    col_var_name = re.sub(r'[ \\/\$#:,\.]', '_', d_row_col['col_name'])
                    where_part = f"orig.{d_row_col['col_name']}=''' || "
                    is_string, is_datetime = utils.is_type_string(d_row_col['user_type_name'])
                    if is_string:
                        where_part += f"temprow.{col_var_name}"
                    else:
                        where_part += f"CAST({db_syntax.var_prefix} temprow.{d_row_col['col_name']} AS VARCHAR(20))"
                    
                    where_part += " || ''''"
                    
                    if count < col_count:
                        where_part += " || ' AND  \n"
                    
                    str_where_pk.append(where_part)
                    count += 1
                
                str_where_pk_joined = ''.join(str_where_pk)
                
                # PostgreSQL record loop
                out_buffer.write("\t\tdeclare temprow record;\n")
                out_buffer.write("\t\tBEGIN\n")
                out_buffer.write("\t\t\tFOR temprow IN\n")
                out_buffer.write("\t\t\t\tSELECT  ")
                
                count = 1
                col_count = len(drows_cols)
                for d_row_col in drows_cols:
                    out_buffer.write(f"{d_row_col['col_name']} ")
                    if d_row_col['col_name'] not in ar_key_cols:
                        out_buffer.write(f", {DIFF_BIT_FLD}{d_row_col['col_name']} ")
                        if script_ops.data_scripting_leave_report_fields_updated_save_old_value:                            
                            out_buffer.write(f", {EXISTING_FLD_VAL_PREFIX}{d_row_col['col_name']} ")
                    
                    if count < col_count:
                        out_buffer.write(",")
                    
                    count += 1
                
                out_buffer.write(f",s.{FLD_COMPARE_STATE}") #3700

                str_where_pk = []
                count = 1
                col_count = len(drows_unq_cols)

                for d_row_col in drows_unq_cols:
                    col_var_name = re.sub(r'[ \\/\$#:,\.]', '_', d_row_col['col_name'])
                    where_clause = f"s.{d_row_col['col_name']}=''' || "
                    is_string, is_datetime = utils.is_type_string(d_row_col['user_type_name'])
                    if is_string:
                        where_clause += f"temprow.{col_var_name}"
                    else:
                        where_clause += f"CAST({db_syntax.var_prefix} temprow.{d_row_col['col_name']} AS VARCHAR(20))"
                    
                    where_clause += " || ''''"
                    
                    if count < col_count:
                        where_clause += " || ' AND  \n"
                    
                    str_where_pk.append(where_clause)
                    count += 1  # Comment from original: 3/21/14. how come we didn't have it before?? i guess it was all 1-field PK?

                # Join the parts into a single string when needed
                str_where_pk_joined = ''.join(str_where_pk)
                

                out_buffer.write(f" FROM {db_syntax.temp_table_prefix}{s_temp_table_name} s WHERE s.{FLD_COMPARE_STATE} IN ({RowState.EXTRA2.value},{RowState.DIFF.value})\n") #3719
                out_buffer.write("\t\tLOOP\n")
                out_buffer.write(f"If (temprow._CmprState_={RowState.EXTRA2.value}) THEN --to be dropped\n")
                out_buffer.write(f"\tsqlCode='DELETE FROM {s_ent_full_name_sql} s WHERE {str_where_pk_joined}; \n")
                out_buffer.write("\tIf (printExec = True) THEN\n")
                out_buffer.write("\t\tINSERT INTO scriptoutput (SQLText)\n")
                out_buffer.write("\t\tVALUES (sqlCode);\n")
                out_buffer.write("\tEnd If;\n")
                out_buffer.write("ELSE\n")
                out_buffer.write(f"If (temprow._CmprState_={RowState.DIFF.value}) THEN--to be updated\n")
                out_buffer.write(f"\t\t\tsqlCode='UPDATE {s_ent_full_name_sql} orig SET ';\n")                
                out_buffer.write(fields_update_set_list.getvalue())                
                out_buffer.write(f"\t\t\tsqlCode = LEFT(sqlCode,LENGTH(sqlCode)-1) || ' WHERE {str_where_pk_joined} ;\n")
                out_buffer.write("\t\t\tIF (printExec=True) THEN\n")
                out_buffer.write("\t\t\t\tINSERT INTO scriptoutput (SQLText)\n")
                out_buffer.write("\t\t\t\tVALUES (sqlCode);\n")
                out_buffer.write("\t\t\tEND IF;\n")
                out_buffer.write("\t\tEND IF; --of To be updated\n")
                out_buffer.write("\tEND IF; --Of If-Then To be dropped\n")
                out_buffer.write("\t\tEND LOOP;\n")
                out_buffer.write("\tEND; --of record iteration (temprow) \n")
                out_buffer.write("\tEND IF; --of IF FOUND (for generating individual DML statements: DELETE, UPDATE)\n")
                out_buffer.write("END IF; --of if asked to print\n")
        
        

        # Final cleanup and table state SQL
        if db_type == DBType.MSSQL: #3747
            out_buffer.write("\t\tEND--of DELETing\\UPDATEing " + s_ent_full_name + "\n")
            out_buffer.write("\tEND --!Of Records To be deleted Or removed, If table wasn't_JustCreated (if just created, not doing any of this)\n")
            out_buffer.write("\n")
            out_buffer.write(f"SELECT @NumNonEqualRecs=COUNT(*) FROM {s_temp_table_name} WHERE {FLD_COMPARE_STATE}<>0\n")
            out_buffer.write("IF @NumNonEqualRecs>0\n")
            out_buffer.write("BEGIN\n")
            out_buffer.write("\tPRINT '' --empty line before final report line, for readability\n")
            
            comment_prefix = "--" if script_ops.data_scripting_generate_dml_statements else ""
            out_buffer.write(f"\tPRINT '{comment_prefix}SELECT * FROM [{s_temp_table_name}] --to get the full state of the data comparison (column {FLD_COMPARE_STATE}: {RowState.EXTRA1.value}=Added, {RowState.EXTRA2.value}=Removed, {RowState.DIFF.value}=Updated). There were '+CAST(@NumNonEqualRecs AS VARCHAR(10)) +' records that were different'\n")
            out_buffer.write("END\n")
        
        elif db_type == DBType.PostgreSQL:
            out_buffer.write("\n")
            out_buffer.write(f"NumNonEqualRecs := COUNT(*) FROM {s_temp_table_name} s WHERE s.{FLD_COMPARE_STATE}<>1;\n")
            out_buffer.write(f"IF {db_syntax.var_prefix}NumNonEqualRecs>0 THEN\n")
            comment_prefix = "--" if script_ops.data_scripting_generate_dml_statements else ""
            utils.add_print(db_type, 1, out_buffer, f"'There were ' || NumNonEqualRecs || ' records that were different. {comment_prefix}SELECT * FROM {s_temp_table_name}; --to get the full state of the data comparison. for summary do: SELECT CASE _cmprstate_ WHEN 1 THEN ''Added'' WHEN 2 THEN ''Removed'' WHEN 3 THEN ''Updated'' ELSE ''Unknown'' END AS state, count(*) AS count FROM {s_temp_table_name} GROUP BY _cmprstate_;'")
            # Update ScriptTables to mark data as different
            out_buffer.write(f"\tUPDATE ScriptTables SET dataStat = 3 WHERE LOWER(ScriptTables.table_schema) = LOWER('{drow_ent['entschema']}') AND LOWER(ScriptTables.table_name) = LOWER('{drow_ent['entname']}');\n")
            out_buffer.write("END IF;\n")
            out_buffer.write(f"END IF; -- of check for {s_flag_ent_created} = False (temp table exists)\n")

    # CSV Export of both sides data for comparison
    if db_type == DBType.PostgreSQL and table_columns_map:
        # CSV files go in same directory as html_output_path
        csv_output_dir = os.path.dirname(input_output.html_output_path).replace("\\", "/")

        out_buffer.write("\n--CSV Export of comparison data----------------------------------\n")
        out_buffer.write("-- Export when: exportCsv=True, OR (htmlReport=True AND table has data differences)\n")

        for drow_ent in drows_ents:
            s_ent_full_name = f"{drow_ent['entschema']}.{drow_ent['entname']}"

            if s_ent_full_name not in table_columns_map:
                continue  # Skip tables that weren't processed (empty or no key)

            s_ent_full_name_sql = f"{drow_ent['entschema']}.{drow_ent['entname']}"
            col_names = ", ".join(table_columns_map[s_ent_full_name])
            csv_file_indb = f"{csv_output_dir}/{drow_ent['entschema']}_{drow_ent['entname']}_indb.csv"

            # Export if exportCsv=True OR (htmlReport=True AND this table has data differences)
            # Also check: skip if table has pending column additions and execCode=False (columns don't exist yet)
            out_buffer.write(f"IF ((exportCsv = True OR (htmlReport = True AND EXISTS(SELECT 1 FROM ScriptTables WHERE LOWER(ScriptTables.table_schema) = LOWER('{drow_ent['entschema']}') AND LOWER(ScriptTables.table_name) = LOWER('{drow_ent['entname']}') AND ScriptTables.dataStat = 3)))")
            out_buffer.write(f" AND (execCode = True OR NOT EXISTS(SELECT 1 FROM ScriptCols WHERE LOWER(ScriptCols.table_schema) = LOWER('{drow_ent['entschema']}') AND LOWER(ScriptCols.table_name) = LOWER('{drow_ent['entname']}') AND ScriptCols.colStat = 1))) THEN\n")
            out_buffer.write(f"\t-- Database data for {s_ent_full_name} (current state in DB)\n")
            out_buffer.write(f"\tCREATE TEMP TABLE temp_csv_export AS SELECT {col_names} FROM {s_ent_full_name_sql};\n")
            out_buffer.write(f"\tEXECUTE format('COPY temp_csv_export TO %L WITH (FORMAT CSV, HEADER)', '{csv_file_indb}');\n")
            out_buffer.write(f"\tDROP TABLE temp_csv_export;\n")
            out_buffer.write(f"\tRAISE NOTICE 'CSV file created: {csv_file_indb}';\n")
            out_buffer.write("END IF;\n\n")

        out_buffer.write("--End CSV Export--------------------------------------------------------------\n")

        # Generate self-contained HTML comparison files for tables with data differences
        # This avoids CORS issues when opening local files
        out_buffer.write("\n--Generate HTML comparison files for tables with data differences------------\n")
        out_buffer.write("IF (htmlReport = True) THEN\n")

        csv_compare_template = f"{csv_output_dir}/csv_compare_standalone.html"

        for drow_ent in drows_ents:
            s_ent_full_name = f"{drow_ent['entschema']}.{drow_ent['entname']}"

            if s_ent_full_name not in table_columns_map:
                continue

            table_file_prefix = f"{drow_ent['entschema']}_{drow_ent['entname']}"
            source_csv_file = f"{csv_output_dir}/{table_file_prefix}.csv"
            compare_html_file = f"{csv_output_dir}/compare_{table_file_prefix}.html"
            col_names = ", ".join(table_columns_map[s_ent_full_name])
            key_cols = table_key_columns_map.get(s_ent_full_name, [])
            key_cols_sql_array = "ARRAY[" + ", ".join([f"'{k}'" for k in key_cols]) + "]::text[]"
            s_ent_full_name_sql = f"{drow_ent['entschema']}.{drow_ent['entname']}"

            out_buffer.write(f"\n\t-- Generate comparison HTML for {s_ent_full_name} if data differs\n")
            out_buffer.write(f"\tIF EXISTS(SELECT 1 FROM ScriptTables WHERE LOWER(ScriptTables.table_schema) = LOWER('{drow_ent['entschema']}') AND LOWER(ScriptTables.table_name) = LOWER('{drow_ent['entname']}') AND ScriptTables.dataStat = 3) THEN\n")
            out_buffer.write("\t\tDECLARE\n")
            out_buffer.write("\t\t\ttemplate_content text;\n")
            out_buffer.write("\t\t\tsource_csv text;\n")
            out_buffer.write("\t\t\ttarget_csv text;\n")
            out_buffer.write("\t\t\tfinal_html text;\n")
            out_buffer.write("\t\t\tinjected_script text;\n")
            out_buffer.write("\t\tBEGIN\n")
            out_buffer.write(f"\t\t\t-- Read template and source CSV\n")
            out_buffer.write(f"\t\t\tSELECT pg_read_file('{csv_compare_template}') INTO template_content;\n")
            out_buffer.write(f"\t\t\tSELECT pg_read_file('{source_csv_file}') INTO source_csv;\n")
            out_buffer.write(f"\t\t\t\n")
            out_buffer.write(f"\t\t\t-- Read target CSV from the _indb file we already exported\n")
            out_buffer.write(f"\t\t\tSELECT pg_read_file('{csv_output_dir}/{table_file_prefix}_indb.csv') INTO target_csv;\n")
            out_buffer.write(f"\t\t\t\n")
            out_buffer.write(f"\t\t\t-- Create JavaScript to inject data (including primary key columns for auto-comparison)\n")
            include_equal_rows_sql = "true" if script_ops.data_comparison_include_equal_rows else "false"
            out_buffer.write(f"\t\t\tinjected_script := '<script>window.autoLoadData = ' || \n")
            out_buffer.write(f"\t\t\t\tjson_build_object('source', source_csv, 'target', target_csv, 'keys', {key_cols_sql_array}, 'includeEqualRows', {include_equal_rows_sql}, 'tableName', '{s_ent_full_name_sql}', 'sourceLabel', 'Script', 'targetLabel', 'Database')::text || \n")
            out_buffer.write(f"\t\t\t\t';</script>';\n")
            out_buffer.write(f"\t\t\t\n")
            out_buffer.write(f"\t\t\t-- Inject script before </head>\n")
            out_buffer.write(f"\t\t\tfinal_html := replace(template_content, '</head>', injected_script || '</head>');\n")
            out_buffer.write(f"\t\t\t\n")
            out_buffer.write(f"\t\t\t-- Write the comparison HTML file\n")
            out_buffer.write(f"\t\t\tDROP TABLE IF EXISTS temp_compare_html;\n")
            out_buffer.write(f"\t\t\tCREATE TEMP TABLE temp_compare_html (content text);\n")
            out_buffer.write(f"\t\t\tINSERT INTO temp_compare_html VALUES (final_html);\n")
            out_buffer.write(f"\t\t\tEXECUTE format('COPY temp_compare_html TO %L WITH (FORMAT CSV, QUOTE E''\\x01'', DELIMITER E''\\x02'')', '{compare_html_file}');\n")
            out_buffer.write(f"\t\t\tDROP TABLE temp_compare_html;\n")
            out_buffer.write(f"\t\t\t\n")
            out_buffer.write(f"\t\t\tRAISE NOTICE 'Comparison HTML created: {compare_html_file}';\n")
            out_buffer.write("\t\tEND;\n")
            out_buffer.write("\tEND IF;\n")

        out_buffer.write("END IF; --htmlReport\n")
        out_buffer.write("--End HTML comparison files---------------------------------------------------\n")

    out_buffer.write("END; --end of data section\n")



def add_var_update_to_sql_str(db_type: DBType,  db_syntax: DBSyntax, col_name, var_name, type_name, pref_each_line, script: StringIO, save_old_value):
    if db_type == DBType.MSSQL:
        script.write(f"IF (@{DIFF_BIT_FLD}{var_name}=1)\n")
        script.write("BEGIN\n")
        script.write(f"\tIF @{var_name} IS NULL\n")
        script.write(f"\t\tSET @sqlCode+='[{col_name}]=NULL'\n")
        script.write("\tELSE\n")
        
        is_datetime = False
        is_string, is_datetime = utils.is_type_string(type_name)
        if not is_string:
            datetime_prefix = "''" if is_datetime else ""
            datetime_format = "FORMAT(" if is_datetime else ""
            datetime_suffix = ", 'yyyy-MM-dd HH:mm:ss.fff')" if is_datetime else ""
            datetime_quotes = "+''''" if is_datetime else ""
            
            script.write(f"\tSET @sqlCode+='[{col_name}]={datetime_prefix}'+CAST({datetime_format}@{var_name}{datetime_suffix} AS varchar(max)){datetime_quotes}\n")
            
            if save_old_value:
                script.write("\n")
                script.write(f"\tIF @{EXISTING_FLD_VAL_PREFIX}{var_name} IS NULL\n")
                script.write("\t\t SET @sqlCode += '/*NULL*/'\n")
                script.write("\tELSE\n")
                script.write(f"\t\tSET @sqlCode += '/*' + CAST({datetime_format}@{EXISTING_FLD_VAL_PREFIX}{var_name}{datetime_suffix} AS varchar(max)) + '*/'\n")
        else:
            script.write(f"\tSET @sqlCode+='[{col_name}]= '''+@{var_name}+''''\n")
            
            if save_old_value:
                script.write("\n")
                script.write(f"\tIF @{EXISTING_FLD_VAL_PREFIX}{var_name} IS NULL\n")
                script.write("\t\t SET @sqlCode += '/*NULL*/'\n")
                script.write("\tELSE\n")
                script.write(f"\t\tSET @sqlCode += '/*' + @{EXISTING_FLD_VAL_PREFIX}{var_name} + '*/'\n")
        
        script.write("\tSET @sqlCode += ','\n")
        script.write("END\n")
        
    elif db_type == DBType.PostgreSQL:
        script.write(f"{pref_each_line}IF (temprow.{DIFF_BIT_FLD}{col_name}=True) THEN\n")
        script.write(f"{pref_each_line}\tIF temprow.{col_name} IS NULL THEN\n")
        script.write(f"{pref_each_line}\t\tsqlCode = sqlCode || '{col_name}=NULL';\n")
        script.write(f"{pref_each_line}\tELSE\n")
        
        is_datetime = False
        is_string, is_datetime = utils.is_type_string(type_name)
        if not is_string:
            if is_datetime:
                script.write(f"{pref_each_line}\t\tsqlCode = sqlCode || '{col_name}=''' || CAST(Format(CAST(temprow.{col_name} AS character varying), 'yyyy-MM-dd HH:mm:ss.fff') AS {db_syntax.nvarchar_type})  || '''';\n")
            else:
                script.write(f"{pref_each_line}\t\tsqlCode = sqlCode || '{col_name}=' || CAST(temprow.{col_name} AS {db_syntax.nvarchar_type});\n")
            
            if save_old_value:
                script.write(f"{pref_each_line}\t\tIF temprow.{EXISTING_FLD_VAL_PREFIX}{col_name} IS NULL THEN\n")
                script.write(f"{pref_each_line}\t\t\tsqlCode = sqlCode || '/*NULL*/';\n")
                script.write(f"{pref_each_line}\t\tELSE\n")
                
                datetime_format = "FORMAT(CAST(" if is_datetime else ""
                datetime_suffix = " AS character varying), 'yyyy-MM-dd HH:mm:ss.fff')" if is_datetime else ""
                
                script.write(f"{pref_each_line}\t\t\tsqlCode = sqlCode || '/*' || CAST({datetime_format}temprow.{EXISTING_FLD_VAL_PREFIX}{col_name}{datetime_suffix} As {db_syntax.nvarchar_type}) || '*/';\n")
                script.write(f"{pref_each_line}\t\tEND IF;\n")
        else:
            script.write(f"{pref_each_line}\t\tsqlCode = sqlCode || '{col_name}= ''' || temprow.{col_name} || ''''; --DML Update: set the value\n")
            
            if save_old_value:
                script.write(f"{pref_each_line}\t\tIF temprow.{EXISTING_FLD_VAL_PREFIX}{col_name} IS NULL THEN\n")
                script.write(f"{pref_each_line}\t\t\tsqlCode = sqlCode || '/*NULL*/';\n")
                script.write(f"{pref_each_line}\t\tELSE\n")
                script.write(f"{pref_each_line}\t\t\tsqlCode = sqlCode || '/*' || temprow.{EXISTING_FLD_VAL_PREFIX}{col_name} || '*/';\n")
                script.write(f"{pref_each_line}\t\tEND IF;\n")
        
        script.write(f"{pref_each_line}\tEND IF; --of: if field IS NULL\n")
        script.write(f"{pref_each_line}\tsqlCode = sqlCode || ',';\n")
        script.write(f"{pref_each_line}END IF; --of: if diffbit flag is true\n")
    
    script.write("\n")