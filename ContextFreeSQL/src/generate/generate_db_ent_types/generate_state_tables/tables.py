from enum import Enum
from typing import Optional, Dict, List
from dataclasses import dataclass
import pandas as pd
from io import StringIO
from src.defs.script_defs import DBType, DBSyntax, ScriptingOptions, ScriptTableOptions
from src.generate.generate_create_table import get_create_table_from_sys_tables
from src.data_load.from_db.load_from_db_pg import DBSchema
from src.utils.funcs import quote_str_or_null
from src.generate.generate_db_ent_types.generate_state_tables.tables_columns import create_db_state_columns
from src.generate.generate_db_ent_types.generate_state_tables.tables_indexes import create_db_state_indexes
from src.generate.generate_db_ent_types.generate_state_tables.tables_fks import create_db_state_fks

#CreateDBStateTempTables_ForTables. the overall generation of temp tables for tables (and in it it calls for the ones for tables, for columns, for indexes...)
def create_db_state_temp_tables_for_tables(
    db_type: DBType,
    tbl_ents: pd.DataFrame,
    script_ops: ScriptingOptions,
    schema_tables: DBSchema,
    #tbl_db_check_cnstrnts: pd.DataFrame, #!tbd    
    scripting_data: Optional[bool] = False,
    script_table_ops: Optional[ScriptTableOptions] = None,
    pre_add_constraints_data_checks: bool = False
) -> StringIO:
    
    script_db_state_tables = StringIO()
        
    # Select and sort tables to script
    #!RN: i need to get the ROW. (actually.... why am i doing this here at all...dont i create state tables here?    
    mask = (tbl_ents['scriptschema'] == 1) & (tbl_ents['enttype'] == 'Table')
    rows_tables_script = tbl_ents[mask].sort_values('scriptsortorder') #!ScriptSortOrder... must do the algorithm for it. describe to claude, lets see
    
    # Prepare lists of tables we're working with
    #!note: this part is half baked. will have to get back to it later and see whats going on, maybe based on .net stuff
    table_schema_name_in_scripting = StringIO()
    overall_table_schema_name_in_scripting = StringIO()    
    for idx, row in rows_tables_script.iterrows():
        if db_type == DBType.MSSQL:
            schema_name = f"'{row['entschema']}{row['entname']}'"
        elif db_type == DBType.PostgreSQL:
            schema_name = f"'{row['entschema'].lower()}{row['entname'].lower()}'"
            
        table_schema_name_in_scripting.write(schema_name)
        overall_table_schema_name_in_scripting.write(schema_name)
        
        if idx < len(rows_tables_script) - 1:
            table_schema_name_in_scripting.write(",")
            overall_table_schema_name_in_scripting.write(",")
    #!end note. so what do we do with all this section and these 2 StringIOs? go back to .net code, see if needed here. i think its for filtering, when user on the GUI requests only some table. and so will be converted to command line params here
    
    # Generate the scripts
    script_db_state_tables.write("\t--DB State Temp Tables for Tables\n")
    
    # Get all tables including randolph tables
    all_tables_mask = (tbl_ents['scriptschema'] == True) & (tbl_ents['enttype'] == 'Table')
    tables_to_script = tbl_ents[all_tables_mask].sort_values('scriptsortorder')
    overall_table_schema_name_in_scripting = get_table_names_to_script(tbl_ents)
    
    # Create various DB state elements
    create_state_tables = create_db_state_tables(
        num_tabs = 2,
        tbl_ents_to_script = tables_to_script,
        db_type = db_type,        
        schema_tables = schema_tables,
    )
    script_db_state_tables.write(create_state_tables.getvalue())
    
    bad_data_pre_add_indx = StringIO()
    bad_data_pre_add_fk = StringIO()
    #! and what with these? go back to .net, see if needed

    create_state_tables_columns = create_db_state_columns(
        schema_tables = schema_tables,
        db_type = db_type,
        tbl_ents_to_script = tbl_ents,
        overall_table_schema_name_in_scripting = overall_table_schema_name_in_scripting,
        scripting_data = scripting_data
    )

    script_db_state_tables.write(create_state_tables_columns.getvalue())
    

    create_state_tables_indexes = create_db_state_indexes(
        schema_tables = schema_tables,
        db_type = db_type,
        tbl_ents_to_script = tbl_ents,
        overall_table_schema_name_in_scripting = overall_table_schema_name_in_scripting,
        scripting_data = scripting_data
    )

    script_db_state_tables.write(create_state_tables_indexes.getvalue())


    create_state_tables_fks = create_db_state_fks(
        schema_tables = schema_tables,
        db_type = db_type,
        tbl_ents_to_script = tbl_ents,
        overall_table_schema_name_in_scripting = overall_table_schema_name_in_scripting,
        scripting_data = scripting_data
    )

    script_db_state_tables.write(create_state_tables_fks.getvalue())

    '''
    
    if db_info.src_db_type == DBType.MSSQL:
        create_db_state_check_constraints(
            script_db_state_tables, table_schema_name_in_scripting.getvalue(),
            rndph_table_key_in.getvalue(), overall_table_schema_name_in_scripting.getvalue(),
            conn_str, db_info, script_ops.rndph_conn_str, script_ops.instance_id,
            script_ops.rndph_db_id
        )
    
    create_db_state_indexes(
        script_db_state_tables, table_schema_name_in_scripting.getvalue(),
        rndph_table_key_in.getvalue(), overall_table_schema_name_in_scripting.getvalue(),
        conn_str, db_info, script_ops.pre_add_constraints_data_checks,
        bad_data_pre_add_indx, script_ops.rndph_conn_str, script_ops.instance_id,
        script_ops.rndph_db_id
    )
    
    create_db_state_fks(
        script_db_state_tables, table_schema_name_in_scripting.getvalue(),
        rndph_table_key_in.getvalue(), overall_table_schema_name_in_scripting.getvalue(),
        conn_str, db_info, script_ops.pre_add_constraints_data_checks,
        script_ops.remove_all_extra_ents, bad_data_pre_add_fk,
        script_ops.rndph_conn_str, script_ops.instance_id, script_ops.rndph_db_id
    )

    '''
    
    script_db_state_tables.write("\tEnd; --DB State Temp Tables for Tables\n")
    
    return script_db_state_tables

