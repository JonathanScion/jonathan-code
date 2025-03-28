import pandas as pd
from io import StringIO
import re
from enum import Enum
from typing import Optional, Dict, List
import datetime


from src.data_load.from_db.load_from_db_pg import DBSchema
from src.defs.script_defs import DBType, DBSyntax, ScriptingOptions, ScriptTableOptions
from src.utils import funcs as utils
from src.utils import code_funcs 
from src.generate.generate_final_create_table import get_create_table_from_sys_tables, get_col_sql


class RowState(Enum):
    EQUAL = 0
    EXTRA1 = 1
    EXTRA2 = 2
    DIFF = 3

def script_data(schema_tables: DBSchema, db_type: DBType, tbl_ents: pd.DataFrame, script_ops: ScriptingOptions, db_syntax: DBSyntax, out_buffer: StringIO):
    # Constants
    DIFF_BIT_FLD = "_DiffBit_"
    FLD_COMPARE_STATE = "_CmprState_"
    EXISTING_FLD_VAL_PREFIX = "_ExistingVal_"
    NO_UPDATE_FLD = "_NoUpdate_"
    DATA_WINDOW_COL_USED = "_DataWindowColUsed_"
    FLAG_CREATED = "FlagCreated"
    FLD_COLS_CELLS_EXCLUDE_FOR_ROW = "_nh_row_cells_excluded_"
    
        
    # Get entities that need data scripting
    drows_ents = tbl_ents[(tbl_ents["enttype"] == "Table") & (tbl_ents["scriptdata"] == True)].sort_values("scriptsortorder").to_dict('records')
    
    if len(drows_ents) == 0:
        return  # No data, nothing to script
    
    out_buffer.write("--Data-----------------------------------------------------------------------------\n")
    
    # Handle option combination
    if script_ops.data_scripting_generate_dml_statements:
        script_ops.data_scripting_leave_report_fields_updated = True
    
    # General variable declarations
    if script_ops.data_scripting_generate_dml_statements:
        out_buffer.write(f"DECLARE {db_syntax.var_prefix}{FLD_COMPARE_STATE} smallint;\n")
    
    out_buffer.write(f"DECLARE {db_syntax.var_prefix}NumNonEqualRecs INT;\n")
    
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
        out_buffer.write(f"{declare_stmt}{db_syntax.var_prefix}{s_flag_ent_created} {db_syntax.boolean_type} {db_syntax.var_set_value} false; --This flag is used in case the script was doing schema, and this table was just created. this script is not doing schema for '{s_ent_full_name_sql}'so the table wasn't just created. set it to 1 if it did, in which case the script will just do a bunch of INSERTs as against comparing to existing data\n")
    
    # Need two rounds: one for insertions and one for deletes/updates
    ar_tables_empty = []
    ar_tables_identity = []
    
    # Start with INSERTs
    out_buffer.write("BEGIN --Data Code\n")
    
    if len(drows_ents) > 0:
        if db_type == DBType.MSSQL:
            out_buffer.write(f"IF ({db_syntax.var_prefix}schemaChanged=1 and {db_syntax.var_prefix}execCode=0)\n")
            out_buffer.write("\tPRINT '--Note: Changes were found in the schema but not executed (because execution flag is turned off) - Data migration may therefore not work'\n")
        else:  # PostgreSQL
            out_buffer.write(f"IF ({db_syntax.var_prefix}schemaChanged=True and {db_syntax.var_prefix}execCode=False) THEN\n")
            utils.add_print(db_type, 1, out_buffer, "Note: Changes were found in the schema but not executed (because execution flag is turned off) - Data migration may therefore not work'")
            out_buffer.write("END IF;\n")
    
    
    ar_warned_no_script_data_tables = []
    s_where = None
    ar_no_script = []
    
    # 1st round: insertions
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
            continue
            
        s_flag_ent_created = s_ent_var_name + FLAG_CREATED
        
        # Set flag if table was just created
        
        if len(tbl_ents[(tbl_ents["scriptschema"] == True) & (tbl_ents["enttype"] == "Table")]) > 0:
            if db_type == DBType.MSSQL:
                out_buffer.write(f"IF EXISTS(SELECT * FROM #ScriptTables WHERE table_schema='{drow_ent['entschema']}' AND table_name='{drow_ent['entname'].replace("'", "''")}' AND tablestat=1)\n")
                out_buffer.write(f"\tSET {db_syntax.var_prefix}{s_flag_ent_created}=1\n")
                out_buffer.write("ELSE\n")
                out_buffer.write(f"\tSET {db_syntax.var_prefix}{s_flag_ent_created}=0\n")
            else:  # PostgreSQL
                out_buffer.write(f"perform 1 from scripttables T WHERE T.table_schema='{drow_ent['entschema']}' AND T.table_name='{drow_ent['entname'].replace("'", "''")}' AND tablestat=1;\n")
                out_buffer.write("IF FOUND THEN\n")
                out_buffer.write(f"\t{db_syntax.var_prefix}{s_flag_ent_created} := true;\n")
                out_buffer.write("ELSE\n")
                out_buffer.write(f"\t{db_syntax.var_prefix}{s_flag_ent_created} := false;\n")
                out_buffer.write("END IF;\n")
        else:
            # Table definitely not just created because we didn't script schema
            if db_type == DBType.MSSQL:
                out_buffer.write(f"SET {db_syntax.var_prefix}{s_flag_ent_created}=0\n")
            else:  # PostgreSQL
                out_buffer.write(f"{db_syntax.var_prefix}{s_flag_ent_created} := 0;\n")
            
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
        
        # Load columns for faster iteration
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
            utils.add_print(db_type, 0, out_buffer, f"'Data table ''{s_ent_full_name}'' has no columns to be scripted'")
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
                    utils.add_print(db_type, 0, out_buffer, f"'Data table ''{s_ent_full_name}'' has no uniqueness. Data cannot be scripted'")
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
            utils.add_print(db_type, 0, out_buffer, f"'Data table ''{s_ent_full_name}'' has no primary key columns. Data cannot be scripted.{additional_msg}'")
            continue
            
        # Find non-key columns
        for s_col_name in ar_cols:
            if s_col_name in ar_key_cols:
                continue
            ar_no_key_cols.append(s_col_name)
            
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
            out_buffer.write(f"IF (OBJECT_ID('tempdb..#{s_temp_table_name}') IS NOT NULL)\n")
            out_buffer.write(f"\tDROP TABLE #{s_temp_table_name}\n")
        else:  # PostgreSQL
            out_buffer.write(f"perform n.nspname, c.relname\n")
            out_buffer.write(f"FROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace\n")
            out_buffer.write(f"WHERE n.nspname like 'pg_temp_%' AND c.relname='{s_temp_table_name}' AND pg_catalog.pg_table_is_visible(c.oid);\n")
            out_buffer.write("IF FOUND THEN\n")
            out_buffer.write(f"\tDROP TABLE {s_temp_table_name};\n")
            out_buffer.write("END IF;\n")

        # Handle DML statement generation
        if script_ops.data_scripting_generate_dml_statements:
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
                out_buffer.write(f"IF (printExec=True AND execCode=False AND {s_flag_ent_created}=True) THEN --Table was just created, but we want to print and not execute (so its not really created, can't really compare against existing data, table is not there\n")
                out_buffer.write("\t--we are in PRINT mode here. Table needs to be created but wasn't (because we're printing, not executing) so just spew out the full INSERT statements\n")
                
                # Generate INSERT statements for PostgreSQL
                i_count = 0
                i_col_count = len(ar_cols)
                
                for index, row in tbl_data.iterrows():
                    s_insert_into = []
                    s_insert_into.append(f"INSERT INTO {s_ent_full_name_sql} (")
                    i_count = 1
                    for s_col_name in ar_cols:
                        s_insert_into.append(s_col_name)
                        if i_count < i_col_count:
                            s_insert_into.append(",")
                        i_count += 1
                    s_insert_into.append(")\n")
                    s_insert_into.append(" VALUES (")
                    i_count = 1
                    for s_col_name in ar_cols:
                        o_val = row.get(s_col_name)
                        if pd.isna(o_val):  # Equivalent to IsDBNull
                            s_insert_into.append("NULL")
                        else:
                            s_insert_into.append("''")
                            if isinstance(o_val, (datetime.datetime, datetime.date)):
                                s_insert_into.append(o_val.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3])
                            else:
                                s_insert_into.append(str(o_val).replace("'", "''"))
                            s_insert_into.append("''")
                        if i_count < i_col_count:
                            s_insert_into.append(",")
                        i_count += 1
                    s_insert_into.append(");'")
                    
                    full_insert = "".join(s_insert_into)
                    out_buffer.write(f"\t\tINSERT INTO scriptoutput (SQLText)\n")
                    out_buffer.write(f"\t\tVALUES ('--{full_insert});\n")
                    
                out_buffer.write("\n")
                out_buffer.write(f"--END IF;--of Batch INSERT of all the data into {s_ent_full_name}\n")
                out_buffer.write("ELSE --and this begins the INSERT as against potentially existing data\n")

        # Write table name comment
        out_buffer.write(f"--Data for '{s_ent_full_name}'\n")
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
            utils.add_print(db_type, 0, out_buffer, f"'Table ''{s_ent_full_name}'' cannot be scripted: {create_table_err.replace("'", "''")}'")
            continue

        out_buffer.write(create_table + "\n\n")

        # Handle special case: data window with specific cells
        if script_ops.data_window_only and script_ops.data_window_got_specific_cells:
            out_buffer.write("--we are updating a 'Data Window' with specific cells selected. UPDATE needs to have special flags\n")
            for s_col_name in ar_cols:
                out_buffer.write(f"ALTER TABLE {db_syntax.temp_table_prefix}{s_temp_table_name} ADD [{NO_UPDATE_FLD}{s_col_name}] BIT NULL;\n")
            out_buffer.write("\n")

        i_col_count = len(ar_cols)

        # Handle specific data cells scenario
        b_got_specific_data_cells = False
        if script_ops.data_window_only and script_ops.data_window_got_specific_cells:
            b_got_specific_data_cells = FLD_COLS_CELLS_EXCLUDE_FOR_ROW in tbl_data.columns

        # Insert data into temp table
        for index, row in tbl_data.iterrows():
            out_buffer.write(f"INSERT INTO {db_syntax.temp_table_prefix}{s_temp_table_name} (\n")
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
            
            out_buffer.write(")\n")
            out_buffer.write(" VALUES (")
            i_count = 1
            for s_col_name in ar_cols:
                o_val = row.get(s_col_name)
                if pd.isna(o_val):
                    out_buffer.write("NULL")
                else:
                    out_buffer.write("'")
                    if isinstance(o_val, (datetime.datetime, datetime.date)):
                        out_buffer.write(o_val.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3])
                    else:
                        out_buffer.write(str(o_val).replace("'", "''"))
                    out_buffer.write("'")
                if i_count < i_col_count:
                    out_buffer.write(",")
                i_count += 1
            
            # Add values for specific cells columns
            if b_got_specific_data_cells and s_cells is not None:
                for _ in s_cells:
                    out_buffer.write(",1")  # Mark as true
            
            out_buffer.write(");\n")

        out_buffer.write("\n")
        out_buffer.write("--add status field, and update it:\n")
        out_buffer.write(f"ALTER TABLE {db_syntax.temp_table_prefix}{s_temp_table_name} ADD {FLD_COMPARE_STATE} smallint NULL;\n")

        # Find records to add
        out_buffer.write("--Records to be added:\n")
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
            # PostgreSQL version
            out_buffer.write(f"UPDATE {s_temp_table_name} orig SET {FLD_COMPARE_STATE}={RowState.EXTRA1.value} FROM {db_syntax.temp_table_prefix}{s_temp_table_name} t LEFT JOIN {s_source_table_name} p ON ")
            
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
            out_buffer.write("--add all missing records:\n")
            out_buffer.write(f"IF ({db_syntax.var_prefix}execCode=True) THEN\n")
            
            # Generate insert statement
            out_buffer.write(f"\tsqlCode := 'INSERT INTO {s_ent_full_name_sql}(")
            i_count = 1
            i_col_count = len(ar_cols)
            for s_col_name in ar_cols:
                out_buffer.write(s_col_name)
                if i_count < i_col_count:
                    out_buffer.write(", ")
                i_count += 1
            
            out_buffer.write(")\n")
            out_buffer.write(" SELECT ")
            i_count = 1
            i_col_count = len(ar_cols)
            for s_col_name in ar_cols:
                out_buffer.write(s_col_name)
                if i_count < i_col_count:
                    out_buffer.write(", ")
                i_count += 1
            
            out_buffer.write(f" FROM {db_syntax.temp_table_prefix}{s_temp_table_name} WHERE {FLD_COMPARE_STATE}={RowState.EXTRA1.value}';\n")
            out_buffer.write("\tEXECUTE sqlCode;\n")
            out_buffer.write(f"END IF; --of INSERTing into {s_ent_full_name}\n")
     
        
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
                out_buffer.write("--generating individual DML statements: INSERTS\n")
                out_buffer.write("IF (printExec=True) THEN --only if asked to print, since that's the only reason they are here\n")
                out_buffer.write(f"\tPERFORM 1 from {db_syntax.temp_table_prefix}{s_temp_table_name} s WHERE s.{FLD_COMPARE_STATE}=1;\n")
                out_buffer.write("\tIF FOUND THEN\n")
                
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
                    
                    # Add value to SQL string
                    code_funcs.add_value_to_sql_str(db_type, row_col["col_name"], col_var_name, row_col["user_type_name"], "\t\t\t", fields_var_names_value_list)
                    
                    fields_var_names.append(", ")
                    
                    if count < col_count:
                        fields_var_names_value_list.append("\t\t\tsqlCode = sqlCode || ','; \n")
                        #field_list.append(", ") ne nada... we are doing ','.join so proper commans will be there
                    
                    count += 1
                
                # Write PostgreSQL specific code
                out_buffer.write("\t\tdeclare temprow record;\n")
                out_buffer.write("\t\tBEGIN\n")
                out_buffer.write("\t\t\tFOR temprow IN\n")
                out_buffer.write("\t\t\t\tSELECT ")
                
                count = 1
                for row_col in drows_cols:
                    out_buffer.write(row_col["col_name"])
                    if count < col_count:
                        out_buffer.write(",")
                    count += 1
                
                out_buffer.write(f" FROM {db_syntax.temp_table_prefix}{s_temp_table_name} s WHERE s.{FLD_COMPARE_STATE}={RowState.EXTRA1.value}\n")
                out_buffer.write("\t\tLOOP\n")
                out_buffer.write(f"\t\t\tsqlCode='INSERT INTO {s_ent_full_name_sql} ({', '.join(field_list)}) VALUES (';\n")
                
                for line in fields_var_names_value_list:
                    out_buffer.write(line)
                
                out_buffer.write("\t\t\tsqlCode = sqlCode ||  ')';\n")
                out_buffer.write("\t\t\tIF (printExec=True) THEN\n")
                out_buffer.write("\t\t\t\tINSERT INTO scriptoutput (SQLText)\n")
                out_buffer.write("\t\t\t\tVALUES (sqlCode);\n")
                out_buffer.write("\t\t\tEND IF;\n")
                out_buffer.write("\t\tEND LOOP;\n")
                out_buffer.write("\tEND; --of loop block \n")
            
            # Handle identity tables
            if s_ent_full_name_sql in ar_tables_identity:
                out_buffer.write(f"\t\tSET @sqlCode='SET IDENTITY_INSERT {s_ent_full_name_sql} OFF'\n")
                utils.add_exec_sql(db_type, 2, out_buffer)
            
            # Close the statements based on database type
            if db_type == DBType.MSSQL:
                out_buffer.write("END --of iterating cursor of data to insert\n")
                out_buffer.write(f"END --of generating DML statements: INSERT for {s_ent_full_name}\n")
            elif db_type == DBType.PostgreSQL:
                out_buffer.write("END IF; --of IF FOUND record iteration (temprow) \n")
                out_buffer.write(f"END IF; --of generating DML statements: INSERT for {s_ent_full_name}\n")
        
        # Additional closing statements if needed
        if script_ops.data_scripting_generate_dml_statements:
            if db_type == DBType.MSSQL:
                out_buffer.write("END --of INSERT as against potentially existing data\n")
            elif db_type == DBType.PostgreSQL:
                out_buffer.write("END IF;--of INSERT as against potentially existing data\n")
        
        out_buffer.write("\n")
     
    
    # The second round (deletes/updates) would follow similar patterns
    # ...
    
    out_buffer.write("END; --end of data section\n")