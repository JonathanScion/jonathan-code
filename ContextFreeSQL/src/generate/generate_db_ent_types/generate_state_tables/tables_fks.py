from enum import Enum
from typing import Optional, Dict, List
from dataclasses import dataclass
import pandas as pd
from io import StringIO
from src.defs.script_defs import DBType, DBSyntax, ScriptingOptions, ScriptTableOptions, DBEntScriptState
from src.generate.generate_create_table import get_create_table_from_sys_tables, get_col_sql
from src.data_load.from_db.load_from_db_pg import DBSchema
from src.utils.funcs import quote_str_or_null, quote_str_or_null_bool, numeric_or_null, bool_to_sql_bit_boolean_val
from src.generate.generate_create_table import get_fk_sql 
from src.utils.code_funcs import get_code_check_fk_data


def create_db_state_fks(
    schema_tables: DBSchema,
    tbl_ents_to_script: pd.DataFrame,
    db_type: DBType, # that's the destination db type
    overall_table_schema_name_in_scripting: Optional[str],
    scripting_data: Optional[bool] = False,
    remove_all_extra_ents: Optional[bool] = False,
    bad_data_pre_add_fk: Optional[StringIO] = None
) -> StringIO:
    
    db_syntax = DBSyntax.get_syntax(db_type)
    script_db_state_tables = StringIO()
    align = "\t" * 2  # 2, for now
    
    script_db_state_tables.write(f"\n\n")
    script_db_state_tables.write(f"{align}--Foreign Keys\n")
    
    # Handle different database types for temp table creation
    if db_type == DBType.MSSQL:
        script_db_state_tables.write(f"{align}IF (OBJECT_ID('tempdb..#ScriptFKs') IS NOT NULL)\n")
        script_db_state_tables.write(f"{align}BEGIN\n")
        script_db_state_tables.write(f"{align}\tDROP TABLE #ScriptFKs;\n")
        script_db_state_tables.write(f"{align}END;\n")
    elif db_type == DBType.PostgreSQL:
        script_db_state_tables.write(f"{align}perform  n.nspname ,c.relname\n")
        script_db_state_tables.write(f"{align}FROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace\n")
        script_db_state_tables.write(f"{align}WHERE n.nspname like 'pg_temp_%' AND c.relname='scriptfks' AND pg_catalog.pg_table_is_visible(c.oid);\n")
        script_db_state_tables.write(f"{align}IF FOUND THEN\n")
        script_db_state_tables.write(f"{align}\tDROP TABLE {db_syntax.temp_table_prefix}ScriptFKs;\n")
        script_db_state_tables.write(f"{align}END IF;\n")
    
    # Create foreign keys temp table
    script_db_state_tables.write(f"{align}{db_syntax.temp_table_create}ScriptFKs\n")
    script_db_state_tables.write(f"{align}(\n")
    script_db_state_tables.write(f"{align}\tfkey_table_schema {db_syntax.nvarchar_type}(128) not null,\n")
    script_db_state_tables.write(f"{align}\tfkey_table_name {db_syntax.nvarchar_type}(128) not null,\n")
    script_db_state_tables.write(f"{align}\tfk_name {db_syntax.nvarchar_type}(128) not null,\n")
    script_db_state_tables.write(f"{align}\trkey_table_schema {db_syntax.nvarchar_type}(128) null, --null because can insert extra FKs, to drop\n")
    script_db_state_tables.write(f"{align}\trkey_table_name {db_syntax.nvarchar_type}(128) null,\n")
    script_db_state_tables.write(f"{align}\tis_not_for_replication bit null,\n")
    script_db_state_tables.write(f"{align}\tis_not_for_replication_diff bit null,\n")
    script_db_state_tables.write(f"{align}\tis_not_trusted bit null,\n")
    script_db_state_tables.write(f"{align}\tis_not_trusted_diff bit null,\n")
    script_db_state_tables.write(f"{align}\tdelete_referential_action smallint null,\n")
    script_db_state_tables.write(f"{align}\tdelete_referential_action_diff {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tupdate_referential_action smallint null,\n")
    script_db_state_tables.write(f"{align}\tupdate_referential_action_diff {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tis_system_named bit null,\n")
    script_db_state_tables.write(f"{align}\tis_system_named_diff {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tunderlying_index_diff {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tSQL_CREATE {db_syntax.nvarchar_type}{db_syntax.max_length_str} null,\n")
    
    if scripting_data:
        script_db_state_tables.write(f"{align}\tSQL_CheckFKData {db_syntax.nvarchar_type}{db_syntax.max_length_str} null,\n")
        script_db_state_tables.write(f"{align}\tGotBadData {db_syntax.boolean_type} null,\n")
    
    script_db_state_tables.write(f"{align}\tfkStat smallint null,\n")
    script_db_state_tables.write(f"{align}\tcol_diff {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tdb_col_diff {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tindx_col_diff {db_syntax.boolean_type} null\n")
    script_db_state_tables.write(f"{align});\n")
    script_db_state_tables.write(f"{align}\n")
    
    # Create foreign key columns temp table
    script_db_state_tables.write(f"{align}--FK Column\n")
    if db_type == DBType.MSSQL:
        script_db_state_tables.write(f"{align}IF (OBJECT_ID('tempdb..#ScriptFKCols') IS NOT NULL)\n")
        script_db_state_tables.write(f"{align}BEGIN\n")
        script_db_state_tables.write(f"{align}\tDROP TABLE #ScriptFKCols;\n")
        script_db_state_tables.write(f"{align}END;\n")
    elif db_type == DBType.PostgreSQL:
        script_db_state_tables.write(f"{align}perform  n.nspname ,c.relname\n")
        script_db_state_tables.write(f"{align}FROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace\n")
        script_db_state_tables.write(f"{align}WHERE n.nspname like 'pg_temp_%' AND c.relname='scriptfkcols' AND pg_catalog.pg_table_is_visible(c.oid);\n")
        script_db_state_tables.write(f"{align}IF FOUND THEN\n")
        script_db_state_tables.write(f"{align}\tDROP TABLE {db_syntax.temp_table_prefix}ScriptFKCols;\n")
        script_db_state_tables.write(f"{align}END IF;\n")
    
    script_db_state_tables.write(f"{align}{db_syntax.temp_table_create}ScriptFKCols\n")
    script_db_state_tables.write(f"{align}(\n")
    script_db_state_tables.write(f"{align}\tfkey_table_schema {db_syntax.nvarchar_type}(128) not null,\n")
    script_db_state_tables.write(f"{align}\tfkey_table_name {db_syntax.nvarchar_type}(128) not null,\n")
    script_db_state_tables.write(f"{align}\tfk_name {db_syntax.nvarchar_type}(128) not null,\n")
    script_db_state_tables.write(f"{align}\trkey_table_schema {db_syntax.nvarchar_type}(128) not null,\n")
    script_db_state_tables.write(f"{align}\trkey_table_name {db_syntax.nvarchar_type}(128) not null,\n")
    script_db_state_tables.write(f"{align}\tfkey_col_name {db_syntax.nvarchar_type}(128) not null,\n")
    script_db_state_tables.write(f"{align}\trkey_col_name {db_syntax.nvarchar_type}(128) not null,\n")
    script_db_state_tables.write(f"{align}\tfkColStat smallint null\n")
    script_db_state_tables.write(f"{align});\n")
    script_db_state_tables.write(f"{align}\n")
    
    # Process foreign keys from schema_tables
    for _, fk_row in schema_tables.fks.iterrows():
        # Get FK columns for the current FK
        fk_cols = schema_tables.fk_cols[
            (schema_tables.fk_cols['fkey_table_schema'] == fk_row['fkey_table_schema']) &
            (schema_tables.fk_cols['fkey_table_name'] == fk_row['fkey_table_name']) &
            (schema_tables.fk_cols['fk_name'] == fk_row['fk_name'])
        ]
        
        # Prepare the full table name
        full_table_name = f"[{fk_row['fkey_table_schema']}].[{fk_row['fkey_table_name']}]"
        
        # Get SQL for creating FK and checking FK data
        create_fk_sql = get_fk_sql(fk_row, fk_cols, db_type)
        sql_check_fk_data = None
        if scripting_data:
            sql_check_fk_data = get_code_check_fk_data(db_type, fk_row, fk_cols)
        
        # Insert into ScriptFKs
        script_db_state_tables.write(f"{align}INSERT INTO {db_syntax.temp_table_prefix}ScriptFKs (fkey_table_schema,fkey_table_name,fk_name,rkey_table_schema,rkey_table_name,is_not_for_replication,is_not_trusted,delete_referential_action,update_referential_action,is_system_named,SQL_CREATE")
        
        if scripting_data:
            script_db_state_tables.write(",SQL_CheckFKData")
        
        script_db_state_tables.write(")\n")
        
        # VALUES for the insert
        if db_type == DBType.MSSQL:
            script_db_state_tables.write(f"{align}VALUES ({quote_str_or_null(fk_row['fkey_table_schema'])},")
            script_db_state_tables.write(f"{quote_str_or_null(fk_row['fkey_table_name'])},")
            script_db_state_tables.write(f"{quote_str_or_null(fk_row['fk_name'])},")
            script_db_state_tables.write(f"{quote_str_or_null(fk_row['rkey_table_schema'])},")
            script_db_state_tables.write(f"{quote_str_or_null(fk_row['rkey_table_name'])},")
            #!those ms-specific fields... we will need to do something about them, if and when we got an MS version again
            script_db_state_tables.write(f"{quote_str_or_null(fk_row['is_not_for_replication'])},")
            script_db_state_tables.write(f"{quote_str_or_null(fk_row['is_not_trusted'])},")
            script_db_state_tables.write(f"{quote_str_or_null(fk_row['delete_referential_action'])},")
            script_db_state_tables.write(f"{quote_str_or_null(fk_row['update_referential_action'])},")
            script_db_state_tables.write(f"{quote_str_or_null(fk_row['is_system_named'])},")
        elif db_type == DBType.PostgreSQL:
            script_db_state_tables.write(f"{align}VALUES ({quote_str_or_null(fk_row['fkey_table_schema'].lower())},")
            script_db_state_tables.write(f"{quote_str_or_null(fk_row['fkey_table_name'].lower())},")
            script_db_state_tables.write(f"{quote_str_or_null(fk_row['fk_name'].lower())},")
            script_db_state_tables.write(f"{quote_str_or_null(fk_row['rkey_table_schema'].lower())},")
            script_db_state_tables.write(f"{quote_str_or_null(fk_row['rkey_table_name'].lower())},")
        
      
        script_db_state_tables.write(f"{quote_str_or_null(create_fk_sql)}")
        
        if scripting_data:
            script_db_state_tables.write(f",{quote_str_or_null(sql_check_fk_data)}")
        
        script_db_state_tables.write(");\n")
        script_db_state_tables.write(f"{align}\n")
        
        # Insert FK columns
        script_db_state_tables.write(f"{align}--FK's Columns\n")
        for _, fk_col_row in fk_cols.iterrows():
            script_db_state_tables.write(f"{align}INSERT INTO {db_syntax.temp_table_prefix}ScriptFKCols (fkey_table_schema,fkey_table_name,fk_name,rkey_table_schema,rkey_table_name,fkey_col_name,rkey_col_name)\n")
            
            if db_type == DBType.MSSQL:
                script_db_state_tables.write(f"{align}VALUES ({quote_str_or_null(fk_col_row['fkey_table_schema'])},")
                script_db_state_tables.write(f"{quote_str_or_null(fk_col_row['fkey_table_name'])},")
                script_db_state_tables.write(f"{quote_str_or_null(fk_col_row['fk_name'])},")
                script_db_state_tables.write(f"{quote_str_or_null(fk_col_row['rkey_table_schema'])},\n")
                script_db_state_tables.write(f"{align}{quote_str_or_null(fk_col_row['rkey_table_name'])},\n")
                script_db_state_tables.write(f"{align}{quote_str_or_null(fk_col_row['fkey_col_name'])},\n")
                script_db_state_tables.write(f"{align}{quote_str_or_null(fk_col_row['rkey_col_name'])});\n")
            elif db_type == DBType.PostgreSQL:
                script_db_state_tables.write(f"{align}VALUES ({quote_str_or_null(fk_col_row['fkey_table_schema'].lower())},")
                script_db_state_tables.write(f"{quote_str_or_null(fk_col_row['fkey_table_name'].lower())},")
                script_db_state_tables.write(f"{quote_str_or_null(fk_col_row['fk_name'].lower())},")
                script_db_state_tables.write(f"{quote_str_or_null(fk_col_row['rkey_table_schema'].lower())},\n")
                script_db_state_tables.write(f"{align}{quote_str_or_null(fk_col_row['rkey_table_name'].lower())},\n")
                script_db_state_tables.write(f"{align}{quote_str_or_null(fk_col_row['fkey_col_name'].lower())},\n")
                script_db_state_tables.write(f"{align}{quote_str_or_null(fk_col_row['rkey_col_name'].lower())});\n")
            
            script_db_state_tables.write(f"{align}\n")
    
    script_db_state_tables.write(f"{align}\n")
    
    # Update state against existing table
    if overall_table_schema_name_in_scripting and len(overall_table_schema_name_in_scripting) > 0:
        script_db_state_tables.write(f"{align}--FKs only on Johannes database (need to add)\n")
        
        if db_type == DBType.MSSQL:
            script_db_state_tables.write(f"{align}UPDATE #ScriptFKs SET fkStat = 1\n")
            script_db_state_tables.write(f"{align}FROM #ScriptFKs J\n")
            script_db_state_tables.write(f"{align}LEFT JOIN ( SELECT FK.name AS fk_name,\n")
            script_db_state_tables.write(f"{align}SCHEMA_NAME(o.schema_id) AS table_schema,\n")
            script_db_state_tables.write(f"{align}o.name AS table_name\n")
            script_db_state_tables.write(f"{align}FROM sys.foreign_keys FK\n")
            script_db_state_tables.write(f"{align}INNER JOIN sys.objects O ON FK.parent_object_id = O.object_id\n")
            script_db_state_tables.write(f"{align}WHERE o.is_ms_shipped = 0\n")
            script_db_state_tables.write(f"{align}AND SCHEMA_NAME(o.schema_id) + o.name IN ({overall_table_schema_name_in_scripting})\n")
            script_db_state_tables.write(f"{align}) DB ON J.fkey_table_schema = DB.table_schema\n")
            script_db_state_tables.write(f"{align}AND J.fkey_table_name = DB.table_name\n")
            script_db_state_tables.write(f"{align}AND J.fk_name = DB.fk_name\n")
            script_db_state_tables.write(f"{align}WHERE DB.table_name Is NULL\n")
        
        elif db_type == DBType.PostgreSQL:
            script_db_state_tables.write(f"{align}UPDATE ScriptFKs SET fkStat = 1\n")
            script_db_state_tables.write(f"{align}FROM ScriptFKs J\n")
            script_db_state_tables.write(f"{align}LEFT JOIN ( SELECT fk.conname as fkey_name, ns.nspname as fkey_table_schema, t.relname as fkey_table_name\n")
            script_db_state_tables.write(f"{align}\tFROM pg_catalog.pg_constraint fk\n")
            script_db_state_tables.write(f"{align}\tinner join pg_class t on fk.conrelid = t.oid\n")
            script_db_state_tables.write(f"{align}\tinner join pg_namespace ns on ns.oid = t.relnamespace\n")
            script_db_state_tables.write(f"{align}\tinner join pg_class t_f on fk.confrelid=t_f.oid\n")
            script_db_state_tables.write(f"{align}\tinner join pg_namespace ns_f on ns_f.oid = t_f.relnamespace\n")
            script_db_state_tables.write(f"{align}\twhere fk.contype = 'f'\n")
            script_db_state_tables.write(f"{align}\tAND ns.nspname || t.relname IN ({overall_table_schema_name_in_scripting})\n")
            script_db_state_tables.write(f"{align}) DB ON LOWER(J.fkey_table_schema) = LOWER(DB.fkey_table_schema)\n")
            script_db_state_tables.write(f"{align}AND LOWER(J.fkey_table_name) = LOWER(DB.fkey_table_name)\n")
            script_db_state_tables.write(f"{align}AND LOWER(J.fk_name) = LOWER(DB.fkey_name)\n")
            script_db_state_tables.write(f"{align}WHERE DB.fkey_table_name Is NULL AND ScriptFKs.fk_name = J.fk_name;\n")
        
        script_db_state_tables.write(f"{align}\n")
        
        # FKs only on DB (need to drop)
        script_db_state_tables.write(f"{align}--FKs only on DB (need to drop)\n")
        
        if db_type == DBType.MSSQL:
            script_db_state_tables.write(f"{align}INSERT INTO #ScriptFks (fkey_table_schema, fkey_table_name, fk_name, fkStat)\n")
            script_db_state_tables.write(f"{align}SELECT DB.table_schema, DB.table_name, DB.fk_name, 2\n")
            script_db_state_tables.write(f"{align}FROM #ScriptFks J\n")
            script_db_state_tables.write(f"{align}RIGHT JOIN ( SELECT I.name AS fk_name,\n")
            script_db_state_tables.write(f"{align}SCHEMA_NAME(o.schema_id) AS table_schema,\n")
            script_db_state_tables.write(f"{align}o.name AS table_name\n")
            script_db_state_tables.write(f"{align}FROM sys.foreign_keys I\n")
            script_db_state_tables.write(f"{align}INNER JOIN sys.objects O ON I.parent_object_id = O.object_id\n")
            script_db_state_tables.write(f"{align}WHERE o.is_ms_shipped = 0\n")
            
            if not remove_all_extra_ents:
                script_db_state_tables.write(f"{align}AND SCHEMA_NAME(o.schema_id) + o.name IN ({overall_table_schema_name_in_scripting})\n")
            
            script_db_state_tables.write(f"{align}) DB ON J.fkey_table_schema = DB.table_schema\n")
            script_db_state_tables.write(f"{align}AND J.fkey_table_name = DB.table_name\n")
            script_db_state_tables.write(f"{align}AND J.fk_name = DB.fk_name\n")
            script_db_state_tables.write(f"{align}WHERE J.fkey_table_name Is NULL\n")
        
        elif db_type == DBType.PostgreSQL:
            script_db_state_tables.write(f"{align}INSERT INTO ScriptFks (fkey_table_schema, fkey_table_name, fk_name, fkStat)\n")
            script_db_state_tables.write(f"{align}SELECT DB.fkey_table_schema, DB.fkey_table_name, DB.fkey_name, 2\n")
            script_db_state_tables.write(f"{align}FROM ScriptFks J\n")
            script_db_state_tables.write(f"{align}RIGHT JOIN ( SELECT fk.conname as fkey_name, ns.nspname as fkey_table_schema, t.relname as fkey_table_name\n")
            script_db_state_tables.write(f"{align}\tFROM pg_catalog.pg_constraint fk\n")
            script_db_state_tables.write(f"{align}\tinner join pg_class t on fk.conrelid = t.oid\n")
            script_db_state_tables.write(f"{align}\tinner join pg_namespace ns on ns.oid = t.relnamespace\n")
            script_db_state_tables.write(f"{align}\tinner join pg_class t_f on fk.confrelid=t_f.oid\n")
            script_db_state_tables.write(f"{align}\tinner join pg_namespace ns_f on ns_f.oid = t_f.relnamespace\n")
            script_db_state_tables.write(f"{align}\twhere fk.contype = 'f'\n")
            
            if not remove_all_extra_ents:
                script_db_state_tables.write(f"{align}\tAND ns.nspname || t.relname IN ({overall_table_schema_name_in_scripting})\n")
            
            script_db_state_tables.write(f"{align}) DB ON LOWER(J.fkey_table_schema) = LOWER(DB.fkey_table_schema)\n")
            script_db_state_tables.write(f"{align}AND LOWER(J.fkey_table_name) = LOWER(DB.fkey_table_name)\n")
            script_db_state_tables.write(f"{align}AND LOWER(J.fk_name) = LOWER(DB.fkey_name)\n")
            script_db_state_tables.write(f"{align}WHERE J.fkey_table_name Is NULL;\n")
        
        script_db_state_tables.write(f"{align}\n")
        
        # FK Columns only on Johannes database
        script_db_state_tables.write(f"{align}--FK Cols only on Johannes database (need to add)\n")
        
        if db_type == DBType.MSSQL:
            script_db_state_tables.write(f"{align}UPDATE #ScriptFKCols SET fkColStat = 1\n")
            script_db_state_tables.write(f"{align}FROM #ScriptFKCols J\n")
            script_db_state_tables.write(f"{align}LEFT JOIN ( SELECT FK.name AS fk_name,\n")
            script_db_state_tables.write(f"{align}SCHEMA_NAME(o.schema_id) AS table_schema,\n")
            script_db_state_tables.write(f"{align}o.name AS table_name, C.name AS [col_name]\n")
            script_db_state_tables.write(f"{align}FROM sys.foreign_keys FK\n")
            script_db_state_tables.write(f"{align}INNER JOIN sys.objects O ON FK.parent_object_id = O.object_id\n")
            script_db_state_tables.write(f"{align}INNER JOIN sys.foreign_key_columns FKC ON FK.object_id=FKC.constraint_object_id\n")
            script_db_state_tables.write(f"{align}INNER JOIN sys.columns C ON FK.parent_object_id=C.object_id AND FKC.parent_column_id = C.column_id\n")
            script_db_state_tables.write(f"{align}WHERE o.is_ms_shipped = 0\n")
            script_db_state_tables.write(f"{align}AND SCHEMA_NAME(o.schema_id) + o.name IN ({overall_table_schema_name_in_scripting})\n")
            script_db_state_tables.write(f"{align}) DB ON J.fkey_table_schema = DB.table_schema\n")
            script_db_state_tables.write(f"{align}AND J.fkey_table_name = DB.table_name\n")
            script_db_state_tables.write(f"{align}AND J.fk_name = DB.fk_name\n")
            script_db_state_tables.write(f"{align}AND J.fkey_col_name=DB.col_name\n")
            script_db_state_tables.write(f"{align}WHERE DB.col_name Is NULL\n")
        
        # For PostgreSQL, the comment in the VB.NET code mentions it's not doing this for columns
        
        script_db_state_tables.write(f"{align}\n")
        
        # FK Columns only on DB (need to drop)
        script_db_state_tables.write(f"{align}--FK Columns only on DB (need to drop)\n")
        
        if db_type == DBType.MSSQL:
            script_db_state_tables.write(f"{align}INSERT INTO #ScriptFKCols\n")
            script_db_state_tables.write(f"{align}(fkey_table_schema,\n")
            script_db_state_tables.write(f"{align}fkey_table_name,\n")
            script_db_state_tables.write(f"{align}fk_name,\n")
            script_db_state_tables.write(f"{align}fkey_col_name,\n")
            script_db_state_tables.write(f"{align}rkey_table_schema,\n")
            script_db_state_tables.write(f"{align}rkey_table_name,\n")
            script_db_state_tables.write(f"{align}rkey_col_name,\n")
            script_db_state_tables.write(f"{align}fkColStat)\n")
            script_db_state_tables.write(f"{align}SELECT DB.table_schema,\n")
            script_db_state_tables.write(f"{align}DB.table_name,\n")
            script_db_state_tables.write(f"{align}DB.fk_name,\n")
            script_db_state_tables.write(f"{align}DB.col_name,\n")
            script_db_state_tables.write(f"{align}DB.rkey_table_schema,DB.rkey_table_name,db.rkey_col_name,\n")
            script_db_state_tables.write(f"{align}2\n")
            script_db_state_tables.write(f"{align}FROM #ScriptFKCols J\n")
            script_db_state_tables.write(f"{align}RIGHT JOIN ( SELECT FK.name AS fk_name,\n")
            script_db_state_tables.write(f"{align}SCHEMA_NAME(o.schema_id) AS table_schema,\n")
            script_db_state_tables.write(f"{align}o.name AS table_name, C.name AS col_name,\n")
            script_db_state_tables.write(f"{align}SCHEMA_NAME(O_RKEY.schema_id) AS rkey_table_schema,\n")
            script_db_state_tables.write(f"{align}O_RKEY.name AS rkey_table_name, C_RKEY.name AS rkey_col_name\n")
            script_db_state_tables.write(f"{align}FROM sys.foreign_keys FK\n")
            script_db_state_tables.write(f"{align}INNER JOIN sys.objects O ON FK.parent_object_id = O.object_id\n")
            script_db_state_tables.write(f"{align}INNER JOIN sys.foreign_key_columns FKC ON FK.object_id=FKC.constraint_object_id\n")
            script_db_state_tables.write(f"{align}INNER JOIN sys.columns C ON FK.parent_object_id=C.object_id AND FKC.parent_column_id = C.column_id\n")
            script_db_state_tables.write(f"{align}INNER JOIN sys.objects O_RKEY ON FK.referenced_object_id = O_RKEY.object_id\n")
            script_db_state_tables.write(f"{align}INNER JOIN sys.foreign_key_columns FK_C_RKEY ON FK.referenced_object_id = FK_C_RKEY.referenced_object_id\n")
            script_db_state_tables.write(f"{align}INNER JOIN sys.columns C_RKEY ON FK.referenced_object_id = C_RKEY.object_id\n")
            script_db_state_tables.write(f"{align}AND FK_C_RKEY.referenced_column_id = C_RKEY.column_id\n")
            script_db_state_tables.write(f"{align}WHERE o.is_ms_shipped = 0\n")
            script_db_state_tables.write(f"{align}AND SCHEMA_NAME(o.schema_id) + o.name IN ({overall_table_schema_name_in_scripting})\n")
            script_db_state_tables.write(f"{align}) DB ON J.fkey_table_schema = DB.table_schema\n")
            script_db_state_tables.write(f"{align}AND J.fkey_table_name = DB.table_name\n")
            script_db_state_tables.write(f"{align}AND J.fk_name = DB.fk_name\n")
            script_db_state_tables.write(f"{align}AND J.fkey_col_name=DB.col_name\n")
            script_db_state_tables.write(f"{align}WHERE J.fkey_table_name Is NULL\n")
        
        # For PostgreSQL, the VB.NET code says it's not needed to do this on columns
        
        script_db_state_tables.write(f"{align}\n")
    
    # Updates of FK flags
    script_db_state_tables.write(f"{align}---updates of FK flags--------------------\n")
    
    # is_not_for_replication
    if db_type == DBType.MSSQL:
        script_db_state_tables.write(f"{align}--is_not_for_replication\n")
        script_db_state_tables.write(f"{align}UPDATE #ScriptFKs SET is_not_for_replication_diff=1,fkStat=3\n")
        script_db_state_tables.write(f"{align}from #ScriptFKs J INNER join (select is_not_for_replication, SCHEMA_NAME(o.schema_id) as fkey_table_schema, o.name as fkey_table_name, FK.name as fk_name from sys.tables O inner join sys.foreign_keys FK on o.object_id=FK.parent_object_id) DB\n")
        script_db_state_tables.write(f"{align}on J.fkey_table_schema=DB.fkey_table_schema and J.fkey_table_name=DB.fkey_table_name and J.fk_name=DB.fk_name\n")
        script_db_state_tables.write(f"{align}where J.is_not_for_replication <> DB.is_not_for_replication\n")
    
    script_db_state_tables.write(f"{align}\n")
    
    # is_not_trusted (commented out in original)
    if db_type == DBType.MSSQL:
        script_db_state_tables.write(f"{align}--is_not_trusted\n")
        script_db_state_tables.write(f"{align}/*for now commenting this out because I think it works together with is_disabled, which i handle in a different seciton\n")
        script_db_state_tables.write(f"{align}UPDATE #ScriptFKs SET is_not_trusted_diff=1,fkStat=3\n")
        script_db_state_tables.write(f"{align}from #ScriptFKs J INNER join (select is_not_trusted, SCHEMA_NAME(o.schema_id) as fkey_table_schema, o.name as fkey_table_name, FK.name as fk_name from sys.tables O inner join sys.foreign_keys FK on o.object_id=FK.parent_object_id) DB\n")
        script_db_state_tables.write(f"{align}on J.fkey_table_schema=DB.fkey_table_schema and J.fkey_table_name=DB.fkey_table_name and J.fk_name=DB.fk_name\n")
        script_db_state_tables.write(f"{align}where J.is_not_trusted <> DB.is_not_trusted*/\n")
    
    script_db_state_tables.write(f"{align}\n")
    
    # delete_referential_action
    script_db_state_tables.write(f"{align}--delete_referential_action\n")
    if db_type == DBType.MSSQL:
        script_db_state_tables.write(f"{align}UPDATE #ScriptFKs SET delete_referential_action_diff=1,fkStat=3\n")
        script_db_state_tables.write(f"{align}from #ScriptFKs J INNER join (select delete_referential_action, SCHEMA_NAME(o.schema_id) as fkey_table_schema, o.name as fkey_table_name, FK.name as fk_name from sys.tables O inner join sys.foreign_keys FK on o.object_id=FK.parent_object_id) DB\n")
        script_db_state_tables.write(f"{align}on J.fkey_table_schema=DB.fkey_table_schema and J.fkey_table_name=DB.fkey_table_name and J.fk_name=DB.fk_name\n")
        script_db_state_tables.write(f"{align}where J.delete_referential_action <> DB.delete_referential_action;\n")
    elif db_type == DBType.PostgreSQL:
        script_db_state_tables.write(f"{align}UPDATE ScriptFKs SET delete_referential_action_diff=true,fkStat=3\n")
        script_db_state_tables.write(f"{align}from ScriptFKs J INNER join (\n")
        script_db_state_tables.write(f"{align}\tSELECT fk.conname as fkey_name, ns.nspname as fkey_table_schema, t.relname as fkey_table_name,\n")
        script_db_state_tables.write(f"{align}\tCASE fk.confdeltype\n")
        script_db_state_tables.write(f"{align}\tWHEN 'c' THEN 1\n")
        script_db_state_tables.write(f"{align}\tELSE 0\n")
        script_db_state_tables.write(f"{align}\tEND AS delete_referential_action,\n")
        script_db_state_tables.write(f"{align}\tCASE fk.confupdtype\n")
        script_db_state_tables.write(f"{align}\tWHEN 'c' THEN 1\n")
        script_db_state_tables.write(f"{align}\tELSE 0\n")
        script_db_state_tables.write(f"{align}\tEND AS update_referential_action\n")
        script_db_state_tables.write(f"{align}\tFROM pg_catalog.pg_constraint fk\n")
        script_db_state_tables.write(f"{align}\t\tinner join pg_class t on fk.conrelid = t.oid\n")
        script_db_state_tables.write(f"{align}\t\tinner join pg_namespace ns on ns.oid = t.relnamespace\n")
        script_db_state_tables.write(f"{align}\twhere fk.contype = 'f'\n")
        script_db_state_tables.write(f"{align}) DB\n")
        script_db_state_tables.write(f"{align}on LOWER(J.fkey_table_schema) = LOWER(DB.fkey_table_schema) and LOWER(J.fkey_table_name) = LOWER(DB.fkey_table_name) and LOWER(J.fk_name) = LOWER(DB.fkey_name)\n")
        script_db_state_tables.write(f"{align}where J.delete_referential_action <> DB.delete_referential_action AND ScriptFKs.fk_name = J.fk_name;\n")
    
    script_db_state_tables.write(f"{align}\n")
    
    # update_referential_action
    script_db_state_tables.write(f"{align}--update_referential_action\n")
    if db_type == DBType.MSSQL:
        script_db_state_tables.write(f"{align}UPDATE #ScriptFKs SET update_referential_action_diff=1,fkStat=3\n")
        script_db_state_tables.write(f"{align}from #ScriptFKs J INNER join (select update_referential_action, SCHEMA_NAME(o.schema_id) as fkey_table_schema, o.name as fkey_table_name, FK.name as fk_name from sys.tables O inner join sys.foreign_keys FK on o.object_id=FK.parent_object_id) DB\n")
        script_db_state_tables.write(f"{align}on J.fkey_table_schema=DB.fkey_table_schema and J.fkey_table_name=DB.fkey_table_name and J.fk_name=DB.fk_name\n")
        script_db_state_tables.write(f"{align}where J.update_referential_action <> DB.update_referential_action;\n")
    elif db_type == DBType.PostgreSQL:
        script_db_state_tables.write(f"{align}UPDATE ScriptFKs SET update_referential_action_diff=true,fkStat=3\n")
        script_db_state_tables.write(f"{align}from ScriptFKs J INNER join (\n")
        script_db_state_tables.write(f"{align}\tSELECT fk.conname as fkey_name, ns.nspname as fkey_table_schema, t.relname as fkey_table_name,\n")
        script_db_state_tables.write(f"{align}\tCASE fk.confdeltype\n")
        script_db_state_tables.write(f"{align}\tWHEN 'c' THEN 1\n")
        script_db_state_tables.write(f"{align}\tELSE 0\n")
        script_db_state_tables.write(f"{align}\tEND AS delete_referential_action,\n")
        script_db_state_tables.write(f"{align}\tCASE fk.confupdtype\n")
        script_db_state_tables.write(f"{align}\tWHEN 'c' THEN 1\n")
        script_db_state_tables.write(f"{align}\tELSE 0\n")
        script_db_state_tables.write(f"{align}\tEND AS update_referential_action\n")
        script_db_state_tables.write(f"{align}\tFROM pg_catalog.pg_constraint fk\n")
        script_db_state_tables.write(f"{align}\t\tinner join pg_class t on fk.conrelid = t.oid\n")
        script_db_state_tables.write(f"{align}\t\tinner join pg_namespace ns on ns.oid = t.relnamespace\n")
        script_db_state_tables.write(f"{align}\twhere fk.contype = 'f'\n")
        script_db_state_tables.write(f"{align}) DB\n")
        script_db_state_tables.write(f"{align}on LOWER(J.fkey_table_schema) = LOWER(DB.fkey_table_schema) and LOWER(J.fkey_table_name) = LOWER(DB.fkey_table_name) and LOWER(J.fk_name) = LOWER(DB.fkey_name)\n")
        script_db_state_tables.write(f"{align}where J.update_referential_action <> DB.update_referential_action AND ScriptFKs.fk_name = J.fk_name;\n")
    
    script_db_state_tables.write(f"{align}\n")
    
    # is_system_named
    if db_type == DBType.MSSQL:
        script_db_state_tables.write(f"{align}--is_system_named\n")
        script_db_state_tables.write(f"{align}UPDATE #ScriptFKs SET is_system_named_diff=1,fkStat=3\n")
        script_db_state_tables.write(f"{align}from #ScriptFKs J INNER join (select is_system_named, SCHEMA_NAME(o.schema_id) as fkey_table_schema, o.name as fkey_table_name, FK.name as fk_name from sys.tables O inner join sys.foreign_keys FK on o.object_id=FK.parent_object_id) DB\n")
        script_db_state_tables.write(f"{align}on J.fkey_table_schema=DB.fkey_table_schema and J.fkey_table_name=DB.fkey_table_name and J.fk_name=DB.fk_name\n")
        script_db_state_tables.write(f"{align}where J.is_system_named <> DB.is_system_named;\n")
    
    script_db_state_tables.write(f"{align}---done with FK flags--------------------\n")
    script_db_state_tables.write(f"{align}\n")
    
    # Special FK case - FKs match but underlying index doesn't
    script_db_state_tables.write(f"{align}--A special FK case: FKs are a match but index 'under' it is not: it needs to be dropped and then re-added before the index:\n")
    if db_type == DBType.MSSQL:
        script_db_state_tables.write(f"{align}UPDATE #ScriptFKs\n")
        script_db_state_tables.write(f"{align}Set underlying_index_diff = 1,\n")
        script_db_state_tables.write(f"{align}fkStat = 3\n")
        script_db_state_tables.write(f"{align}FROM #ScriptFKs FK\n")
        script_db_state_tables.write(f"{align}INNER Join #ScriptFKCols FKC ON FK.fk_name = FKC.fk_name\n")
        script_db_state_tables.write(f"{align}INNER Join #ScriptIndexesCols IC ON FKC.rkey_table_schema = IC.table_schema\n")
        script_db_state_tables.write(f"{align}And FKC.rkey_table_name = IC.table_name\n")
        script_db_state_tables.write(f"{align}And FKC.rkey_col_name = IC.col_name\n")
        script_db_state_tables.write(f"{align}INNER Join #ScriptIndexes I ON I.index_name = IC.index_name\n")
        script_db_state_tables.write(f"{align}WHERE I.indexStat Is Not NULL\n")
        script_db_state_tables.write(f"{align}And FK.fkStat Is NULL\n")
    elif db_type == DBType.PostgreSQL:
        script_db_state_tables.write(f"{align}UPDATE ScriptFKs\n")
        script_db_state_tables.write(f"{align}Set underlying_index_diff = True,\n")
        script_db_state_tables.write(f"{align}fkStat = 3\n")
        script_db_state_tables.write(f"{align}FROM ScriptFKs FK\n")
        script_db_state_tables.write(f"{align}INNER Join ScriptFKCols FKC ON FK.fk_name = FKC.fk_name\n")
        script_db_state_tables.write(f"{align}INNER Join ScriptIndexesCols IC ON LOWER(FKC.rkey_table_schema) = LOWER(IC.table_schema)\n")
        script_db_state_tables.write(f"{align}And LOWER(FKC.rkey_table_name) = LOWER(IC.table_name)\n")
        script_db_state_tables.write(f"{align}And FKC.rkey_col_name = IC.col_name\n")
        script_db_state_tables.write(f"{align}INNER Join ScriptIndexes I ON LOWER(I.index_name) = LOWER(IC.index_name)\n")
        script_db_state_tables.write(f"{align}WHERE I.indexStat Is Not NULL\n")
        script_db_state_tables.write(f"{align}And FK.fkStat Is NULL AND ScriptFKs.fk_name = FK.fk_name;\n")
    
    script_db_state_tables.write(f"{align}---done special case of FK equal but index on same columns is not----------------------\n")
    script_db_state_tables.write(f"{align}\n\n")
    
    # Mark FKs with different columns
    script_db_state_tables.write(f"{align}--wherever got FK columns that are different, mark the FK As different\n")
    if db_type == DBType.MSSQL:
        script_db_state_tables.write(f"{align}UPDATE #ScriptFKs Set col_diff=1\n")
        script_db_state_tables.write(f"{align}FROM #ScriptFKs FK INNER JOIN #ScriptFKCols FKC On FK.fkey_table_schema=FKC.fkey_table_schema And FK.fkey_table_name=FKC.fkey_table_name And FK.fk_name=FKC.fk_name\n")
        script_db_state_tables.write(f"{align}WHERE FKC.fkColStat Is Not NULL And FK.fkStat Not In (1, 2)\n")
    elif db_type == DBType.PostgreSQL:
        script_db_state_tables.write(f"{align}UPDATE ScriptFKs Set col_diff = True\n")
        script_db_state_tables.write(f"{align}FROM ScriptFKs FK INNER JOIN ScriptFKCols FKC On LOWER(FK.fkey_table_schema) = LOWER(FKC.fkey_table_schema) And LOWER(FK.fkey_table_name) = LOWER(FKC.fkey_table_name) And LOWER(FK.fk_name) = LOWER(FKC.fk_name)\n")
        script_db_state_tables.write(f"{align}WHERE FKC.fkColStat Is Not NULL And FK.fkStat Not In (1, 2);\n")
    
    script_db_state_tables.write(f"{align}\n")
    
    # Mark FKs with columns that need to be altered
    script_db_state_tables.write(f"{align}--wherever got cols that are different that the FK uses, mark the FK so can be dropped And re-created after the column Is altered\n")
    if db_type == DBType.MSSQL:
        script_db_state_tables.write(f"{align}UPDATE #ScriptFKs Set db_col_diff = 1\n")
        script_db_state_tables.write(f"{align}FROM #ScriptFKs FK INNER JOIN #ScriptFKCols FKC On FK.fkey_table_schema=FKC.fkey_table_schema And FK.fkey_table_name=FKC.fkey_table_name And FK.fk_name=FKC.fk_name\n")
        script_db_state_tables.write(f"{align}INNER JOIN #ScriptCols C On FK.fkey_table_schema=C.table_schema And FK.fkey_table_name=C.table_name And FKC.fkey_col_name=C.col_name\n")
        script_db_state_tables.write(f"{align}WHERE c.colStat = 3 And FK.fkStat Is NULL Or fkStat = 3\n")
    elif db_type == DBType.PostgreSQL:
        script_db_state_tables.write(f"{align}UPDATE ScriptFKs Set db_col_diff = True\n")
        script_db_state_tables.write(f"{align}FROM ScriptFKs FK INNER JOIN ScriptFKCols FKC On FK.fkey_table_schema=FKC.fkey_table_schema And FK.fkey_table_name=FKC.fkey_table_name And FK.fk_name=FKC.fk_name\n")
        script_db_state_tables.write(f"{align}INNER JOIN ScriptCols C On LOWER(FK.fkey_table_schema) = LOWER(C.table_schema) And LOWER(FK.fkey_table_name) = LOWER(C.table_name) And LOWER(FKC.fkey_col_name) = LOWER(C.col_name)\n")
        script_db_state_tables.write(f"{align}WHERE c.colStat = 3 And FK.fkStat Is NULL Or FK.fkStat = 3 AND ScriptFKs.fk_name = FK.fk_name;\n")
    
    script_db_state_tables.write(f"{align}\n")
    
    # Check other side of FK
    script_db_state_tables.write(f"{align}--...And other side:\n")
    if db_type == DBType.MSSQL:
        script_db_state_tables.write(f"{align}UPDATE #ScriptFKs SET db_col_diff=1\n")
        script_db_state_tables.write(f"{align}FROM #ScriptFKs FK\n")
        script_db_state_tables.write(f"{align}INNER JOIN #ScriptFKCols FKC ON FK.fkey_table_schema=FKC.fkey_table_schema AND FK.fkey_table_name=FKC.fkey_table_name AND FK.fk_name=FKC.fk_name\n")
        script_db_state_tables.write(f"{align}INNER JOIN #ScriptCols C ON FK.rkey_table_schema=C.table_schema AND FK.rkey_table_name=C.table_name AND FKC.rkey_col_name=C.col_name\n")
        script_db_state_tables.write(f"{align}WHERE c.colStat = 3 And FK.fkStat Is NULL Or fkStat = 3\n")
    elif db_type == DBType.PostgreSQL:
        script_db_state_tables.write(f"{align}UPDATE ScriptFKs SET db_col_diff = True\n")
        script_db_state_tables.write(f"{align}FROM ScriptFKs FK\n")
        script_db_state_tables.write(f"{align}INNER JOIN ScriptFKCols FKC ON FK.fkey_table_schema=FKC.fkey_table_schema AND FK.fkey_table_name=FKC.fkey_table_name AND FK.fk_name=FKC.fk_name\n")
        script_db_state_tables.write(f"{align}INNER JOIN ScriptCols C ON LOWER(FK.rkey_table_schema) = LOWER(C.table_schema) AND LOWER(FK.rkey_table_name) = LOWER(C.table_name) AND LOWER(FKC.rkey_col_name) = LOWER(C.col_name)\n")
        script_db_state_tables.write(f"{align}WHERE c.colStat = 3 And FK.fkStat Is NULL Or FK.fkStat = 3 AND ScriptFKs.fk_name = FK.fk_name;\n")
    
    script_db_state_tables.write(f"{align}\n")
    
    # Check for index changes on FK columns
    script_db_state_tables.write(f"{align}--see if there are index changes that are on any columns that this FK is using. this would also mean we need to drop\recreate this FK\n")
    if db_type == DBType.MSSQL:
        script_db_state_tables.write(f"{align}update #ScriptFKs set indx_col_diff=1\n")
        script_db_state_tables.write(f"{align}FROM #ScriptFKs FK\n")
        script_db_state_tables.write(f"{align}INNER JOIN #ScriptFKCols FKC ON FK.fkey_table_schema=FKC.fkey_table_schema AND FK.fkey_table_name=FKC.fkey_table_name AND FK.fk_name=FKC.fk_name\n")
        script_db_state_tables.write(f"{align}inner join #ScriptIndexesCols IC on FKC.fkey_table_schema = IC.table_schema AND FKC.fkey_table_name = IC.table_name AND FKC.fkey_col_name=IC.col_name\n")
        script_db_state_tables.write(f"{align}inner join #ScriptIndexes I on IC.table_schema = I.table_schema AND IC.table_name = I.table_name AND IC.index_name=I.index_name\n")
        script_db_state_tables.write(f"{align}WHERE I.indexStat = 3 And FK.fkStat Is NULL Or fkStat = 3\n")
        script_db_state_tables.write(f"{align}--...and other side:\n")
        script_db_state_tables.write(f"{align}update #ScriptFKs set indx_col_diff = 1\n")
        script_db_state_tables.write(f"{align}FROM #ScriptFKs FK\n")
        script_db_state_tables.write(f"{align}INNER JOIN #ScriptFKCols FKC ON FK.rkey_table_schema=FKC.rkey_table_schema AND FK.rkey_table_name=FKC.rkey_table_name AND FK.fk_name=FKC.fk_name\n")
        script_db_state_tables.write(f"{align}inner join #ScriptIndexesCols IC on FKC.rkey_table_schema = IC.table_schema AND FKC.rkey_table_name = IC.table_name AND FKC.rkey_col_name=IC.col_name\n")
        script_db_state_tables.write(f"{align}inner join #ScriptIndexes I on IC.table_schema = I.table_schema AND IC.table_name = I.table_name AND IC.index_name=I.index_name\n")
        script_db_state_tables.write(f"{align}WHERE I.indexStat = 3 And FK.fkStat Is NULL Or fkStat = 3\n")
    elif db_type == DBType.PostgreSQL:
        script_db_state_tables.write(f"{align}update ScriptFKs set indx_col_diff = True\n")
        script_db_state_tables.write(f"{align}FROM ScriptFKs FK\n")
        script_db_state_tables.write(f"{align}INNER JOIN ScriptFKCols FKC ON FK.fkey_table_schema=FKC.fkey_table_schema AND FK.fkey_table_name=FKC.fkey_table_name AND FK.fk_name=FKC.fk_name\n")
        script_db_state_tables.write(f"{align}inner join ScriptIndexesCols IC on FKC.fkey_table_schema = IC.table_schema AND FKC.fkey_table_name = IC.table_name AND FKC.fkey_col_name=IC.col_name\n")
        script_db_state_tables.write(f"{align}inner join ScriptIndexes I on IC.table_schema = I.table_schema AND IC.table_name = I.table_name AND IC.index_name=I.index_name\n")
        script_db_state_tables.write(f"{align}WHERE I.indexStat = 3 And FK.fkStat Is NULL Or FK.fkStat = 3;\n")
        script_db_state_tables.write(f"{align}--...and other side:\n")
        script_db_state_tables.write(f"{align}update ScriptFKs set indx_col_diff= True\n")
        script_db_state_tables.write(f"{align}FROM ScriptFKs FK\n")
        script_db_state_tables.write(f"{align}INNER JOIN ScriptFKCols FKC ON FK.rkey_table_schema=FKC.rkey_table_schema AND FK.rkey_table_name=FKC.rkey_table_name AND FK.fk_name=FKC.fk_name\n")
        script_db_state_tables.write(f"{align}inner join ScriptIndexesCols IC on FKC.rkey_table_schema = IC.table_schema AND FKC.rkey_table_name = IC.table_name AND FKC.rkey_col_name=IC.col_name\n")
        script_db_state_tables.write(f"{align}inner join ScriptIndexes I on LOWER(IC.table_schema) = LOWER(I.table_schema) AND LOWER(IC.table_name) = LOWER(I.table_name) AND LOWER(IC.index_name) = LOWER(I.index_name)\n")
        script_db_state_tables.write(f"{align}WHERE I.indexStat = 3 And FK.fkStat Is NULL Or FK.fkStat = 3 AND ScriptFKs.fk_name = FK.fk_name;\n")
    
    script_db_state_tables.write(f"{align}\n\n")

    return script_db_state_tables