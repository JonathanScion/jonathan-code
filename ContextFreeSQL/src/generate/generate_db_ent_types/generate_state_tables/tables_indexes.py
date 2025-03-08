from enum import Enum
from typing import Optional, Dict, List
from dataclasses import dataclass
import pandas as pd
from io import StringIO
from src.defs.script_defs import DBType, DBSyntax, ScriptingOptions, ScriptTableOptions, DBEntScriptState
from src.generate.generate_create_table import get_create_table_from_sys_tables, get_col_sql, get_index_sql
from src.data_load.from_db.load_from_db_pg import DBSchema
from src.utils.funcs import quote_str_or_null, quote_str_or_null_bool, numeric_or_null, bool_to_sql_bit_boolean_val
from src.utils.code_funcs import get_code_check_unq_data

# CreateDBStateIndexes
def create_db_state_indexes(
    schema_tables: DBSchema,
    tbl_ents_to_script: pd.DataFrame,
    db_type: DBType, # that's the destination db type
    overall_table_schema_name_in_scripting: Optional[str],
    scripting_data: Optional[bool] = False,
    bad_data_pre_add_indx: Optional[StringIO] = None
) -> StringIO:
    
    db_syntax = DBSyntax.get_syntax(db_type)
    script_db_state_tables = StringIO()
    align = "\t" * 2  # 2, for now
    
    script_db_state_tables.write(f"\n\n")
    script_db_state_tables.write(f"{align}--Indexes\n")
    
    temp_table_name = "ScriptIndexes"
    
    # Handle different database types
    if db_type == DBType.MSSQL:
        script_db_state_tables.write(f"{align}IF (OBJECT_ID('tempdb..#{temp_table_name}') IS NOT NULL)\n")
        script_db_state_tables.write(f"{align}BEGIN\n")
        script_db_state_tables.write(f"{align}\tDROP TABLE {db_syntax.temp_table_prefix}{temp_table_name};\n")
        script_db_state_tables.write(f"{align}END;\n")
    elif db_type == DBType.PostgreSQL:
        script_db_state_tables.write(f"{align}perform  n.nspname ,c.relname\n")
        script_db_state_tables.write(f"{align}FROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace\n")
        script_db_state_tables.write(f"{align}WHERE n.nspname like 'pg_temp_%' AND c.relname='{temp_table_name.lower()}' AND pg_catalog.pg_table_is_visible(c.oid);\n")
        script_db_state_tables.write(f"{align}IF FOUND THEN\n")
        script_db_state_tables.write(f"{align}\tDROP TABLE {temp_table_name};\n")
        script_db_state_tables.write(f"{align}END IF;\n")
    
    # Create temporary table for script indexes
    script_db_state_tables.write(f"{align}{db_syntax.temp_table_create}ScriptIndexes\n")
    script_db_state_tables.write(f"{align}(\n")
    script_db_state_tables.write(f"{align}\ttable_schema {db_syntax.nvarchar_type}(128) not null,\n")
    script_db_state_tables.write(f"{align}\ttable_name {db_syntax.nvarchar_type}(128) not null,\n")
    script_db_state_tables.write(f"{align}\tindex_name {db_syntax.nvarchar_type}(128) not null,\n")
    script_db_state_tables.write(f"{align}\tis_unique {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tis_unique_diff {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tis_clustered {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tis_clustered_diff {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tignore_dup_key {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tignore_dup_key_diff {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tis_primary_key {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tis_primary_key_diff {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tis_unique_constraint {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tis_unique_constraint_diff {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tallow_row_locks {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tallow_row_locks_diff {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tallow_page_locks {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tallow_page_locks_diff {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\thas_filter {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\thas_filter_diff {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tfilter_definition {db_syntax.nvarchar_type}{db_syntax.max_length_str} null,\n")
    script_db_state_tables.write(f"{align}\tfilter_definition_diff {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tSQL_CREATE {db_syntax.nvarchar_type}{db_syntax.max_length_str} null,\n")
    
    # Add index_columns for PostgreSQL
    if db_type == DBType.PostgreSQL:
        script_db_state_tables.write(f"{align}\tindex_columns {db_syntax.nvarchar_type} (100) NULL,\n")
    
    # Add SQL_CheckUnqData if scripting_data is True
    if scripting_data:
        script_db_state_tables.write(f"{align}\tSQL_CheckUnqData {db_syntax.nvarchar_type}{db_syntax.max_length_str} null,\n")
        script_db_state_tables.write(f"{align}\tGotBadData {db_syntax.boolean_type} null,\n")
    
    script_db_state_tables.write(f"{align}\tindexStat smallint null,\n")
    script_db_state_tables.write(f"{align}\tcol_diff {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tdb_col_diff {db_syntax.boolean_type} null\n")
    script_db_state_tables.write(f"{align});\n")
    script_db_state_tables.write(f"{align}\n")
    
    # Create temporary table for script index columns
    temp_table_name = "ScriptIndexesCols"
    
    if db_type == DBType.MSSQL:
        script_db_state_tables.write(f"{align}--Indexes Column\n")
        script_db_state_tables.write(f"{align}IF (OBJECT_ID('tempdb..#{temp_table_name}') IS NOT NULL)\n")
        script_db_state_tables.write(f"{align}BEGIN\n")
        script_db_state_tables.write(f"{align}\tDROP TABLE {db_syntax.temp_table_prefix}{temp_table_name};\n")
        script_db_state_tables.write(f"{align}END;\n")
    elif db_type == DBType.PostgreSQL:
        script_db_state_tables.write(f"{align}perform  n.nspname ,c.relname\n")
        script_db_state_tables.write(f"{align}FROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace\n")
        script_db_state_tables.write(f"{align}WHERE n.nspname like 'pg_temp_%' AND c.relname='{temp_table_name.lower()}' AND pg_catalog.pg_table_is_visible(c.oid);\n")
        script_db_state_tables.write(f"{align}IF FOUND THEN\n")
        script_db_state_tables.write(f"{align}\tDROP TABLE {temp_table_name};\n")
        script_db_state_tables.write(f"{align}END IF;\n")
    
    script_db_state_tables.write(f"{align}{db_syntax.temp_table_create}ScriptIndexesCols\n")
    script_db_state_tables.write(f"{align}(\n")
    script_db_state_tables.write(f"{align}\ttable_schema {db_syntax.nvarchar_type}(128) not null,\n")
    script_db_state_tables.write(f"{align}\ttable_name {db_syntax.nvarchar_type}(128) not null,\n")
    script_db_state_tables.write(f"{align}\tindex_name {db_syntax.nvarchar_type}(128) not null,\n")
    script_db_state_tables.write(f"{align}\tcol_name {db_syntax.nvarchar_type}(128) not null,\n")
    script_db_state_tables.write(f"{align}\tindex_column_id int null,\n")
    script_db_state_tables.write(f"{align}\tkey_ordinal int null,\n")
    script_db_state_tables.write(f"{align}\tkey_ordinal_diff {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tis_descending_key {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tis_descending_key_diff {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tis_included_column {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tis_included_column_diff {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tindexColStat smallint null\n")
    script_db_state_tables.write(f"{align});\n")
    script_db_state_tables.write(f"{align}\n")
    
    # Process Indexes from schema_tables
    for _, index_row in schema_tables.indexes.iterrows():
        # Get associated index columns
        index_cols = schema_tables.index_cols[
            (schema_tables.index_cols['table_schema'] == index_row['table_schema']) & 
            (schema_tables.index_cols['table_name'] == index_row['table_name']) & 
            (schema_tables.index_cols['index_name'] == index_row['index_name'])
        ]
        
        # Prepare SQL statements - you'd need to implement these functions
        full_table_name = None
        if db_type == DBType.MSSQL:
            full_table_name = f"[{index_row['table_schema']}].[{index_row['table_name']}]"
        elif db_type == DBType.PostgreSQL:
            full_table_name = f"{index_row['table_schema']}.{index_row['table_name']}"
        
        # These would need to be implemented based on your code
        create_index_sql = get_index_sql(schema_tables.indexes, index_cols, db_type)
        sql_check_unq_data = ""
        if scripting_data:
            sql_check_unq_data = get_code_check_unq_data(db_type, full_table_name, index_cols)
        
        # Insert into ScriptIndexes
        script_db_state_tables.write(f"{align}INSERT INTO {db_syntax.temp_table_prefix}ScriptIndexes (table_schema,table_name,index_name,is_unique,is_clustered,ignore_dup_key,is_primary_key,is_unique_constraint,allow_row_locks,allow_page_locks,has_filter,filter_definition,")
        
        if db_type == DBType.PostgreSQL:
            script_db_state_tables.write("index_columns,")
        
        script_db_state_tables.write(f"SQL_CREATE")
        
        if scripting_data:
            script_db_state_tables.write(",SQL_CheckUnqData")
        
        script_db_state_tables.write(")\n")
        
        # VALUES
        if db_type == DBType.MSSQL:
            script_db_state_tables.write(f"{align}VALUES ({quote_str_or_null(index_row['table_schema'])},")
            script_db_state_tables.write(f"{quote_str_or_null(index_row['table_name'])},")
            script_db_state_tables.write(f"{quote_str_or_null(index_row['index_name'])},")
        elif db_type == DBType.PostgreSQL:
            script_db_state_tables.write(f"{align}VALUES ({quote_str_or_null(index_row['table_schema'].lower())},")
            script_db_state_tables.write(f"{quote_str_or_null(index_row['table_name']).lower()},")
            script_db_state_tables.write(f"{quote_str_or_null(index_row['index_name']).lower()},")
        
        script_db_state_tables.write(f"{bool_to_sql_bit_boolean_val(index_row['is_unique'], db_type != DBType.MSSQL)},\n")
        
        # is_clustered handling depends on database type
        if db_type == DBType.PostgreSQL:
            script_db_state_tables.write(f"{align}{bool_to_sql_bit_boolean_val(index_row['is_clustered'], db_type != DBType.MSSQL)},\n")
        else:
            script_db_state_tables.write(f"{align}NULL,\n")
        
        script_db_state_tables.write(f"{align}{bool_to_sql_bit_boolean_val(index_row['ignore_dup_key'], db_type != DBType.MSSQL)},\n")
        script_db_state_tables.write(f"{align}{bool_to_sql_bit_boolean_val(index_row['is_primary_key'], db_type != DBType.MSSQL)},\n")
        script_db_state_tables.write(f"{align}{bool_to_sql_bit_boolean_val(index_row['is_unique_constraint'], db_type != DBType.MSSQL)},\n")
        script_db_state_tables.write(f"{align}{bool_to_sql_bit_boolean_val(index_row['allow_row_locks'], db_type != DBType.MSSQL)},\n")
        script_db_state_tables.write(f"{align}{bool_to_sql_bit_boolean_val(index_row['allow_page_locks'], db_type != DBType.MSSQL)},\n")
        script_db_state_tables.write(f"{align}{bool_to_sql_bit_boolean_val(index_row['has_filter'], db_type != DBType.MSSQL)},\n")
        script_db_state_tables.write(f"{align}{bool_to_sql_bit_boolean_val(index_row['filter_definition'], db_type != DBType.MSSQL)},\n")
        
        if db_type == DBType.PostgreSQL:
            script_db_state_tables.write(f"{align}'{index_row['index_columns']}',\n")
        
        script_db_state_tables.write(f"{align}{quote_str_or_null(create_index_sql)}")
        
        if scripting_data:
            script_db_state_tables.write(f",{quote_str_or_null(sql_check_unq_data)}")
        
        script_db_state_tables.write(");\n")
        script_db_state_tables.write(f"{align}\n")
        
        # Insert index columns
        script_db_state_tables.write(f"{align}--Insert Index Columns\n")
        for _, index_col_row in index_cols.iterrows():
            script_db_state_tables.write(f"{align}INSERT INTO {db_syntax.temp_table_prefix}ScriptIndexesCols (table_schema,table_name,index_name,col_name,index_column_id,key_ordinal,is_descending_key,is_included_column)\n")
            script_db_state_tables.write(f"{align}VALUES ({quote_str_or_null(index_row['table_schema'].lower())},")
            script_db_state_tables.write(f"{quote_str_or_null(index_row['table_name'].lower())},")
            script_db_state_tables.write(f"{quote_str_or_null(index_row['index_name'].lower())},")
            script_db_state_tables.write(f"{quote_str_or_null(index_col_row['col_name'].lower())},\n")
            script_db_state_tables.write(f"{align}{quote_str_or_null(index_col_row['index_column_id'])},\n")
            script_db_state_tables.write(f"{align}{quote_str_or_null(index_col_row['key_ordinal'])},\n")
            script_db_state_tables.write(f"{align}{bool_to_sql_bit_boolean_val(index_col_row['is_descending_key'], db_type != DBType.MSSQL)},\n")
            script_db_state_tables.write(f"{align}{quote_str_or_null(index_col_row['is_included_column'])});\n")
            script_db_state_tables.write(f"{align}\n")
    
    # Handle checking against existing DB state
    if overall_table_schema_name_in_scripting and len(overall_table_schema_name_in_scripting) > 0:
        script_db_state_tables.write(f"{align}--Indexes only on Johannes database (need to add)\n")
        
        if db_type == DBType.MSSQL:
            script_db_state_tables.write(f"{align}UPDATE  #ScriptIndexes SET indexStat = 1\n")
            script_db_state_tables.write(f"{align}FROM    #ScriptIndexes J\n")
            script_db_state_tables.write(f"{align}LEFT JOIN ( SELECT  I.name AS index_name,\n")
            script_db_state_tables.write(f"{align}SCHEMA_NAME(o.schema_id) AS table_schema,\n")
            script_db_state_tables.write(f"{align}o.name AS table_name\n")
            script_db_state_tables.write(f"{align}FROM    sys.indexes I\n")
            script_db_state_tables.write(f"{align}INNER JOIN sys.objects O ON I.object_id = O.object_id\n")
            script_db_state_tables.write(f"{align}WHERE o.is_ms_shipped = 0\n")
            script_db_state_tables.write(f"{align}AND i.is_hypothetical = 0\n")
            script_db_state_tables.write(f"{align}AND i.type IN ( 1, 2, 3 )\n")
            script_db_state_tables.write(f"{align}AND SCHEMA_NAME(o.schema_id) + o.name IN ({overall_table_schema_name_in_scripting})\n")
            script_db_state_tables.write(f"{align}) DB ON J.table_schema = DB.table_schema\n")
            script_db_state_tables.write(f"{align}AND J.table_name = DB.table_name\n")
            script_db_state_tables.write(f"{align}AND J.index_name = DB.index_name\n")
            script_db_state_tables.write(f"{align}WHERE   DB.table_name IS NULL\n")
        
        elif db_type == DBType.PostgreSQL:
            script_db_state_tables.write(f"{align}UPDATE  ScriptIndexes SET indexStat = 1\n")
            script_db_state_tables.write(f"{align}From ScriptIndexes J\n")
            script_db_state_tables.write(f"{align}Left Join (SELECT\n")
            script_db_state_tables.write(f"{align}scm.nspname  || '.' || t.relname as object_id, i.oid as index_oid,\n")
            script_db_state_tables.write(f"{align}scm.nspname As table_schema,\n")
            script_db_state_tables.write(f"{align}t.relname As table_name,\n")
            script_db_state_tables.write(f"{align}i.relname as index_name\n")
            script_db_state_tables.write(f"{align}from\n")
            script_db_state_tables.write(f"{align}pg_index ix\n")
            script_db_state_tables.write(f"{align}inner Join pg_class i  ON i.oid = ix.indexrelid\n")
            script_db_state_tables.write(f"{align}inner Join pg_class t on t.oid = ix.indrelid\n")
            script_db_state_tables.write(f"{align}inner Join pg_namespace scm on t.relnamespace = scm.oid\n")
            script_db_state_tables.write(f"{align}WHERE scm.nspname || t.relname IN ({overall_table_schema_name_in_scripting})\n")
            script_db_state_tables.write(f"{align}) DB ON LOWER(J.table_schema) = LOWER(DB.table_schema)\n")
            script_db_state_tables.write(f"{align}And LOWER(J.table_name) = LOWER(DB.table_name)\n")
            script_db_state_tables.write(f"{align}And LOWER(J.index_name) = LOWER(DB.index_name)\n")
            script_db_state_tables.write(f"{align}WHERE DB.table_name Is NULL AND ScriptIndexes.index_name = J.index_name;\n")
        
        script_db_state_tables.write(f"{align}\n")
        
        # Indexes only on DB (need to drop)
        if overall_table_schema_name_in_scripting and len(overall_table_schema_name_in_scripting) > 0:
            script_db_state_tables.write(f"{align}--Indexes only on DB (need to drop)\n")
        
            if db_type == DBType.MSSQL:
                script_db_state_tables.write(f"{align}INSERT INTO #ScriptIndexes (table_schema, table_name, index_name, is_unique_constraint, is_primary_key, indexStat)\n")
                script_db_state_tables.write(f"{align}SELECT DB.table_schema, DB.table_name, DB.index_name, DB.is_unique_constraint, DB.is_primary_key, 2\n")
                script_db_state_tables.write(f"{align}FROM #ScriptIndexes J\n")
                script_db_state_tables.write(f"{align}RIGHT JOIN ( SELECT I.name AS index_name,\n")
                script_db_state_tables.write(f"{align}SCHEMA_NAME(o.schema_id) AS table_schema,\n")
                script_db_state_tables.write(f"{align}o.name AS table_name, I.is_unique_constraint, I.is_primary_key\n")
                script_db_state_tables.write(f"{align}FROM sys.indexes I\n")
                script_db_state_tables.write(f"{align}INNER JOIN sys.objects O ON I.object_id = O.object_id\n")
                script_db_state_tables.write(f"{align}WHERE o.is_ms_shipped = 0\n")
                script_db_state_tables.write(f"{align}AND i.is_hypothetical = 0\n")
                script_db_state_tables.write(f"{align}AND i.type IN (1, 2, 3)\n")
                script_db_state_tables.write(f"{align}AND SCHEMA_NAME(o.schema_id) + o.name IN ({overall_table_schema_name_in_scripting})\n")
                script_db_state_tables.write(f"{align}) DB ON J.table_schema = DB.table_schema\n")
                script_db_state_tables.write(f"{align}AND J.table_name = DB.table_name\n")
                script_db_state_tables.write(f"{align}AND J.index_name = DB.index_name\n")
                script_db_state_tables.write(f"{align}WHERE J.table_name IS NULL\n")
            
            elif db_type == DBType.PostgreSQL:
                script_db_state_tables.write(f"{align}INSERT INTO ScriptIndexes (table_schema, table_name, index_name, is_unique_constraint, is_primary_key, indexStat)\n")
                script_db_state_tables.write(f"{align}SELECT DB.table_schema, DB.table_name, DB.index_name, DB.is_unique_constraint, DB.is_primary_key, 2\n")
                script_db_state_tables.write(f"{align}FROM ScriptIndexes J\n")
                script_db_state_tables.write(f"{align}RIGHT JOIN ( SELECT\n")
                script_db_state_tables.write(f"{align}scm.nspname || '.' || t.relname as object_id, i.oid as index_oid,\n")
                script_db_state_tables.write(f"{align}scm.nspname AS table_schema,\n")
                script_db_state_tables.write(f"{align}t.relname AS table_name,\n")
                script_db_state_tables.write(f"{align}i.relname as index_name,\n")
                script_db_state_tables.write(f"{align}CASE cnst.contype WHEN 'u' THEN True ELSE False END as is_unique_constraint,\n")
                script_db_state_tables.write(f"{align}indisprimary as is_primary_key\n")
                script_db_state_tables.write(f"{align}FROM pg_index ix\n")
                script_db_state_tables.write(f"{align}INNER JOIN pg_class i ON i.oid = ix.indexrelid\n")
                script_db_state_tables.write(f"{align}INNER JOIN pg_class t ON t.oid = ix.indrelid\n")
                script_db_state_tables.write(f"{align}INNER JOIN pg_namespace scm ON t.relnamespace = scm.oid\n")
                script_db_state_tables.write(f"{align}INNER JOIN pg_class cls ON cls.oid = ix.indexrelid\n")
                script_db_state_tables.write(f"{align}INNER JOIN pg_am am ON am.oid = cls.relam\n")
                script_db_state_tables.write(f"{align}INNER JOIN pg_indexes idx ON idx.schemaname = scm.nspname AND idx.tablename = t.relname AND idx.indexname = i.relname\n")
                script_db_state_tables.write(f"{align}LEFT JOIN pg_constraint cnst ON t.oid = cnst.conrelid AND i.oid = cnst.conindid AND cnst.contype = 'u'\n")
                script_db_state_tables.write(f"{align}WHERE scm.nspname || t.relname IN ({overall_table_schema_name_in_scripting})\n")
                script_db_state_tables.write(f"{align}) DB ON LOWER(J.table_schema) = LOWER(DB.table_schema)\n")
                script_db_state_tables.write(f"{align}AND LOWER(J.table_name) = LOWER(DB.table_name)\n")
                script_db_state_tables.write(f"{align}AND LOWER(J.index_name) = LOWER(DB.index_name)\n")
                script_db_state_tables.write(f"{align}WHERE J.table_name IS NULL;\n")
        
        script_db_state_tables.write(f"{align}\n")
        
        # Index columns operations
        if db_type == DBType.MSSQL:
            script_db_state_tables.write(f"{align}--index Cols only On Johannes database (need To add)\n")
            script_db_state_tables.write(f"{align}UPDATE #ScriptIndexesCols SET indexColStat = 1\n")
            script_db_state_tables.write(f"{align}FROM #ScriptIndexesCols J\n")
            script_db_state_tables.write(f"{align}LEFT JOIN ( SELECT I.name AS index_name,\n")
            script_db_state_tables.write(f"{align}SCHEMA_NAME(o.schema_id) AS table_schema,\n")
            script_db_state_tables.write(f"{align}o.name AS table_name, C.name AS [col_name]\n")
            script_db_state_tables.write(f"{align}FROM sys.indexes I\n")
            script_db_state_tables.write(f"{align}INNER JOIN sys.objects O ON I.object_id = O.object_id\n")
            script_db_state_tables.write(f"{align}INNER JOIN sys.index_columns IC ON I.object_id = IC.object_id AND I.index_id = IC.index_id\n")
            script_db_state_tables.write(f"{align}INNER JOIN sys.columns C ON I.object_id = C.object_id AND IC.column_id = C.column_id\n")
            script_db_state_tables.write(f"{align}WHERE o.is_ms_shipped = 0\n")
            script_db_state_tables.write(f"{align}AND i.is_hypothetical = 0\n")
            script_db_state_tables.write(f"{align}AND i.type IN (1, 2, 3)\n")
            script_db_state_tables.write(f"{align}AND SCHEMA_NAME(o.schema_id) + o.name IN ({overall_table_schema_name_in_scripting})\n")
            script_db_state_tables.write(f"{align}) DB ON J.table_schema = DB.table_schema\n")
            script_db_state_tables.write(f"{align}AND J.table_name = DB.table_name\n")
            script_db_state_tables.write(f"{align}AND J.index_name = DB.index_name\n")
            script_db_state_tables.write(f"{align}AND J.col_name = DB.col_name\n")
            script_db_state_tables.write(f"{align}WHERE DB.col_name IS NULL\n")
            script_db_state_tables.write(f"{align}\n")
            
            script_db_state_tables.write(f"{align}--Index Columns only on DB (need to drop)\n")
            script_db_state_tables.write(f"{align}INSERT INTO #ScriptIndexesCols\n")
            script_db_state_tables.write(f"{align}(table_schema,\n")
            script_db_state_tables.write(f"{align}table_name,\n")
            script_db_state_tables.write(f"{align}index_name,\n")
            script_db_state_tables.write(f"{align}col_name,\n")
            script_db_state_tables.write(f"{align}indexColStat)\n")
            script_db_state_tables.write(f"{align}SELECT DB.table_schema,\n")
            script_db_state_tables.write(f"{align}DB.table_name,\n")
            script_db_state_tables.write(f"{align}DB.index_name,\n")
            script_db_state_tables.write(f"{align}DB.col_name,\n")
            script_db_state_tables.write(f"{align}2\n")
            script_db_state_tables.write(f"{align}FROM #ScriptIndexesCols J\n")
            script_db_state_tables.write(f"{align}RIGHT JOIN ( SELECT I.name AS index_name,\n")
            script_db_state_tables.write(f"{align}SCHEMA_NAME(o.schema_id) AS table_schema,\n")
            script_db_state_tables.write(f"{align}o.name AS table_name, c.name AS col_name\n")
            script_db_state_tables.write(f"{align}FROM sys.indexes I\n")
            script_db_state_tables.write(f"{align}INNER JOIN sys.objects O ON I.object_id = O.object_id\n")
            script_db_state_tables.write(f"{align}INNER JOIN sys.index_columns IC ON I.object_id = IC.object_id\n")
            script_db_state_tables.write(f"{align}AND I.index_id = IC.index_id\n")
            script_db_state_tables.write(f"{align}INNER JOIN sys.columns C ON I.object_id = C.object_id\n")
            script_db_state_tables.write(f"{align}AND IC.column_id = C.column_id\n")
            script_db_state_tables.write(f"{align}WHERE o.is_ms_shipped = 0\n")
            script_db_state_tables.write(f"{align}AND i.is_hypothetical = 0\n")
            script_db_state_tables.write(f"{align}AND i.type IN (1, 2, 3)\n")
            script_db_state_tables.write(f"{align}AND SCHEMA_NAME(o.schema_id) + o.name IN ({overall_table_schema_name_in_scripting})\n")
            script_db_state_tables.write(f"{align}) DB ON J.table_schema = DB.table_schema\n")
            script_db_state_tables.write(f"{align}AND J.table_name = DB.table_name\n")
            script_db_state_tables.write(f"{align}AND J.index_name = DB.index_name\n")
            script_db_state_tables.write(f"{align}AND J.col_name = DB.col_name\n")
            script_db_state_tables.write(f"{align}WHERE J.table_name IS NULL\n")
        
        elif db_type == DBType.PostgreSQL:
            # For PostgreSQL, different approach - just mark the index as different if columns are different
            script_db_state_tables.write(f"{align}update ScriptIndexes Set is_unique_diff=True, indexStat = 3\n")
            script_db_state_tables.write(f"{align}From ScriptIndexes J INNER Join (\n")
            script_db_state_tables.write(f"{align}Select\n")
            script_db_state_tables.write(f"{align}scm.nspname || '.' || t.relname as object_id, i.oid as index_oid,\n")
            script_db_state_tables.write(f"{align}scm.nspname AS table_schema,\n")
            script_db_state_tables.write(f"{align}t.relname AS table_name,\n")
            script_db_state_tables.write(f"{align}i.relname as index_name,\n")
            script_db_state_tables.write(f"{align}substring(idx.indexdef,'\\((.*?)\\)') as index_columns\n")
            script_db_state_tables.write(f"{align}from\n")
            script_db_state_tables.write(f"{align}pg_index ix\n")
            script_db_state_tables.write(f"{align}inner Join pg_class i ON i.oid = ix.indexrelid\n")
            script_db_state_tables.write(f"{align}inner Join pg_class t on t.oid = ix.indrelid\n")
            script_db_state_tables.write(f"{align}inner Join pg_namespace scm on t.relnamespace = scm.oid\n")
            script_db_state_tables.write(f"{align}inner Join pg_class cls ON cls.oid = ix.indexrelid\n")
            script_db_state_tables.write(f"{align}inner JOIN pg_am am ON am.oid = cls.relam\n")
            script_db_state_tables.write(f"{align}inner Join pg_indexes idx on idx.schemaname = scm.nspname AND idx.tablename = t.relname AND idx.indexname = i.relname\n")
            script_db_state_tables.write(f"{align}Left Join pg_constraint cnst on t.oid = cnst.conrelid AND i.oid = cnst.conindid AND cnst.contype='u'\n")
            script_db_state_tables.write(f"{align}where scm.nspname || t.relname IN ({overall_table_schema_name_in_scripting})\n")
            script_db_state_tables.write(f"{align}) DB\n")
            script_db_state_tables.write(f"{align}On LOWER(J.table_schema) = LOWER(DB.table_schema) AND LOWER(J.table_name) = LOWER(DB.table_name) AND LOWER(J.index_name) = LOWER(DB.index_name)\n")
            script_db_state_tables.write(f"{align}where J.index_columns <> DB.index_columns AND ScriptIndexes.index_name = J.index_name;\n")
        
        script_db_state_tables.write(f"{align}\n")
    
    # Update index flags
    script_db_state_tables.write(f"{align}---updates Of index And index columns flags--------------------\n")
    
    script_db_state_tables.write(f"{align}---updates Of index flags--------------------\n")
    script_db_state_tables.write(f"{align}--is_unique\n")
    if db_type == DBType.MSSQL:
        script_db_state_tables.write(f"{align}update #ScriptIndexes Set is_unique_diff=1, indexStat = 3\n")
        script_db_state_tables.write(f"{align}from #ScriptIndexes J INNER join (Select is_unique, SCHEMA_NAME(o.schema_id) As table_schema, o.name As table_name, i.name as index_name from sys.tables O inner join sys.indexes I on o.object_id=I.object_id) DB\n")
        script_db_state_tables.write(f"{align}on J.table_schema= DB.table_schema And J.table_name = DB.table_name And J.index_name = DB.index_name\n")
        script_db_state_tables.write(f"{align}where J.is_unique <> DB.is_unique\n")
    elif db_type == DBType.PostgreSQL:
        script_db_state_tables.write(f"{align}update ScriptIndexes Set is_unique_diff=True, indexStat = 3\n")
        script_db_state_tables.write(f"{align}From ScriptIndexes J INNER Join\n")
        script_db_state_tables.write(f"{align}(\n")
        script_db_state_tables.write(f"{align}Select\n")
        script_db_state_tables.write(f"{align}scm.nspname || '.' || t.relname as object_id, i.oid as index_oid,\n")
        script_db_state_tables.write(f"{align}scm.nspname AS table_schema,\n")
        script_db_state_tables.write(f"{align}t.relname AS table_name,\n")
        script_db_state_tables.write(f"{align}i.relname as index_name, i.relname AS name,\n")
        script_db_state_tables.write(f"{align}ix.indisunique as is_unique,\n")
        script_db_state_tables.write(f"{align}indisclustered as is_clustered\n")
        script_db_state_tables.write(f"{align}from\n")
        script_db_state_tables.write(f"{align}pg_index ix\n")
        script_db_state_tables.write(f"{align}inner Join pg_class i ON i.oid = ix.indexrelid\n")
        script_db_state_tables.write(f"{align}inner Join pg_class t on t.oid = ix.indrelid\n")
        script_db_state_tables.write(f"{align}inner Join pg_namespace scm on t.relnamespace = scm.oid\n")
        script_db_state_tables.write(f"{align}where scm.nspname Not in ('pg_catalog','information_schema', 'pg_toast')\n")
        script_db_state_tables.write(f"{align}) DB\n")
        script_db_state_tables.write(f"{align}On J.table_schema= DB.table_schema And J.table_name = DB.table_name And J.index_name = DB.index_name\n")
        script_db_state_tables.write(f"{align}where J.is_unique <> DB.is_unique\n")
        script_db_state_tables.write(f"{align}And (ScriptIndexes.index_name = J.index_name);\n")
    
    script_db_state_tables.write(f"{align}\n")
    
    # is_clustered (PostgreSQL only)
    script_db_state_tables.write(f"{align}--is_clustered\n")
    if db_type == DBType.PostgreSQL:
        script_db_state_tables.write(f"{align}update ScriptIndexes Set is_clustered_diff=True, indexStat = 3\n")
        script_db_state_tables.write(f"{align}From ScriptIndexes J INNER Join\n")
        script_db_state_tables.write(f"{align}(\n")
        script_db_state_tables.write(f"{align}Select\n")
        script_db_state_tables.write(f"{align}scm.nspname || '.' || t.relname as object_id, i.oid as index_oid,\n")
        script_db_state_tables.write(f"{align}scm.nspname AS table_schema,\n")
        script_db_state_tables.write(f"{align}t.relname AS table_name,\n")
        script_db_state_tables.write(f"{align}i.relname as index_name, i.relname AS name,\n")
        script_db_state_tables.write(f"{align}ix.indisunique as is_unique,\n")
        script_db_state_tables.write(f"{align}indisclustered as is_clustered\n")
        script_db_state_tables.write(f"{align}from\n")
        script_db_state_tables.write(f"{align}pg_index ix\n")
        script_db_state_tables.write(f"{align}inner Join pg_class i ON i.oid = ix.indexrelid\n")
        script_db_state_tables.write(f"{align}inner Join pg_class t on t.oid = ix.indrelid\n")
        script_db_state_tables.write(f"{align}inner Join pg_namespace scm on t.relnamespace = scm.oid\n")
        script_db_state_tables.write(f"{align}where scm.nspname Not in ('pg_catalog','information_schema', 'pg_toast')\n")
        script_db_state_tables.write(f"{align}) DB\n")
        script_db_state_tables.write(f"{align}On J.table_schema= DB.table_schema And J.table_name = DB.table_name And J.index_name = DB.index_name\n")
        script_db_state_tables.write(f"{align}where J.is_clustered <> DB.is_clustered\n")
        script_db_state_tables.write(f"{align}And (ScriptIndexes.index_name = J.index_name);\n")
    
    # MSSQL specific flags
    if db_type == DBType.MSSQL:
        # ignore_dup_key
        script_db_state_tables.write(f"{align}--ignore_dup_key\n")
        script_db_state_tables.write(f"{align}update #ScriptIndexes Set ignore_dup_key_diff=1, indexStat=3\n")
        script_db_state_tables.write(f"{align}from #ScriptIndexes J INNER join (Select ignore_dup_key, SCHEMA_NAME(o.schema_id) As table_schema, o.name As table_name, i.name As index_name from sys.tables O inner join sys.indexes I On o.object_id=I.object_id) DB\n")
        script_db_state_tables.write(f"{align}On J.table_schema=DB.table_schema And J.table_name=DB.table_name And J.index_name=DB.index_name\n")
        script_db_state_tables.write(f"{align}where J.ignore_dup_key <> DB.ignore_dup_key\n")
        script_db_state_tables.write(f"{align}\n")
        
        # is_primary_key
        script_db_state_tables.write(f"{align}--is_primary_key\n")
        script_db_state_tables.write(f"{align}update #ScriptIndexes Set is_primary_key_diff=1, indexStat=3\n")
        script_db_state_tables.write(f"{align}from #ScriptIndexes J INNER join (Select is_primary_key, SCHEMA_NAME(o.schema_id) As table_schema, o.name As table_name, i.name As index_name from sys.tables O inner join sys.indexes I On o.object_id=I.object_id) DB\n")
        script_db_state_tables.write(f"{align}On J.table_schema=DB.table_schema And J.table_name=DB.table_name And J.index_name=DB.index_name\n")
        script_db_state_tables.write(f"{align}where J.is_primary_key <> DB.is_primary_key\n")
        script_db_state_tables.write(f"{align}\n")
        
        # is_unique_constraint
        script_db_state_tables.write(f"{align}--is_unique_constraint\n")
        script_db_state_tables.write(f"{align}update #ScriptIndexes Set is_unique_constraint_diff=1, indexStat=3\n")
        script_db_state_tables.write(f"{align}from #ScriptIndexes J INNER join (Select is_unique_constraint, SCHEMA_NAME(o.schema_id) As table_schema, o.name As table_name, i.name As index_name from sys.tables O inner join sys.indexes I On o.object_id=I.object_id) DB\n")
        script_db_state_tables.write(f"{align}On J.table_schema=DB.table_schema And J.table_name=DB.table_name And J.index_name=DB.index_name\n")
        script_db_state_tables.write(f"{align}where J.is_unique_constraint <> DB.is_unique_constraint\n")
        script_db_state_tables.write(f"{align}\n")
        
        # allow_row_locks
        script_db_state_tables.write(f"{align}--allow_row_locks\n")
        script_db_state_tables.write(f"{align}update #ScriptIndexes Set allow_row_locks_diff=1, indexStat=3\n")
        script_db_state_tables.write(f"{align}from #ScriptIndexes J INNER join (Select allow_row_locks, SCHEMA_NAME(o.schema_id) As table_schema, o.name As table_name, i.name As index_name from sys.tables O inner join sys.indexes I On o.object_id=I.object_id) DB\n")
        script_db_state_tables.write(f"{align}On J.table_schema=DB.table_schema And J.table_name=DB.table_name And J.index_name=DB.index_name\n")
        script_db_state_tables.write(f"{align}where J.allow_row_locks <> DB.allow_row_locks\n")
        script_db_state_tables.write(f"{align}\n")
        
        # allow_page_locks
        script_db_state_tables.write(f"{align}--allow_page_locks\n")
        script_db_state_tables.write(f"{align}update #ScriptIndexes Set allow_page_locks_diff=1, indexStat=3\n")
        script_db_state_tables.write(f"{align}from #ScriptIndexes J INNER join (Select allow_page_locks, SCHEMA_NAME(o.schema_id) As table_schema, o.name As table_name, i.name As index_name from sys.tables O inner join sys.indexes I On o.object_id=I.object_id) DB\n")
        script_db_state_tables.write(f"{align}On J.table_schema=DB.table_schema And J.table_name=DB.table_name And J.index_name=DB.index_name\n")
        script_db_state_tables.write(f"{align}where J.allow_page_locks <> DB.allow_page_locks\n")
        script_db_state_tables.write(f"{align}\n")
        
        # has_filter
        script_db_state_tables.write(f"{align}--has_filter\n")
        script_db_state_tables.write(f"{align}update #ScriptIndexes Set has_filter_diff=1, indexStat=3\n")
        script_db_state_tables.write(f"{align}from #ScriptIndexes J INNER join (Select has_filter, SCHEMA_NAME(o.schema_id) As table_schema, o.name As table_name, i.name As index_name from sys.tables O inner join sys.indexes I On o.object_id=I.object_id) DB\n")
        script_db_state_tables.write(f"{align}On J.table_schema=DB.table_schema And J.table_name=DB.table_name And J.index_name=DB.index_name\n")
        script_db_state_tables.write(f"{align}where J.has_filter <> DB.has_filter\n")
        script_db_state_tables.write(f"{align}\n")
        
        # filter_definition
        script_db_state_tables.write(f"{align}--filter_definition\n")
        script_db_state_tables.write(f"{align}update #ScriptIndexes Set filter_definition_diff=1, indexStat=3\n")
        script_db_state_tables.write(f"{align}from #ScriptIndexes J INNER join (Select filter_definition, SCHEMA_NAME(o.schema_id) As table_schema, o.name As table_name, i.name As index_name from sys.tables O inner join sys.indexes I On o.object_id=I.object_id) DB\n")
        script_db_state_tables.write(f"{align}On J.table_schema=DB.table_schema And J.table_name=DB.table_name And J.index_name=DB.index_name\n")
        script_db_state_tables.write(f"{align}where J.filter_definition <> DB.filter_definition\n")
        script_db_state_tables.write(f"{align}\n")
        
        # Update index column flags (MSSQL only)
        script_db_state_tables.write(f"{align}--updates Of index coluns flags--------------------\n")
        script_db_state_tables.write(f"{align}--key_ordinal\n")
        script_db_state_tables.write(f"{align}UPDATE #ScriptIndexesCols\n")
        script_db_state_tables.write(f"{align}SET key_ordinal_diff = 1,\n")
        script_db_state_tables.write(f"{align}indexColStat = 3\n")
        script_db_state_tables.write(f"{align}FROM #ScriptIndexesCols J\n")
        script_db_state_tables.write(f"{align}INNER JOIN ( SELECT key_ordinal,\n")
        script_db_state_tables.write(f"{align}SCHEMA_NAME(o.schema_id) AS table_schema,\n")
        script_db_state_tables.write(f"{align}o.name AS table_name,\n")
        script_db_state_tables.write(f"{align}i.name AS index_name, c.name AS col_name\n")
        script_db_state_tables.write(f"{align}FROM sys.tables O\n")
        script_db_state_tables.write(f"{align}INNER JOIN sys.indexes I ON o.object_id = I.object_id\n")
        script_db_state_tables.write(f"{align}INNER JOIN sys.index_columns IC ON I.object_id = IC.object_id\n")
        script_db_state_tables.write(f"{align}AND I.index_id = IC.index_id\n")
        script_db_state_tables.write(f"{align}INNER JOIN sys.columns C ON I.object_id = C.object_id\n")
        script_db_state_tables.write(f"{align}AND IC.column_id = C.column_id\n")
        script_db_state_tables.write(f"{align}) DB ON J.table_schema = DB.table_schema\n")
        script_db_state_tables.write(f"{align}AND J.table_name = DB.table_name\n")
        script_db_state_tables.write(f"{align}AND J.index_name = DB.index_name\n")
        script_db_state_tables.write(f"{align}AND J.col_name = DB.col_name\n")
        script_db_state_tables.write(f"{align}WHERE J.key_ordinal <> DB.key_ordinal\n")
        script_db_state_tables.write(f"{align}\n")
        
        # is_descending_key
        script_db_state_tables.write(f"{align}--is_descending_key\n")
        script_db_state_tables.write(f"{align}UPDATE #ScriptIndexesCols\n")
        script_db_state_tables.write(f"{align}SET is_descending_key_diff = 1,\n")
        script_db_state_tables.write(f"{align}indexColStat = 3\n")
        script_db_state_tables.write(f"{align}FROM #ScriptIndexesCols J\n")
        script_db_state_tables.write(f"{align}INNER JOIN ( SELECT is_descending_key,\n")
        script_db_state_tables.write(f"{align}SCHEMA_NAME(o.schema_id) AS table_schema,\n")
        script_db_state_tables.write(f"{align}o.name AS table_name,\n")
        script_db_state_tables.write(f"{align}i.name AS index_name, c.name AS col_name\n")
        script_db_state_tables.write(f"{align}FROM sys.tables O\n")
        script_db_state_tables.write(f"{align}INNER JOIN sys.indexes I ON o.object_id = I.object_id\n")
        script_db_state_tables.write(f"{align}INNER JOIN sys.index_columns IC ON I.object_id = IC.object_id\n")
        script_db_state_tables.write(f"{align}AND I.index_id = IC.index_id\n")
        script_db_state_tables.write(f"{align}INNER JOIN sys.columns C ON I.object_id = C.object_id\n")
        script_db_state_tables.write(f"{align}AND IC.column_id = C.column_id\n")
        script_db_state_tables.write(f"{align}) DB ON J.table_schema = DB.table_schema\n")
        script_db_state_tables.write(f"{align}AND J.table_name = DB.table_name\n")
        script_db_state_tables.write(f"{align}AND J.index_name = DB.index_name\n")
        script_db_state_tables.write(f"{align}AND J.col_name = DB.col_name\n")
        script_db_state_tables.write(f"{align}WHERE J.is_descending_key <> DB.is_descending_key\n")
        script_db_state_tables.write(f"{align}\n")
        
        # is_included_column
        script_db_state_tables.write(f"{align}--is_included_column\n")
        script_db_state_tables.write(f"{align}UPDATE #ScriptIndexesCols\n")
        script_db_state_tables.write(f"{align}SET is_included_column_diff = 1,\n")
        script_db_state_tables.write(f"{align}indexColStat = 3\n")
        script_db_state_tables.write(f"{align}FROM #ScriptIndexesCols J\n")
        script_db_state_tables.write(f"{align}INNER JOIN ( SELECT is_included_column,\n")
        script_db_state_tables.write(f"{align}SCHEMA_NAME(o.schema_id) AS table_schema,\n")
        script_db_state_tables.write(f"{align}o.name AS table_name,\n")
        script_db_state_tables.write(f"{align}i.name AS index_name, c.name AS col_name\n")
        script_db_state_tables.write(f"{align}FROM sys.tables O\n")
        script_db_state_tables.write(f"{align}INNER JOIN sys.indexes I ON o.object_id = I.object_id\n")
        script_db_state_tables.write(f"{align}INNER JOIN sys.index_columns IC ON I.object_id = IC.object_id\n")
        script_db_state_tables.write(f"{align}AND I.index_id = IC.index_id\n")
        script_db_state_tables.write(f"{align}INNER JOIN sys.columns C ON I.object_id = C.object_id\n")
        script_db_state_tables.write(f"{align}AND IC.column_id = C.column_id\n")
        script_db_state_tables.write(f"{align}) DB ON J.table_schema = DB.table_schema\n")
        script_db_state_tables.write(f"{align}AND J.table_name = DB.table_name\n")
        script_db_state_tables.write(f"{align}AND J.index_name = DB.index_name\n")
        script_db_state_tables.write(f"{align}AND J.col_name = DB.col_name\n")
        script_db_state_tables.write(f"{align}WHERE J.is_included_column <> DB.is_included_column\n")
        
        # Mark indexes with different columns
        script_db_state_tables.write(f"{align}\n")
        script_db_state_tables.write(f"{align}--wherever got index columns that are different, mark the indexes as different\n")
        script_db_state_tables.write(f"{align}UPDATE #ScriptIndexes SET col_diff=1\n")
        script_db_state_tables.write(f"{align}FROM #ScriptIndexes I INNER JOIN #ScriptIndexesCols IC ON I.table_schema=IC.table_schema AND I.table_name=IC.table_name AND I.index_name=IC.index_name\n")
        script_db_state_tables.write(f"{align}WHERE IC.IndexColStat IS NOT NULL AND I.indexStat NOT IN (1,2)\n")
        
        # Mark indexes that use columns that need to be altered
        script_db_state_tables.write(f"{align}\n")
        script_db_state_tables.write(f"{align}--wherever got cols that are different that the index uses, mark the index so can be dropped and re-created after the column is altered\n")
        script_db_state_tables.write(f"{align}UPDATE #ScriptIndexes SET db_col_diff=1\n")
        script_db_state_tables.write(f"{align}FROM #ScriptIndexes I INNER JOIN #ScriptIndexesCols IC ON I.table_schema=IC.table_schema AND I.table_name=IC.table_name AND I.index_name=IC.index_name\n")
        script_db_state_tables.write(f"{align}INNER JOIN #ScriptCols C ON I.table_schema=C.table_schema AND I.table_name=C.table_name AND IC.col_name=C.col_name\n")
        script_db_state_tables.write(f"{align}WHERE c.colStat=3 AND I.indexStat IS NULL OR indexStat=3\n")
        
        # Bubble up differences to table
        script_db_state_tables.write(f"{align}\n")
        script_db_state_tables.write(f"{align}--Bubble up differences to table\n")
        script_db_state_tables.write(f"{align}UPDATE #ScriptTables SET index_diff=1\n")
        script_db_state_tables.write(f"{align}FROM #ScriptTables T INNER JOIN #ScriptIndexes I ON t.table_schema=I.table_schema AND t.table_name=I.table_name\n")
        script_db_state_tables.write(f"{align}WHERE I.col_diff = 1 OR I.db_col_diff = 1 OR indexStat = 3;\n")
    
    script_db_state_tables.write(f"{align}---End Of index And index columns flags update--------------------\n")
    
    # Generate code to check for bad data if requested
    if scripting_data and bad_data_pre_add_indx:
        bad_data_pre_add_indx.write("\n")
        bad_data_pre_add_indx.write("--Search For bad data (the kind that would make it impossible To add the Unique Index\\Constraint\n")
        
        if db_type == DBType.MSSQL:
            bad_data_pre_add_indx.write("Declare @SQL_CheckUnqData NVARCHAR(MAX)\n")
            bad_data_pre_add_indx.write("Declare gotBadData CURSOR FAST_FORWARD\n")
            bad_data_pre_add_indx.write("For\n")
            bad_data_pre_add_indx.write("Select I.table_schema,\n")
            bad_data_pre_add_indx.write("I.table_name,\n")
            bad_data_pre_add_indx.write("I.index_name, I.SQL_CheckUnqData\n")
            bad_data_pre_add_indx.write("FROM #ScriptIndexes I inner join #ScriptTables T On I.table_schema=T.table_schema And I.table_name=T.table_name\n")
            bad_data_pre_add_indx.write("WHERE SQL_CheckUnqData Is Not NULL And (T.tableStat Not In (1) Or t.tableStat Is NULL) And I.db_col_diff Is NULL\n")
            bad_data_pre_add_indx.write("OPEN gotBadData\n")
            bad_data_pre_add_indx.write("FETCH Next FROM gotBadData INTO @table_schema, @table_name, @index_name, @SQL_CheckUnqData\n")
            bad_data_pre_add_indx.write("While @@FETCH_STATUS = 0\n")
            bad_data_pre_add_indx.write("BEGIN\n")
            bad_data_pre_add_indx.write("\tSet @sqlCode='IF EXISTS('+@SQL_CheckUnqData+')\n")
            bad_data_pre_add_indx.write("\tBEGIN\n")
            bad_data_pre_add_indx.write("\t\tUPDATE #ScriptIndexes SET GotBadData=1 WHERE index_name='''+@index_name+'''\n")
            bad_data_pre_add_indx.write("\tEND\n")
            bad_data_pre_add_indx.write("\tELSE\n")
            bad_data_pre_add_indx.write("\tBEGIN\n")
            bad_data_pre_add_indx.write("\t\tUPDATE #ScriptIndexes SET GotBadData=0 WHERE index_name='''+@index_name+'''\n")
            bad_data_pre_add_indx.write("\tEND '\n")
            bad_data_pre_add_indx.write("\n")
            bad_data_pre_add_indx.write("\tEXEC(@sqlCode)\n")
            bad_data_pre_add_indx.write("\tFETCH NEXT FROM gotBadData INTO @table_schema, @table_name, @index_name, @SQL_CheckUnqData\n")
            bad_data_pre_add_indx.write("END\n")
            bad_data_pre_add_indx.write("CLOSE gotBadData\n")
            bad_data_pre_add_indx.write("DEALLOCATE gotBadData\n")
        
        elif db_type == DBType.PostgreSQL:
            bad_data_pre_add_indx.write("\tdeclare temprow record;\n")
            bad_data_pre_add_indx.write("\tBEGIN\n")
            bad_data_pre_add_indx.write("\t\tFOR temprow IN\n")
            bad_data_pre_add_indx.write("\t\t\tSelect I.table_schema,\n")
            bad_data_pre_add_indx.write("\t\t\tI.table_name,\n")
            bad_data_pre_add_indx.write("\t\t\tI.index_name, I.SQL_CheckUnqData\n")
            bad_data_pre_add_indx.write("\t\t\tFROM ScriptIndexes I inner join ScriptTables T On I.table_schema=T.table_schema And I.table_name=T.table_name\n")
            bad_data_pre_add_indx.write("\t\t\tWHERE SQL_CheckUnqData Is Not NULL And (T.tableStat Not In (1) Or t.tableStat Is NULL) And I.db_col_diff Is NULL\n")
            bad_data_pre_add_indx.write("\t\tLOOP\n")
            bad_data_pre_add_indx.write("\t\t\tIF (temprow.SQL_CheckUnqData IS NOT NULL) THEN\n")
            bad_data_pre_add_indx.write("\t\t\t\tsqlCode := '\n")
            bad_data_pre_add_indx.write("\t\t\t\tDo $chkData$\n")
            bad_data_pre_add_indx.write("\t\t\t\t\tBEGIN\n")
            bad_data_pre_add_indx.write("\t\t\t\t\t\t' || temprow.SQL_CheckUnqData || ';\n")
            bad_data_pre_add_indx.write("\t\t\t\t\t\tIf FOUND Then\n")
            bad_data_pre_add_indx.write("\t\t\t\t\t\t\tUPDATE ScriptIndexes SET GotBadData=True WHERE ScriptIndexes.index_name = ''' || temprow.index_name || ''';\n")
            bad_data_pre_add_indx.write("\t\t\t\t\t\tElse\n")
            bad_data_pre_add_indx.write("\t\t\t\t\t\t\tUPDATE ScriptIndexes SET GotBadData=False WHERE ScriptIndexes.index_name = ''' || temprow.index_name || ''';\n")
            bad_data_pre_add_indx.write("\t\t\t\t\t\tEnd If;\n")
            bad_data_pre_add_indx.write("\t\t\t\t\tEnd;\n")
            bad_data_pre_add_indx.write("\t\t\t\t$chkData$';\n")
            bad_data_pre_add_indx.write("\t\t\t\texecute sqlCode;\n")
            bad_data_pre_add_indx.write("\t\t\tEnd If;\n")
            bad_data_pre_add_indx.write("\t\tEnd Loop;\n")
            bad_data_pre_add_indx.write("\tEnd; --off\n")
    
    return script_db_state_tables