#within creation of temp tables for TABLES, this creates for the table entry itself. then there's the same for columns, indexes, defaults...
def create_db_state_tables(
    schema_tables: DBSchema, 
    tbl_ents_to_script: pd.DataFrame,
    num_tabs: int,
    db_type: DBType, #that's the destination db type
    
) -> StringIO:

    db_syntax = DBSyntax.get_syntax(db_type)
    script_builder = StringIO()   

    # Start building script
    script_builder.write("\tBEGIN --Tables code\n")
    align = "\t" * num_tabs
    
    # Drop table if exists logic
    if db_type == DBType.MSSQL:
        script_builder.write(
            "IF (OBJECT_ID('tempdb..#ScriptTables') IS NOT NULL) ",
            "BEGIN",
            f"\tDROP TABLE {db_syntax.temp_table_prefix}ScriptTables;",
            "END;"
        )
    else:  # PostgreSQL
        script_builder.write(
            f"""{align}perform  n.nspname ,c.relname
        FROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname like 'pg_temp_%' AND c.relname='scripttables' AND pg_catalog.pg_table_is_visible(c.oid);
        IF FOUND THEN
        \tDROP TABLE {db_syntax.temp_table_prefix}ScriptTables;
        END IF;\n"""
        )

    # Create ScriptTables table
    script_builder.write(
        f"""{align}{db_syntax.temp_table_create}ScriptTables
        (
            table_schema {db_syntax.nvarchar_type} (128) not null,
            table_name {db_syntax.nvarchar_type} (128) not null,
            SQL_CREATE {db_syntax.nvarchar_type} {db_syntax.max_length_str} null,
            SQL_DROP {db_syntax.nvarchar_type} {db_syntax.max_length_str} null,
            col_diff {db_syntax.boolean_type} NULL,
            index_diff {db_syntax.boolean_type} NULL,
            fk_diff {db_syntax.boolean_type} NULL,
            tableStat smallint null
        );\n"""
    )

    # Process each table
    script_table_options_no_fk = ScriptTableOptions(foreign_keys=False)
    
    for _, row in schema_tables.tables.iterrows():
        # Get table creation code
        create_table_sql, create_table_err = get_create_table_from_sys_tables(
            db_type = db_type,
            table_schema = row['entschema'],
            table_name = row['entname'],
            schema_tables = schema_tables,
            script_table_ops = script_table_options_no_fk,
            pre_add_constraints_data_checks = False
        )

        # Get database-specific syntax
        db_syntax = DBSyntax.get_syntax(db_type)
        ident_level = 1

        # Format entity name based on DB type
        if db_type == DBType.MSSQL:
            ent_full_name = f"[{row['entschema']}].[{row['entname'].replace("'", "''")}]"
        else:
            ent_full_name = f"{row['entschema']}.{row['entname']}"

        if create_table_err:
            script_builder.write(
                f"PRINT 'Table ''{ent_full_name}'' cannot be scripted: {create_table_err.replace("'", "''")}'''")
            continue

        # Insert table info
        script_builder.write(
            f"""\n{align}INSERT INTO {db_syntax.temp_table_prefix}ScriptTables (table_schema,table_name, SQL_CREATE, SQL_DROP)
            VALUES ({quote_str_or_null(row['entschema'])},
            {quote_str_or_null(row['entname'])},
            {quote_str_or_null(create_table_sql)},
            'DROP TABLE {ent_full_name};');"""
        )

    # Update state against existing tables
    script_builder.write(
        f"""\n{align}--tables only on Johannes database (need to add)
        update {db_syntax.temp_table_prefix}ScriptTables set tableStat = 1\n"""
    )

    # Add DB-specific update logic
    if db_type == DBType.MSSQL:
        script_builder.write(
            f"""from #ScriptTables J left join (select SCHEMA_NAME(o.schema_id) as table_schema, o.name as table_name FROM sys.tables O) DB 
            "on J.table_schema=DB.table_schema AND J.table_name=DB.table_name 
            "where DB.table_name Is null """
        )
    else:
        script_builder.write(
            f"""{align}FROM {db_syntax.temp_table_prefix}ScriptTables J left join (select t.table_schema, t.table_name FROM information_schema.tables t WHERE t.table_schema not in ('information_schema', 'pg_catalog') AND t.table_schema NOT LIKE 'pg_temp%' ) DB 
            on LOWER(J.table_schema) = LOWER(DB.table_schema) AND LOWER(J.table_name) = LOWER(DB.table_name) 
            where DB.table_name Is null;\n"""
        )

    # Add tables that need to be dropped
    script_builder.write(f"\n{align}--table only on DB (need to drop)")
    if db_type == DBType.MSSQL:
        script_builder.write([
            "INSERT  INTO #ScriptTables ( table_schema ,table_name,tableStat)",
            "SELECT  DB.table_schema ,DB.table_name,2 ",
            "FROM    #ScriptTables J ",
            "RIGHT JOIN ( SELECT SCHEMA_NAME(o.schema_id) AS table_schema , ",
            "o.name AS table_name ",
            "FROM   sys.tables O WHERE is_ms_shipped=0 ",
            ") DB ON J.table_schema = DB.table_schema ",
            "AND J.table_name = DB.table_name ",
            "WHERE J.table_name Is NULL "
        ])
    else:
        script_builder.write(
            f"""\n{align}INSERT  INTO ScriptTables ( table_schema ,table_name,tableStat)
        SELECT  DB.table_schema ,DB.table_name,2 
        FROM    ScriptTables J 
        RIGHT JOIN ( SELECT t.table_schema , 
        t.table_name 
        FROM   information_schema.tables t  where t.table_schema not in ('information_schema', 'pg_catalog') AND t.table_schema NOT LIKE 'pg_temp%'  AND table_type like '%TABLE%' 
        ) DB ON LOWER(J.table_schema) = LOWER(DB.table_schema) 
        AND LOWER(J.table_name) = LOWER(DB.table_name) 
        WHERE J.table_name Is NULL; """
        )
    
    script_builder.write("\n")

    return script_builder

def get_table_names_to_script(tables_to_script: pd.DataFrame, with_dot: Optional[bool]=False):
    # Filter for rows where scriptschema equals 1 AND enttype is 'Table'
    filtered_tables = tables_to_script[
        (tables_to_script['scriptschema'].astype(int) == 1) & 
        (tables_to_script['enttype'] == 'Table')
    ]
    
    # Combine schema and table name for each filtered row based on with_dot parameter
    qualified_names = filtered_tables.apply(
        lambda row: f"'{row['entschema']}.{row['entname']}'" if with_dot else f"'{row['entschema']}{row['entname']}'", 
        axis=1
    )
    
    # Join all qualified names with a comma and space
    result = ", ".join(qualified_names)
    
    return result