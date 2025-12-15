from enum import Enum
from typing import Optional, Dict, List
from dataclasses import dataclass
import pandas as pd
from io import StringIO
from src.defs.script_defs import DBType, DBSyntax, ScriptingOptions, ScriptTableOptions, DBEntScriptState
from src.generate.generate_final_create_table import get_create_table_from_sys_tables, get_col_sql
from src.data_load.from_db.load_from_db_pg import DBSchema
from src.utils.funcs import quote_str_or_null, quote_str_or_null_bool, numeric_or_null


def create_db_state_columns(
    schema_tables: DBSchema, 
    tbl_ents_to_script: pd.DataFrame,        
    db_type: DBType, #that's the destination db type    
    overall_table_schema_name_in_scripting: Optional[str],
    scripting_data: Optional[bool] = False
) -> StringIO:
    
    db_syntax = DBSyntax.get_syntax(db_type)
    # Create the columns script section header
    script_db_state_tables = StringIO()
    align = "\t" * 2 #2, for now
    script_db_state_tables.write(f"\n{align}--columns\n")
    
    # Handle different database types
    if db_type == DBType.MSSQL:
        script_db_state_tables.write(f"{align}IF (OBJECT_ID('tempdb..#ScriptCols') IS NOT NULL) \n")
        script_db_state_tables.write(f"{align}BEGIN\n")
        script_db_state_tables.write(f"{align}\tDROP TABLE #ScriptCols;\n")
        script_db_state_tables.write(f"{align}END;\n")
    elif db_type == DBType.PostgreSQL:
        script_db_state_tables.write(f"{align}perform  n.nspname ,c.relname\n")
        script_db_state_tables.write(f"{align}FROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace\n")
        script_db_state_tables.write(f"{align}WHERE n.nspname like 'pg_temp_%' AND c.relname='scriptcols' AND pg_catalog.pg_table_is_visible(c.oid);\n")
        script_db_state_tables.write(f"{align}IF FOUND THEN\n")
        script_db_state_tables.write(f"{align}\tDROP TABLE {db_syntax.temp_table_prefix}ScriptCols;\n")
        script_db_state_tables.write(f"{align}END IF;\n")
    
    # Create temporary table for script columns
    script_db_state_tables.write(f"{align}{db_syntax.temp_table_create}ScriptCols\n")
    script_db_state_tables.write(f"{align}(\n")
    script_db_state_tables.write(f"{align}\ttable_schema {db_syntax.nvarchar_type} (128) not null,\n")
    script_db_state_tables.write(f"{align}\ttable_name {db_syntax.nvarchar_type} (128) not null,\n")
    script_db_state_tables.write(f"{align}\tcol_name {db_syntax.nvarchar_type} (128) not null,\n")
    script_db_state_tables.write(f"{align}\tuser_type_name {db_syntax.nvarchar_type} (128) null,\n")
    script_db_state_tables.write(f"{align}\tuser_type_name_diff {db_syntax.boolean_type} null, \n")
    script_db_state_tables.write(f"{align}\tuser_type_name_db  {db_syntax.nvarchar_type} (128) null, \n")
    script_db_state_tables.write(f"{align}\tmax_length smallint null,\n")
    script_db_state_tables.write(f"{align}\tmax_length_diff {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tmax_length_db smallint null,\n")
    script_db_state_tables.write(f"{align}\tprecision smallint null,\n")
    script_db_state_tables.write(f"{align}\tprecision_diff bit null,\n")
    script_db_state_tables.write(f"{align}\tprecision_db smallint null,\n")
    script_db_state_tables.write(f"{align}\tscale smallint null,\n")
    script_db_state_tables.write(f"{align}\tscale_diff bit null,\n")
    script_db_state_tables.write(f"{align}\tscale_db smallint null,\n")
    script_db_state_tables.write(f"{align}\tis_nullable {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tis_nullable_diff bit null,\n")
    script_db_state_tables.write(f"{align}\tis_nullable_db {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tis_identity {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tis_identity_diff bit null,\n")
    script_db_state_tables.write(f"{align}\tis_identity_db {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tis_computed bit null,\n")
    script_db_state_tables.write(f"{align}\tis_computed_diff bit null,\n")
    script_db_state_tables.write(f"{align}\tcollation_name {db_syntax.nvarchar_type} (128) null,\n")
    script_db_state_tables.write(f"{align}\tcollation_name_diff bit null,\n")
    script_db_state_tables.write(f"{align}\tcollation_name_db {db_syntax.nvarchar_type} (128) null,\n")
    script_db_state_tables.write(f"{align}\tcomputed_definition {db_syntax.nvarchar_type} {db_syntax.max_length_str} null,\n")
    script_db_state_tables.write(f"{align}\tcomputed_definition_diff bit null,\n")
    script_db_state_tables.write(f"{align}\tcomputed_definition_db {db_syntax.nvarchar_type} {db_syntax.max_length_str} null,\n")
    script_db_state_tables.write(f"{align}\tcolStat smallint null,\n")
    script_db_state_tables.write(f"{align}\tdiff_descr {db_syntax.nvarchar_type} {db_syntax.max_length_str} null,\n")
    script_db_state_tables.write(f"{align}\tSQL_CREATE {db_syntax.nvarchar_type} {db_syntax.max_length_str} null,\n")
    script_db_state_tables.write(f"{align}\tSQL_ALTER {db_syntax.nvarchar_type} {db_syntax.max_length_str} null,\n")
    script_db_state_tables.write(f"{align}\tSQL_DROP {db_syntax.nvarchar_type} {db_syntax.max_length_str} null\n")
    
    if scripting_data:
        script_db_state_tables.write(f"{align}\t,SQL_ALTER_PostData_NotNULL {db_syntax.nvarchar_type} {db_syntax.max_length_str} null --if we are adding NULL column and got data as well - then add, set data, then change to NOT NULL\n")
    
    script_db_state_tables.write(f"{align}{align});\n\n")

    tables_to_script_set = set()
    filtered_ents = tbl_ents_to_script[
        (tbl_ents_to_script['scriptschema'] == True) & 
        (tbl_ents_to_script['enttype'] == 'Table')
    ]
    
    for _, ent_row in filtered_ents.iterrows():
        tables_to_script_set.add((ent_row['entschema'], ent_row['entname']))
        
    # Generate the column script rows (but only for tables that should be scripted, in case filter was applied)
    alter_col=''
    for _, row in schema_tables.columns.iterrows():
        # Only process if this table is in our tbl_ents_to_script with scriptschema=True
        if (row['table_schema'], row['table_name']) not in tables_to_script_set:
            continue

        if db_type == DBType.MSSQL:
            alter_col = f"'ALTER TABLE [{row['table_schema']}].[{row['table_name']}] DROP COLUMN [{row['col_name']}]'"
        elif db_type == DBType.PostgreSQL:
            alter_col = f"'ALTER TABLE {row['table_schema']}.{row['table_name']} DROP COLUMN {row['col_name']}'"
            
        
        script_db_state_tables.write(f"{align}INSERT INTO {db_syntax.temp_table_prefix}ScriptCols (table_schema,table_name,col_name,user_type_name,max_length,precision,scale,is_nullable,is_identity,is_computed,collation_name,computed_definition, SQL_CREATE, SQL_ALTER, SQL_DROP{',SQL_ALTER_PostData_NotNULL' if scripting_data else ''})\n")
        script_db_state_tables.write(f"{align}VALUES ({quote_str_or_null(row['table_schema'])},")
        script_db_state_tables.write(f"{align}{quote_str_or_null(row['table_name'])},")
        script_db_state_tables.write(f"{align}{quote_str_or_null(row['col_name'])},")
        script_db_state_tables.write(f"{align}{quote_str_or_null(row['user_type_name'])},")
        script_db_state_tables.write(f"{align}{numeric_or_null(row['max_length'])},")
        script_db_state_tables.write(f"{align}{numeric_or_null(row['precision'])},")
        script_db_state_tables.write(f"{align}{numeric_or_null(row['scale'])},")
        script_db_state_tables.write(f"{align}{quote_str_or_null_bool(row['is_nullable'])},")
        script_db_state_tables.write(f"{align}{quote_str_or_null_bool(row['is_identity'])},")
        script_db_state_tables.write(f"{align}{quote_str_or_null(row['is_computed'])},")
        script_db_state_tables.write(f"{align}{quote_str_or_null(row['collation_name'])},")
        script_db_state_tables.write(f"{align}{quote_str_or_null(row['computed_definition'])},")
        script_db_state_tables.write(f"{align}{quote_str_or_null(get_col_sql(sys_cols_row=row, table_schema = row['table_schema'], table_name = row['table_name'], script_state = DBEntScriptState.Add, db_type = DBType.PostgreSQL, column_identity =False, force_allow_null = scripting_data or False, actual_size = True))},")
        script_db_state_tables.write(f"{align}{quote_str_or_null(get_col_sql(sys_cols_row=row, table_schema = row['table_schema'], table_name = row['table_name'], script_state = DBEntScriptState.Alter, db_type = DBType.PostgreSQL, column_identity =False, force_allow_null = False, actual_size = True))},")
        script_db_state_tables.write(f"{alter_col}")
        
        if scripting_data:
            # Was the col NOT NULL to begin with?
            if row['is_nullable']:
                script_db_state_tables.write(f"{align},NULL")  # code for this field
            else:
                script_db_state_tables.write(f",{quote_str_or_null(get_col_sql(row, row['table_schema'], row['table_name'], DBEntScriptState.Alter, db_type, False, False, True))}")
        
        script_db_state_tables.write(f"{align});\n")
    
    # Now update state as against existing table
    script_db_state_tables.write(f"{align}\n")
    script_db_state_tables.write(f"{align}--columns only on Johannes database (need to add)\n")
    
    if db_type == DBType.MSSQL:
        script_db_state_tables.write(f"update {db_syntax.temp_table_prefix}ScriptCols set colStat = 1\n")
        script_db_state_tables.write(f"{align}from #ScriptCols J left join (select SCHEMA_NAME(o.schema_id) as table_schema, o.name as table_name, c.name as col_name from sys.tables O inner join sys.columns c on o.object_id=c.object_id) DB \n")
        script_db_state_tables.write(f"{align}on J.table_schema=DB.table_schema and J.table_name=DB.table_name and J.col_name=DB.col_name \n")
        script_db_state_tables.write(f"{align}where DB.col_name Is null; \n")
    elif db_type == DBType.PostgreSQL:
        script_db_state_tables.write(f"""UPDATE ScriptCols 
                                    SET colStat = 1
                                    WHERE NOT EXISTS (
                                        SELECT 1 
                                        FROM information_schema.tables t 
                                        INNER JOIN information_schema.columns c 
                                            ON t.table_schema = c.table_schema 
                                            AND t.table_name = c.table_name 
                                        WHERE t.table_schema NOT IN ('information_schema', 'pg_catalog') 
                                        AND t.table_schema NOT LIKE 'pg_temp%'  
                                        AND t.table_type LIKE '%TABLE%'
                                        AND LOWER(t.table_schema) = LOWER(ScriptCols.table_schema) 
                                        AND LOWER(t.table_name) = LOWER(ScriptCols.table_name) 
                                        AND LOWER(c.column_name) = LOWER(ScriptCols.col_name)
                                    );""")
        
    script_db_state_tables.write(f"{align}\n")
    
    # Generate columns only on DB (need to drop)
    if overall_table_schema_name_in_scripting:
        script_db_state_tables.write(f"{align}--columns only on DB (need to drop)\n")
        script_db_state_tables.write(f"INSERT INTO {db_syntax.temp_table_prefix}ScriptCols (table_schema, table_name, col_name, colStat, SQL_DROP) \n")
        
        if db_type == DBType.MSSQL:
            script_db_state_tables.write(f"{align}SELECT  DB.table_schema, DB.table_name, DB.col_name, 2, 'ALTER TABLE ['+DB.table_schema+'].['+DB.table_name+'] DROP COLUMN [' +DB.col_name+'];' \n")
            script_db_state_tables.write(f"{align}FROM    #ScriptCols J \n")
            script_db_state_tables.write(f"{align}RIGHT JOIN ( SELECT SCHEMA_NAME(o.schema_id) AS table_schema, o.name AS table_name, c.name AS col_name \n")
            script_db_state_tables.write(f"{align}FROM   sys.tables O \n")
            script_db_state_tables.write(f"{align}INNER JOIN sys.columns c ON o.object_id = c.object_id \n")
            script_db_state_tables.write(f"WHERE  SCHEMA_NAME(o.schema_id) + o.name IN ({overall_table_schema_name_in_scripting}) \n")
            script_db_state_tables.write(f"{align}) DB ON J.table_schema = DB.table_schema \n")
            script_db_state_tables.write(f"{align}AND J.table_name = DB.table_name \n")
            script_db_state_tables.write(f"{align}AND J.col_name = DB.col_name \n")
            script_db_state_tables.write(f"{align}WHERE ( J.col_name IS NULL );  \n")
        elif db_type == DBType.PostgreSQL:
            script_db_state_tables.write(f"{align}SELECT  DB.table_schema, DB.table_name, DB.column_name, 2, 'ALTER TABLE ' || DB.table_schema || '.' || DB.table_name || ' DROP COLUMN ' || DB.column_name || ';' \n")
            script_db_state_tables.write(f"{align}FROM    ScriptCols J \n")
            script_db_state_tables.write(f"{align}RIGHT JOIN ( select t.table_schema, t.table_name, c.column_name FROM information_schema.tables t INNER JOIN information_schema.columns c on t.table_schema=c.table_schema and t.table_name=c.table_name WHERE t.table_schema not in ('information_schema', 'pg_catalog') AND t.table_schema NOT LIKE 'pg_temp%'  and t.table_type LIKE '%TABLE%' \n")
            script_db_state_tables.write(f"AND C.table_schema || C.table_name IN ({overall_table_schema_name_in_scripting}) \n")
            script_db_state_tables.write(f"{align}) DB ON LOWER(J.table_schema) = LOWER(DB.table_schema) \n")
            script_db_state_tables.write(f"{align}And LOWER(J.table_name) = LOWER(DB.table_name) \n")
            script_db_state_tables.write(f"{align}And LOWER(J.col_name) = LOWER(DB.column_name) \n")
            script_db_state_tables.write(f"{align}WHERE ( J.col_name Is NULL );  \n")
    
    # Write updates of flags section
    script_db_state_tables.write(f"{align}\n\n")
    script_db_state_tables.write(f"{align}---updates Of flags--------------------\n")
    script_db_state_tables.write(f"{align}\n")
    
    # System type name
    script_db_state_tables.write(f"{align}--system type name \n")
    if db_type == DBType.MSSQL:
        script_db_state_tables.write(f"update {db_syntax.temp_table_prefix}ScriptCols Set user_type_name_diff = 1, colStat = 3, user_type_name_db=DB.user_type_name, \n")
        script_db_state_tables.write(f"{align}\tdiff_descr = Case When diff_descr Is NULL Then '' \n")
        script_db_state_tables.write(f"{align}\t\tELSE diff_descr + ', ' \n")
        script_db_state_tables.write(f"{align}\tEND + 'user_type_name is ' \n")
        script_db_state_tables.write(f"{align}\t+ CAST(DB.user_type_name AS VARCHAR(10)) + ', should be ' \n")
        script_db_state_tables.write(f"{align}\t+ CAST(J.user_type_name AS VARCHAR(10)) \n")
        script_db_state_tables.write(f"{align}from #ScriptCols J INNER join (select COALESCE(TYPE_NAME(c.user_type_id), TYPE_NAME(c.system_type_id)) as user_type_name, SCHEMA_NAME(o.schema_id) as table_schema, o.name as table_name, c.name as col_name from sys.tables O inner join sys.columns c on o.object_id=c.object_id) DB  \n")
        script_db_state_tables.write(f"{align}on J.table_schema=DB.table_schema and J.table_name=DB.table_name and J.col_name=DB.col_name \n")
        script_db_state_tables.write(f"{align}where J.user_type_name <> DB.user_type_name; \n")
    elif db_type == DBType.PostgreSQL:
        script_db_state_tables.write(f"update {db_syntax.temp_table_prefix}ScriptCols Set user_type_name_diff=true, colStat = 3, user_type_name_db=DB.user_type_name, \n")
        script_db_state_tables.write(f"{align}\tdiff_descr = Case When j.diff_descr Is NULL Then '' \n")
        script_db_state_tables.write(f"{align}\t\tELSE j.diff_descr || ', ' \n")
        script_db_state_tables.write(f"{align}\tEND || 'user_type_name is ' \n")
        script_db_state_tables.write(f"{align}\t || CAST(DB.user_type_name AS {db_syntax.nvarchar_type}(10)) || ', should be ' \n")
        script_db_state_tables.write(f"{align}\t || CAST(J.user_type_name AS {db_syntax.nvarchar_type}(10)) \n")
        script_db_state_tables.write(f"from {db_syntax.temp_table_prefix}ScriptCols J INNER join (select t.table_schema, t.table_name, c.column_name, c.udt_name as user_type_name \n")
        script_db_state_tables.write(f"{align}from information_schema.columns C INNER JOIN information_schema.tables T on c.table_schema=t.table_schema and c.table_name=t.table_name \n")
        script_db_state_tables.write(f"{align}where C.TABLE_SCHEMA not in ('information_schema', 'pg_catalog') and t.table_type LIKE '%TABLE%') DB  \n")
        script_db_state_tables.write(f"{align}on LOWER(J.table_schema) = LOWER(DB.table_schema) and LOWER(J.table_name) = LOWER(DB.table_name) and LOWER(J.col_name) = LOWER(DB.column_name) \n")
        script_db_state_tables.write(f"{align}where J.user_type_name <> DB.user_type_name \n")
        script_db_state_tables.write(f"{align}AND (ScriptCols.table_schema = j.table_schema AND ScriptCols.table_name = j.table_name AND ScriptCols.col_name = j.col_name);\n")
    
    # Max length (continued)
    if db_type == DBType.MSSQL:
        script_db_state_tables.write(f"{align}from #ScriptCols J INNER join (select CASE type_name(c.system_type_id) \n")
        script_db_state_tables.write(f"{align}WHEN 'nchar' \n")
        script_db_state_tables.write(f"{align}THEN c.max_length/2 \n")
        script_db_state_tables.write(f"{align}WHEN 'nvarchar' \n")
        script_db_state_tables.write(f"{align}THEN c.max_length/2 \n")
        script_db_state_tables.write(f"{align}ELSE c.max_length \n")
        script_db_state_tables.write(f"{align}END as max_length, SCHEMA_NAME(o.schema_id) as table_schema, o.name as table_name, c.name as col_name from sys.tables O inner join sys.columns c on o.object_id=c.object_id) DB  \n")
        script_db_state_tables.write(f"{align}on J.table_schema=DB.table_schema and J.table_name=DB.table_name and J.col_name=DB.col_name \n")
        script_db_state_tables.write(f"{align}where J.max_length <> DB.max_length;\n")
    elif db_type == DBType.PostgreSQL:
        script_db_state_tables.write(f"update {db_syntax.temp_table_prefix}ScriptCols Set max_length_diff = true, colStat = 3, max_length_db=DB.CHARACTER_MAXIMUM_LENGTH, \n")
        script_db_state_tables.write(f"{align}\tdiff_descr = Case When j.diff_descr Is NULL Then '' \n")
        script_db_state_tables.write(f"{align}\t\tELSE j.diff_descr || ', ' \n")
        script_db_state_tables.write(f"{align}\tEND || 'max_length is ' \n")
        script_db_state_tables.write(f"{align}\t || CAST(DB.CHARACTER_MAXIMUM_LENGTH AS {db_syntax.nvarchar_type}(10)) || ', should be ' \n")
        script_db_state_tables.write(f"{align}\t || CAST(J.max_length AS {db_syntax.nvarchar_type}(10)) \n")
        script_db_state_tables.write(f"from {db_syntax.temp_table_prefix}ScriptCols J INNER join (select t.table_schema, t.table_name, c.column_name, c.CHARACTER_MAXIMUM_LENGTH \n")
        script_db_state_tables.write(f"{align}from information_schema.columns C INNER JOIN information_schema.tables T on c.table_schema=t.table_schema and c.table_name=t.table_name \n")
        script_db_state_tables.write(f"{align}where C.TABLE_SCHEMA not in ('information_schema', 'pg_catalog') and t.table_type LIKE '%TABLE%') DB  \n")
        script_db_state_tables.write(f"{align}on LOWER(J.table_schema) = LOWER(DB.table_schema) and LOWER(J.table_name) = LOWER(DB.table_name) and LOWER(J.col_name) = LOWER(DB.column_name) \n")
        script_db_state_tables.write(f"{align}where J.max_length <> DB.CHARACTER_MAXIMUM_LENGTH \n")
        script_db_state_tables.write(f"{align}AND ( LOWER(ScriptCols.table_schema) = LOWER(j.table_schema) AND LOWER(ScriptCols.table_name) = LOWER(j.table_name) AND LOWER(ScriptCols.col_name) = LOWER(j.col_name) );\n")
    
    # Precision
    script_db_state_tables.write(f"{align}\n")
    script_db_state_tables.write(f"{align}--precision \n")
    if db_type == DBType.MSSQL:
        script_db_state_tables.write(f"update {db_syntax.temp_table_prefix}ScriptCols SET precision_diff = 1, colStat = 3, precision_db=DB.precision, \n")
        script_db_state_tables.write(f"{align}\tdiff_descr = CASE WHEN diff_descr IS NULL THEN '' \n")
        script_db_state_tables.write(f"{align}\t\tELSE diff_descr + ', ' \n")
        script_db_state_tables.write(f"{align}\tEND + 'precision is ' \n")
        script_db_state_tables.write(f"{align}\t+ CAST(DB.precision AS VARCHAR(10)) + ', should be ' \n")
        script_db_state_tables.write(f"{align}\t+ CAST(J.precision AS VARCHAR(10)) \n")
        script_db_state_tables.write(f"{align}from #ScriptCols J INNER join (select precision, SCHEMA_NAME(o.schema_id) as table_schema, o.name as table_name, c.name as col_name from sys.tables O inner join sys.columns c on o.object_id=c.object_id) DB  \n")
        script_db_state_tables.write(f"{align}on J.table_schema=DB.table_schema and J.table_name=DB.table_name and J.col_name=DB.col_name \n")
        script_db_state_tables.write(f"{align}where J.precision <> DB.precision; \n")
    elif db_type == DBType.PostgreSQL:
        script_db_state_tables.write(f"update {db_syntax.temp_table_prefix}ScriptCols Set max_length_diff = true, colStat = 3, precision_db=DB.precision, \n")
        script_db_state_tables.write(f"{align}\tdiff_descr = Case When j.diff_descr Is NULL Then '' \n")
        script_db_state_tables.write(f"{align}\t\tELSE j.diff_descr || ', ' \n")
        script_db_state_tables.write(f"{align}\tEND || 'precision is ' \n")
        script_db_state_tables.write(f"{align}\t || CAST(DB.precision AS {db_syntax.nvarchar_type}(10)) || ', should be ' \n")
        script_db_state_tables.write(f"{align}\t || CAST(J.precision AS {db_syntax.nvarchar_type}(10)) \n")
        script_db_state_tables.write(f"from {db_syntax.temp_table_prefix}ScriptCols J INNER join (select t.table_schema, t.table_name, c.column_name, c.numeric_precision AS precision \n")
        script_db_state_tables.write(f"{align}from information_schema.columns C INNER JOIN information_schema.tables T on c.table_schema=t.table_schema and c.table_name=t.table_name \n")
        script_db_state_tables.write(f"{align}where C.TABLE_SCHEMA not in ('information_schema', 'pg_catalog') and t.table_type LIKE '%TABLE%') DB  \n")
        script_db_state_tables.write(f"{align}on LOWER(J.table_schema) = LOWER(DB.table_schema) and LOWER(J.table_name) = LOWER(DB.table_name) and LOWER(J.col_name) = LOWER(DB.column_name) \n")
        script_db_state_tables.write(f"{align}where J.precision <> DB.precision \n")
        script_db_state_tables.write(f"{align}AND ( LOWER(ScriptCols.table_schema) = LOWER(j.table_schema) AND LOWER(ScriptCols.table_name) = LOWER(j.table_name) AND LOWER(ScriptCols.col_name) = LOWER(j.col_name) );\n")
    
    # Scale
    script_db_state_tables.write(f"{align}\n")
    script_db_state_tables.write(f"{align}--scale \n")
    if db_type == DBType.MSSQL:
        script_db_state_tables.write(f"update {db_syntax.temp_table_prefix}ScriptCols SET scale_diff=1, colStat=3, scale_db=DB.scale, \n")
        script_db_state_tables.write(f"{align}\tdiff_descr = CASE WHEN diff_descr IS NULL THEN '' \n")
        script_db_state_tables.write(f"{align}\t\tELSE diff_descr + ', ' \n")
        script_db_state_tables.write(f"{align}\tEND + 'scale is ' \n")
        script_db_state_tables.write(f"{align}\t+ CAST(DB.scale AS VARCHAR(10)) + ', should be ' \n")
        script_db_state_tables.write(f"{align}\t+ CAST(J.scale AS VARCHAR(10)) \n")
        script_db_state_tables.write(f"{align}from #ScriptCols J INNER join (select scale, SCHEMA_NAME(o.schema_id) as table_schema, o.name as table_name, c.name as col_name from sys.tables O inner join sys.columns c on o.object_id=c.object_id) DB  \n")
        script_db_state_tables.write(f"{align}on J.table_schema=DB.table_schema and J.table_name=DB.table_name and J.col_name=DB.col_name \n")
        script_db_state_tables.write(f"{align}where J.scale <> DB.scale; \n")
    elif db_type == DBType.PostgreSQL:
        script_db_state_tables.write(f"update {db_syntax.temp_table_prefix}ScriptCols Set max_length_diff = true, colStat = 3, scale_db=DB.scale, \n")
        script_db_state_tables.write(f"{align}\tdiff_descr = Case When j.diff_descr Is NULL Then '' \n")
        script_db_state_tables.write(f"{align}\t\tELSE j.diff_descr || ', ' \n")
        script_db_state_tables.write(f"{align}\tEND || 'scale is ' \n")
        script_db_state_tables.write(f"{align}\t || CAST(DB.scale AS {db_syntax.nvarchar_type}(10)) || ', should be ' \n")
        script_db_state_tables.write(f"{align}\t || CAST(J.scale AS {db_syntax.nvarchar_type}(10)) \n")
        script_db_state_tables.write(f"from {db_syntax.temp_table_prefix}ScriptCols J INNER join (select t.table_schema, t.table_name, c.column_name, c.numeric_scale AS scale \n")
        script_db_state_tables.write(f"{align}from information_schema.columns C INNER JOIN information_schema.tables T on c.table_schema=t.table_schema and c.table_name=t.table_name \n")
        script_db_state_tables.write(f"{align}where C.TABLE_SCHEMA not in ('information_schema', 'pg_catalog') and t.table_type LIKE '%TABLE%') DB  \n")
        script_db_state_tables.write(f"{align}on LOWER(J.table_schema) = LOWER(DB.table_schema) and LOWER(J.table_name) = LOWER(DB.table_name) and LOWER(J.col_name) = LOWER(DB.column_name) \n")
        script_db_state_tables.write(f"{align}where J.scale <> DB.scale \n")
        script_db_state_tables.write(f"{align}AND ( LOWER(ScriptCols.table_schema) = LOWER(j.table_schema) AND LOWER(ScriptCols.table_name) = LOWER(j.table_name) AND LOWER(ScriptCols.col_name) = LOWER(j.col_name));\n")
    
    # Is_nullable
    script_db_state_tables.write(f"{align}\n")
    script_db_state_tables.write(f"{align}--is_nullable \n")
    if db_type == DBType.MSSQL:
        script_db_state_tables.write(f"update {db_syntax.temp_table_prefix}ScriptCols SET is_nullable_diff=1, colStat=3, is_nullable_db=DB.is_nullable, \n")
        script_db_state_tables.write(f"{align}\tdiff_descr = CASE WHEN diff_descr IS NULL THEN '' \n")
        script_db_state_tables.write(f"{align}\t\tELSE diff_descr + ', ' \n")
        script_db_state_tables.write(f"{align}\tEND + 'is_nullable is ' \n")
        script_db_state_tables.write(f"{align}\t+ CAST(DB.is_nullable AS VARCHAR(10)) + ', should not be ' \n")
        script_db_state_tables.write(f"{align}from #ScriptCols J INNER join (select is_nullable, SCHEMA_NAME(o.schema_id) as table_schema, o.name as table_name, c.name as col_name from sys.tables O inner join sys.columns c on o.object_id=c.object_id) DB  \n")
        script_db_state_tables.write(f"{align}on J.table_schema=DB.table_schema and J.table_name=DB.table_name and J.col_name=DB.col_name \n")
        script_db_state_tables.write(f"{align}where J.is_nullable <> DB.is_nullable; \n")
    elif db_type == DBType.PostgreSQL:
        script_db_state_tables.write(f"update {db_syntax.temp_table_prefix}ScriptCols Set max_length_diff = true, colStat = 3, is_nullable_db=DB.is_nullable, \n")
        script_db_state_tables.write(f"{align}\tdiff_descr = Case When j.diff_descr Is NULL Then '' \n")
        script_db_state_tables.write(f"{align}\t\tELSE j.diff_descr || ', ' \n")
        script_db_state_tables.write(f"{align}\tEND || 'is_nullable is ' \n")
        script_db_state_tables.write(f"{align}\t || CAST(DB.is_nullable AS {db_syntax.nvarchar_type}(10)) || ', should be ' \n")
        script_db_state_tables.write(f"{align}\t || CAST(J.is_nullable AS {db_syntax.nvarchar_type}(10)) \n")
        script_db_state_tables.write(f"from {db_syntax.temp_table_prefix}ScriptCols J INNER join (select t.table_schema, t.table_name, c.column_name, case WHEN c.IS_NULLABLE = 'YES' then CAST(1 AS BOOLEAN) WHEN c.IS_NULLABLE = 'NO' then CAST(0 AS BOOLEAN) END AS is_nullable \n")
        script_db_state_tables.write(f"{align}from information_schema.columns C INNER JOIN information_schema.tables T on c.table_schema=t.table_schema and c.table_name=t.table_name \n")
        script_db_state_tables.write(f"{align}where C.TABLE_SCHEMA not in ('information_schema', 'pg_catalog') and t.table_type LIKE '%TABLE%') DB  \n")
        script_db_state_tables.write(f"{align}on LOWER(J.table_schema) = LOWER(DB.table_schema) and LOWER(J.table_name) = LOWER(DB.table_name) and LOWER(J.col_name) = LOWER(DB.column_name) \n")
        script_db_state_tables.write(f"{align}where J.is_nullable <> DB.is_nullable \n")
        script_db_state_tables.write(f"{align}AND ( LOWER(ScriptCols.table_schema) = LOWER(j.table_schema) AND LOWER(ScriptCols.table_name) = LOWER(j.table_name) AND LOWER(ScriptCols.col_name) = LOWER(j.col_name) );\n")
    
    # Is_identity
    script_db_state_tables.write(f"{align}\n")
    script_db_state_tables.write(f"{align}--is_identity \n")
    if db_type == DBType.MSSQL:
        script_db_state_tables.write(f"update {db_syntax.temp_table_prefix}ScriptCols SET is_identity_diff=1, colStat=3, \n")
        script_db_state_tables.write(f"{align}\tdiff_descr = CASE WHEN diff_descr IS NULL THEN '' \n")
        script_db_state_tables.write(f"{align}\t\tELSE diff_descr + ', ' \n")
        script_db_state_tables.write(f"{align}\tEND + 'is_identity is ' \n")
        script_db_state_tables.write(f"{align}\t+ CAST(DB.is_identity AS VARCHAR(10)) + ', should not be ' \n")
        script_db_state_tables.write(f"{align}from #ScriptCols J INNER join (select is_identity, SCHEMA_NAME(o.schema_id) as table_schema, o.name as table_name, c.name as col_name from sys.tables O inner join sys.columns c on o.object_id=c.object_id) DB  \n")
        script_db_state_tables.write(f"{align}on J.table_schema=DB.table_schema and J.table_name=DB.table_name and J.col_name=DB.col_name \n")
        script_db_state_tables.write(f"{align}where J.is_identity <> DB.is_identity;\n")
    elif db_type == DBType.PostgreSQL:
        script_db_state_tables.write(f"update {db_syntax.temp_table_prefix}ScriptCols Set max_length_diff = true, colStat = 3, is_identity_db=DB.is_identity, \n")
        script_db_state_tables.write(f"{align}\tdiff_descr = Case When j.diff_descr Is NULL Then '' \n")
        script_db_state_tables.write(f"{align}\t\tELSE j.diff_descr || ', ' \n")
        script_db_state_tables.write(f"{align}\tEND || 'is_identity is ' \n")
        script_db_state_tables.write(f"{align}\t || CAST(DB.is_identity AS {db_syntax.nvarchar_type}(10)) || ', should be ' \n")
        script_db_state_tables.write(f"{align}\t || CAST(J.is_identity AS {db_syntax.nvarchar_type}(10)) \n")
        script_db_state_tables.write(f"from {db_syntax.temp_table_prefix}ScriptCols J INNER join (select t.table_schema, t.table_name, c.column_name, case WHEN c.IS_IDENTITY = 'YES' then CAST(1 AS BOOLEAN)  WHEN c.IS_IDENTITY = 'NO' then CAST(0 AS BOOLEAN)  END AS is_identity \n")
        script_db_state_tables.write(f"{align}from information_schema.columns C INNER JOIN information_schema.tables T on c.table_schema=t.table_schema and c.table_name=t.table_name \n")
        script_db_state_tables.write(f"{align}where C.TABLE_SCHEMA not in ('information_schema', 'pg_catalog') and t.table_type LIKE '%TABLE%') DB  \n")
        script_db_state_tables.write(f"{align}on LOWER(J.table_schema) = LOWER(DB.table_schema) and LOWER(J.table_name) = LOWER(DB.table_name) and LOWER(J.col_name) = LOWER(DB.column_name) \n")
        script_db_state_tables.write(f"{align}where J.is_identity <> DB.is_identity \n")
        script_db_state_tables.write(f"{align}AND ( LOWER(ScriptCols.table_schema) = LOWER(j.table_schema) AND LOWER(ScriptCols.table_name) = LOWER(j.table_name) AND LOWER(ScriptCols.col_name) = LOWER(j.col_name) );\n")
    
    # Is_computed
    script_db_state_tables.write(f"{align}\n")
    if db_type == DBType.MSSQL:
        script_db_state_tables.write(f"{align}--is_computed \n")
        script_db_state_tables.write(f"update {db_syntax.temp_table_prefix}ScriptCols SET is_computed_diff=1, colStat=3, \n")
        script_db_state_tables.write(f"{align}\tdiff_descr = CASE WHEN diff_descr IS NULL THEN '' \n")
        script_db_state_tables.write(f"{align}\t\tELSE diff_descr + ', ' \n")
        script_db_state_tables.write(f"{align}\tEND + 'is_computed is ' \n")
        script_db_state_tables.write(f"{align}\t+ CAST(DB.is_computed AS VARCHAR(10)) + ', should not be ' \n")
        script_db_state_tables.write(f"{align}from #ScriptCols J INNER join (select is_computed, SCHEMA_NAME(o.schema_id) as table_schema, o.name as table_name, c.name as col_name from sys.tables O inner join sys.columns c on o.object_id=c.object_id) DB  \n")
        script_db_state_tables.write(f"{align}on J.table_schema=DB.table_schema and J.table_name=DB.table_name and J.col_name=DB.col_name \n")
        script_db_state_tables.write(f"{align}where J.is_computed <> DB.is_computed; \n")
    
    # Collation_name
    script_db_state_tables.write(f"{align}\n")
    if db_type == DBType.MSSQL:
        script_db_state_tables.write(f"{align}--collation_name \n")
        script_db_state_tables.write(f"update {db_syntax.temp_table_prefix}ScriptCols SET collation_name_diff=1, colStat=3, collation_name_db=DB.collation_name, \n")
        script_db_state_tables.write(f"{align}\tdiff_descr = CASE WHEN diff_descr IS NULL THEN '' \n")
        script_db_state_tables.write(f"{align}\t\tELSE diff_descr + ', ' \n")
        script_db_state_tables.write(f"{align}\tEND + 'collation_name is ' \n")
        script_db_state_tables.write(f"{align}\t+ CAST(DB.collation_name AS NVARCHAR(max)) + ', should be ' \n")
        script_db_state_tables.write(f"{align}\t+ CAST(J.collation_name AS NVARCHAR(max)) \n")
        script_db_state_tables.write(f"{align}from #ScriptCols J INNER join (select collation_name, SCHEMA_NAME(o.schema_id) as table_schema, o.name as table_name, c.name as col_name from sys.tables O inner join sys.columns c on o.object_id=c.object_id) DB  \n")
        script_db_state_tables.write(f"{align}on J.table_schema=DB.table_schema and J.table_name=DB.table_name and J.col_name=DB.col_name \n")
        script_db_state_tables.write(f"{align}where J.collation_name <> DB.collation_name; \n")
    
    # Computed_definition
    script_db_state_tables.write(f"{align}\n")    
    if db_type == DBType.MSSQL:
        script_db_state_tables.write(f"{align}--computed_definition \n")
        script_db_state_tables.write(f"update {db_syntax.temp_table_prefix}ScriptCols SET computed_definition_diff=1, colStat=3, computed_definition_db=DB.computed_definition, \n")
        script_db_state_tables.write(f"{align}\tdiff_descr = CASE WHEN diff_descr IS NULL THEN '' \n")
        script_db_state_tables.write(f"{align}\t\tELSE diff_descr + ', ' \n")
        script_db_state_tables.write(f"{align}\tEND + 'computed_definition is ' \n")
        script_db_state_tables.write(f"{align}\t+ CAST(DB.computed_definition AS NVARCHAR(max)) + ', should be ' \n")
        script_db_state_tables.write(f"{align}\t+ CAST(J.computed_definition AS NVARCHAR(max)) \n")
        script_db_state_tables.write(f"from {db_syntax.temp_table_prefix}ScriptCols J INNER join (select cc.definition as computed_definition, SCHEMA_NAME(o.schema_id) as table_schema, o.name as table_name, c.name as col_name from sys.tables O inner join sys.columns c on o.object_id=c.object_id LEFT JOIN sys.computed_columns cc on c.object_id=cc.object_id AND c.column_id=cc.column_id) DB  \n")
        script_db_state_tables.write(f"{align}on J.table_schema=DB.table_schema and J.table_name=DB.table_name and J.col_name=DB.col_name \n")
        script_db_state_tables.write(f"{align}where J.computed_definition <> DB.computed_definition; \n")
    
    # Update tables where columns are different
    script_db_state_tables.write(f"{align}\n\n")
    script_db_state_tables.write(f"{align}--update tables where columns are different\n")
    script_db_state_tables.write(f"UPDATE {db_syntax.temp_table_prefix}ScriptTables SET tableStat=3 \n")
    script_db_state_tables.write(f"FROM {db_syntax.temp_table_prefix}ScriptCols C \n")
    script_db_state_tables.write(f"WHERE LOWER({db_syntax.temp_table_prefix}ScriptTables.table_schema) = LOWER(C.table_schema) \n")
    script_db_state_tables.write(f"  AND LOWER({db_syntax.temp_table_prefix}ScriptTables.table_name) = LOWER(C.table_name) \n")
    script_db_state_tables.write(f"  AND C.colStat IN (1,2,3) \n")
    script_db_state_tables.write(f"  AND ({db_syntax.temp_table_prefix}ScriptTables.tableStat NOT IN (1,2) OR {db_syntax.temp_table_prefix}ScriptTables.tableStat IS NULL); --extra, missing, or different \n")

    # Wherever got columns different, mark the tables as different
    script_db_state_tables.write(f"{align}\n")
    script_db_state_tables.write(f"{align}--wherever got columns different, mark the tables as different\n")
    script_db_state_tables.write(f"UPDATE {db_syntax.temp_table_prefix}ScriptTables SET col_diff={db_syntax.boolean_true_value}\n")
    script_db_state_tables.write(f"FROM {db_syntax.temp_table_prefix}ScriptCols C \n")
    script_db_state_tables.write(f"WHERE LOWER({db_syntax.temp_table_prefix}ScriptTables.table_schema) = LOWER(C.table_schema) \n")
    script_db_state_tables.write(f"  AND LOWER({db_syntax.temp_table_prefix}ScriptTables.table_name) = LOWER(C.table_name) \n")
    script_db_state_tables.write(f"  AND C.ColStat IS NOT NULL \n")
    script_db_state_tables.write(f"  AND ({db_syntax.temp_table_prefix}ScriptTables.tableStat NOT IN (1,2) OR {db_syntax.temp_table_prefix}ScriptTables.tableStat IS NULL);\n")
    script_db_state_tables.write(f"{align}\n")

    return script_db_state_tables


