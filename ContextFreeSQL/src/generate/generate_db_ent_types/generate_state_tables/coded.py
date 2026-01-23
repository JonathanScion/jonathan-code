from enum import Enum
from typing import Optional, Dict, List
from dataclasses import dataclass
import pandas as pd
from io import StringIO

from src.defs.script_defs import DBType, DBSyntax, ScriptingOptions
from src.data_load.from_db.load_from_db_pg import DBSchema
from src.utils.funcs import quote_str_or_null, add_print

def create_db_state_temp_tables_for_coded(
    db_type: DBType,
    tbl_ents: pd.DataFrame,
    script_ops: ScriptingOptions,
    schema_tables: DBSchema,
) -> StringIO:

    # Initialize script builder
    script_builder = StringIO()

    # Prepare lists of entities we're working with
    coded_schema_name_in = []

    # Filter entities for scripting (non-Table types)
    coded_script_rows = tbl_ents[
            (tbl_ents['scriptschema'] == True) &
            (tbl_ents['enttype'] != 'Table')
    ]

    # Build schema.name list for SQL IN clause
    for _, row in coded_script_rows.iterrows():
        coded_schema_name_in.append(f"'{row['entschema']}.{row['entname']}'")


    # Combine both lists for output
    output_coded_schema_name_in = ','.join(coded_schema_name_in)

    # Exit if nothing to do and not removing all extra entities
    # Note: We still need to create the table if remove_all_extra_ents is true,
    # because generate_coded_ents will query it to find extras to drop
    if len(coded_schema_name_in) == 0 and not script_ops.remove_all_extra_ents:
        return script_builder
    
    # Start building script
    script_builder.write("--DB State Temp Tables for Codes\n")
    
    # Get database syntax
    db_syntax = DBSyntax.get_syntax(db_type)
    
    # Script to retrieve coded entities
    coded_ents = None
    
    # Add header to script
    script_builder.write("--Code Entities\n")
    
    # DB-specific setup
    if db_type == DBType.PostgreSQL:
        script_builder.write("BEGIN --coded entities\n")
    align = "\t" * 1  # 2, for now
    
    # Drop table if exists logic
    if db_type == DBType.MSSQL:
        script_builder.write("""IF (OBJECT_ID('tempdb..#ScriptCode') IS NOT NULL) 
BEGIN
\tDROP TABLE #ScriptCode;
END;
""")
    else:  # PostgreSQL
        script_builder.write(f"""{align}perform n.nspname, c.relname
{align}FROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
{align}WHERE n.nspname like 'pg_temp_%' AND c.relname='scriptcode' AND pg_catalog.pg_table_is_visible(c.oid);
{align}IF FOUND THEN
{align}\tDROP TABLE ScriptCode;
{align}END IF;
""")
    
    # Create ScriptCode table
    create_table_script = f"""
{align}{db_syntax.temp_table_create}ScriptCode
{align}(
{align}\tent_schema {db_syntax.nvarchar_type} (128) not null,
{align}\tent_name {db_syntax.nvarchar_type} (128) not null,
{align}\tent_type {db_syntax.nvarchar_type} (25) null,
{align}\tent_type_pg {db_syntax.nvarchar_type} (25) null,
{align}\tSQL_CREATE {db_syntax.nvarchar_type} {db_syntax.max_length_str} null,
{align}\tSQL_DROP {db_syntax.nvarchar_type} {db_syntax.max_length_str} null,
"""
    
    # Add param_type_list for PostgreSQL
    if db_type == DBType.PostgreSQL:
        create_table_script += f"{align}\tparam_type_list {db_syntax.nvarchar_type} {db_syntax.max_length_str} null,\n"
    
    create_table_script += f"{align}\tcodeStat smallint null\n);\n\n"
    script_builder.write(create_table_script)
    
    # Process entities for scripting
    tbl_ents_coded = tbl_ents[
        (tbl_ents['enttype'] != 'Table') & 
        (tbl_ents['scriptschema'] == True)
    ]
    
    if not tbl_ents_coded.empty:
        script_builder.write(f"{align}--Fill it with code entities\n")
    
    coded_ents=schema_tables.coded_ents    
    # For each entity, get CREATE/DROP SQL and add to script
    for _, ent_row in tbl_ents_coded.iterrows():
        create_ent = None
        
        # Find matching coded entity
        if db_type == DBType.PostgreSQL:
            select_cond = (
                (coded_ents['code_schema'] == ent_row['entschema']) & 
                (coded_ents['code_name'] == ent_row['entname'])
            )
            
            # Add param list condition
            if pd.isna(ent_row['entparamlist']) or ent_row['entparamlist'] == '':
                select_cond = select_cond & (
                    pd.isna(coded_ents['param_type_list']) | 
                    (coded_ents['param_type_list'] == '')
                )
            else:
                select_cond = select_cond & (
                    coded_ents['param_type_list'] == ent_row['entparamlist']
                )
            
            matching_rows = coded_ents[select_cond]
        else:
            matching_rows = coded_ents[
                (coded_ents['code_schema'] == ent_row['entschema']) & 
                (coded_ents['code_name'] == ent_row['entname'])
            ]
        
        if len(matching_rows) == 1:
            create_ent = matching_rows.iloc[0]['definition']
        
        # Format entity name based on DB type
        ent_full_name = f"{ent_row['entschema']}.{ent_row['entname']}"
        
        # Skip if no creation code found
        if not create_ent:
            add_print(db_type, 1, script_builder, f"'Entity ''{ent_full_name}'' cannot be scripted. No code was found'")
            continue

        # Insert statement
        if db_type == DBType.PostgreSQL:
            script_builder.write(f"{align}INSERT INTO {db_syntax.temp_table_prefix}ScriptCode (ent_schema, ent_name, ent_type, SQL_CREATE, SQL_DROP, param_type_list)\n")
        else:
            script_builder.write(f"{align}INSERT INTO {db_syntax.temp_table_prefix}ScriptCode (ent_schema, ent_name, ent_type, SQL_CREATE, SQL_DROP)\n")

        # Entity schema and name
        script_builder.write(f"{align}\tVALUES ({quote_str_or_null(ent_row['entschema'])}, ")
        script_builder.write(f"{quote_str_or_null(ent_row['entname'])}, ")
        
        # Entity type
        if db_type == DBType.PostgreSQL:
            script_builder.write(f"{quote_str_or_null(matching_rows.iloc[0]['enttype_pg'])}, ")
        else:
            script_builder.write(f"{quote_str_or_null(ent_row['enttype'])}, ")
        
        # SQL CREATE
        script_builder.write(f"{quote_str_or_null(create_ent)}, ")
        
        # SQL DROP
        if db_type == DBType.MSSQL:
            script_builder.write(f"'DROP {ent_row['enttype']} [{ent_row['entschema']}].[{ent_row['entname']}];');\n")
        else:
            # For DROP, use entparamlisttypes (types only) for correct PostgreSQL syntax
            # e.g., DROP PROCEDURE name(integer) not DROP PROCEDURE name(IN studentid integer)
            param_list_types_str = ent_row['entparamlisttypes'] if not pd.isna(ent_row.get('entparamlisttypes')) else ''
            param_list_for_drop = f"({param_list_types_str})" if param_list_types_str else "()"
            # Keep full param list for matching/comparison
            param_list_str = ent_row['entparamlist'] if not pd.isna(ent_row['entparamlist']) else ''
            ent_param_list_val = f"'{param_list_str}'" if param_list_str else "''"
            script_builder.write(f"'DROP {ent_row['enttype']} {ent_row['entschema']}.{ent_row['entname']}{param_list_for_drop};', {ent_param_list_val});\n")
    
    # Update state against existing entities
    script_builder.write(f"{align}\n--Entities only On Johannes database (need To add)\n")
    script_builder.write(f"{align}update {db_syntax.temp_table_prefix}ScriptCode Set codeStat = 1\n")
    
    # DB-specific update logic
    if db_type == DBType.MSSQL:
        script_builder.write(f"""from {db_syntax.temp_table_prefix}ScriptCode J left join (Select SCHEMA_NAME(o.schema_id) As ent_schema, o.name As ent_name FROM sys.objects O WHERE o.type In ('FN','TF','IF','P','TR','V')) DB 
on J.ent_schema=DB.ent_schema AND J.ent_name = DB.ent_name 
where DB.ent_name Is null 
""")
    else:  # PostgreSQL
        script_builder.write(f"""{align}WHERE NOT EXISTS (
    {align}SELECT 1 
    {align}FROM (
        {align}\tSELECT v.table_schema || '.' || v.table_name AS "EntKey", 
               {align}\t\tv.table_schema as ent_schema, 
               {align}\t\tv.table_name as ent_name, 
               {align}\t\t'V' AS ent_type,
               {align}\t\t'' as param_type_list  
        {align}\tFROM information_schema.views v
        {align}\tWHERE v.table_schema NOT IN ('information_schema', 'pg_catalog')
        
        {align}UNION
        
        {align}SELECT n.nspname || '.' || p.proname AS "EntKey", 
               {align}\tn.nspname as ent_schema,
               {align}\tp.proname as ent_name,
               {align}\tCAST(p.prokind AS char) AS ent_type,
               {align}\tpg_get_function_arguments(p.oid) as param_type_list 
        {align}FROM pg_proc p 
        {align}\tLEFT JOIN pg_namespace n on p.pronamespace = n.oid
        {align}WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
        
        {align}UNION
        
        {align}SELECT t.trigger_schema || '.' || t.trigger_name AS "EntKey", 
               {align}\tt.trigger_schema As ent_schema,
               {align}\tt.trigger_name As ent_name,
               {align}\t'TR' AS ent_type, 
               {align}\t'' as param_type_list 
        {align}FROM information_schema.triggers t
        {align}GROUP BY 1, 2, 3, 4
    {align}) existing_entities
    {align}\tWHERE existing_entities.ent_schema = ScriptCode.ent_schema 
      {align}\t\tAND existing_entities.ent_name = ScriptCode.ent_name 
      {align}\t\tAND existing_entities.param_type_list = ScriptCode.param_type_list
{align});
""")
    
    # Add entities that need to be dropped (only when remove_all_extra_ents is enabled)
    if script_ops.remove_all_extra_ents:
        script_builder.write(f"{align}\n--Entities only on DB (need to drop)\n")
        
        if db_type == DBType.MSSQL:
            script_builder.write(f"""INSERT INTO {db_syntax.temp_table_prefix}ScriptCode (ent_schema, ent_name, ent_type, codeStat)
    SELECT DB.ent_schema, DB.ent_name, DB.ent_type, 2 
    FROM {db_syntax.temp_table_prefix}ScriptCode J 
    RIGHT JOIN (SELECT SCHEMA_NAME(o.schema_id) AS ent_schema, 
        o.name AS ent_name, 
        CASE o.type WHEN 'FN' THEN 'Function' WHEN 'TF' THEN 'Function' WHEN 'IF' THEN 'Function' WHEN 'P' THEN 'Procedure' WHEN 'TR' THEN 'Trigger' WHEN 'V' THEN 'View' END AS ent_type, '' as param_type_list 
        FROM sys.objects O WHERE O.type IN ('FN','TF','IF','P','TR','V') AND O.is_ms_shipped=0 
    ) DB ON J.ent_schema = DB.ent_schema 
    AND J.ent_name = DB.ent_name 
    WHERE J.ent_name Is NULL; 
    """)
        else:  # PostgreSQL
            script_builder.write(f"""{align}INSERT INTO {db_syntax.temp_table_prefix}ScriptCode (ent_schema, ent_name, ent_type, param_type_list, codeStat)
    SELECT DB.ent_schema, DB.ent_name, DB.ent_type, DB.param_type_list, 2 
    FROM {db_syntax.temp_table_prefix}ScriptCode J 
    RIGHT JOIN (Select v.table_schema || '.' || v.table_name AS EntKey, v.table_schema as ent_schema, v.table_name as ent_name, 'View' as ent_type, '' as param_type_list 
        From information_schema.views v
        Where v.table_schema Not In ('information_schema', 'pg_catalog')
        UNION
        Select n.nspname || '.' || p.proname AS EntKey, n.nspname as ent_schema,
        p.proname As ent_name,
        CASE 
            WHEN p.prokind ='p' THEN 'Procedure'
            ELSE 'Function'
        END enttype,
        pg_get_function_arguments(p.oid) as param_type_list 
        From pg_proc p 
        Left Join pg_namespace n on p.pronamespace = n.oid
        where n.nspname Not in ('pg_catalog', 'information_schema')
        UNION
        Select t.trigger_schema || '.' || t.trigger_name AS ent_type, t.trigger_schema As ent_schema,
        t.trigger_name As ent_name,
        'Trigger' as enttype, '' as param_type_list
        From information_schema.triggers t
        Group By 1, 2, 3, 4
    ) DB ON LOWER(J.ent_schema) = LOWER(DB.ent_schema) 
    AND LOWER(J.ent_name) = LOWER(DB.ent_name) 
    AND LOWER(J.param_type_list) = LOWER(DB.param_type_list) 
    WHERE J.ent_name Is NULL; 
    """)
    
    # Add check for entities which are different
    script_builder.write(f"\n{align}--Entities which are different\n")
    script_builder.write(f"{align}UPDATE {db_syntax.temp_table_prefix}ScriptCode Set codeStat = 3\n")
    
    if db_type == DBType.MSSQL:
        script_builder.write(f"""from {db_syntax.temp_table_prefix}ScriptCode J INNER JOIN 
(Select SCHEMA_NAME(o.schema_id) As ent_schema, o.name As ent_name, sm.definition 
FROM sys.objects O INNER JOIN sys.sql_modules sm On O.object_id= sm.object_id WHERE o.type In ('FN','TF','IF','P','TR','V')) DB 
on J.ent_schema=DB.ent_schema AND J.ent_name = DB.ent_name 
""")
        
        if script_ops.code_compare_no_whitespace:
            script_builder.write("WHERE LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(J.SQL_CREATE, CHAR(10), ''), CHAR(13), ''), CHAR(9), ''), CHAR(32), ''), CHAR(160), ''))) <>LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(DB.definition, CHAR(10), ''), CHAR(13), ''), CHAR(9), ''), CHAR(32), ''), CHAR(160), '')))  \n")
        else:
            script_builder.write("WHERE J.SQL_CREATE<>DB.definition \n")
    else:  # PostgreSQL
        script_builder.write(f"""FROM {db_syntax.temp_table_prefix}ScriptCode J INNER JOIN (
Select v.table_schema || '.' || v.table_name AS "EntKey", v.table_schema as ent_schema, v.table_name as ent_name, 'V' as "enttype", 
'CREATE OR REPLACE VIEW ' || v.table_schema || '.' || v.table_name || E'\\nAS\\n' || v.view_definition AS definition, 
'' as param_type_list 
From information_schema.views v
Where v.table_schema Not In ('information_schema', 'pg_catalog')
""")
        
        if coded_schema_name_in:
            script_builder.write(f"And ( (v.table_schema || '.' || v.table_name) IN ({','.join(coded_schema_name_in)}) ) \n")
        
        script_builder.write(f"""{align}UNION
{align}\tSelect n.nspname || '.' || p.proname  AS "EntKey", n.nspname as ent_schema,
{align}\tp.proname As ent_name,
{align}\tCAST(p.prokind As Char)  AS "enttype",
{align}\tcase when l.lanname = 'internal' then p.prosrc
{align}\telse pg_get_functiondef(p.oid)
{align}\tend as definition, 
{align}\tpg_get_function_arguments(p.oid) as param_type_list 
{align}\tFrom pg_proc p 
{align}\tLeft Join pg_namespace n on p.pronamespace = n.oid
{align}\tLeft Join pg_language l on p.prolang = l.oid 
{align}\tLeft Join pg_type t on t.oid = p.prorettype 
{align}\twhere n.nspname Not in ('pg_catalog', 'information_schema')
""")
        
        if coded_schema_name_in:
            script_builder.write(f"And ( (n.nspname || '.' || p.proname) IN ({','.join(coded_schema_name_in)}) ) \n")
        
        script_builder.write(f"""{align}UNION
{align}\tSelect t.trigger_schema || '.' || t.trigger_name AS "EntKey", t.trigger_schema As ent_schema,
{align}\tt.trigger_name As ent_name,
{align}\t'TR' as "enttype", t.action_statement As definition, '' as param_type_list 
{align}\tFrom information_schema.triggers t
""")
        
        if coded_schema_name_in:
            script_builder.write(f"WHERE ( (t.trigger_schema || '.' || t.trigger_name) IN ({','.join(coded_schema_name_in)}) ) \n")
        
        script_builder.write("Group By 1, 2, 3, 4, 5\n")
        script_builder.write(") DB On LOWER(J.ent_schema) = LOWER(DB.ent_schema) And LOWER(J.ent_name )= LOWER(DB.ent_name ) And LOWER(J.param_type_list) = LOWER(DB.param_type_list )\n")
        
        if script_ops.code_compare_no_whitespace:
            script_builder.write("WHERE regexp_replace(J.SQL_CREATE, '\\s', '', 'g')<>regexp_replace(DB.definition, '\\s', '', 'g') \n")
        else:
            script_builder.write("WHERE J.SQL_CREATE<>DB.definition \n")
        
        script_builder.write("AND (ScriptCode.ent_schema = J.ent_schema AND ScriptCode.ent_name = J.ent_name AND ScriptCode.param_type_list = J.param_type_list); --PG wants an explicit join of the updated table to its alias  \n")
    
    script_builder.write(f"\n{align}End; --coded entities\n")
    
    return script_builder




