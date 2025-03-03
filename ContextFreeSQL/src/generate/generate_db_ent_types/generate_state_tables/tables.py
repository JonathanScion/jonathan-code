from enum import Enum
from typing import Optional, Dict, List
from dataclasses import dataclass
import pandas as pd
from io import StringIO
from src.defs.script_defs import DBType, DBSyntax, ScriptingOptions, ScriptTableOptions
from src.generate.generate_create_table import get_create_table_from_sys_tables
from src.data_load.from_db.load_from_db_pg import DBSchema
from src.utils.funcs import quote_str_or_null

#CreateDBStateTempTables_ForTables. the overall generation of temp tables for tables (and in it it calls for the ones for tables, for columns, for indexes...)
def create_db_state_temp_tables_for_tables(
    db_type: DBType,
    tbl_ents: pd.DataFrame,
    script_ops: ScriptingOptions,
    schema_tables: DBSchema,
    #tbl_db_check_cnstrnts: pd.DataFrame, #!tbd    
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

    create_db_state_columns()
    
    '''
    create_db_state_columns(
        script_db_state_tables, table_schema_name_in_scripting.getvalue(),
        rndph_table_key_in.getvalue(), overall_table_schema_name_in_scripting.getvalue(),
        conn_str, db_info, script_ops.rndph_conn_str, script_ops.instance_id,
        script_ops.rndph_db_id
    )
    
    create_db_state_defaults(
        script_db_state_tables, table_schema_name_in_scripting.getvalue(),
        rndph_table_key_in.getvalue(), overall_table_schema_name_in_scripting.getvalue(),
        conn_str, db_info, script_ops.rndph_conn_str, script_ops.instance_id,
        script_ops.rndph_db_id
    )
    
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

def create_db_state_columns(
    schema_tables: DBSchema, 
    tbl_ents_to_script: pd.DataFrame,
    num_tabs: int,
    db_type: DBType, #that's the destination db type
) -> str:
    
    
    # Create the columns script section header
    script_db_state_tables = StringIO()
    script_db_state_tables.write("--columns\n")
    
    # Handle different database types
    if db_type == DBType.MSSQL:
        script_db_state_tables.write("IF (OBJECT_ID('tempdb..#ScriptCols') IS NOT NULL) \n")
        script_db_state_tables.write("BEGIN\n")
        script_db_state_tables.write("\tDROP TABLE #ScriptCols;\n")
        script_db_state_tables.write("END;\n")
    elif db_type == DBType.PostgreSQL:
        script_db_state_tables.write("perform  n.nspname ,c.relname\n")
        script_db_state_tables.write("FROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace\n")
        script_db_state_tables.write("WHERE n.nspname like 'pg_temp_%' AND c.relname='scriptcols' AND pg_catalog.pg_table_is_visible(c.oid);\n")
        script_db_state_tables.write("IF FOUND THEN\n")
        script_db_state_tables.write(f"\tDROP TABLE {var_lang_temp_table_prefix}ScriptCols;\n")
        script_db_state_tables.write("END IF;\n")
    
    # Create temporary table for script columns
    script_db_state_tables.write(f"{var_lang_temp_table_prefix}ScriptCols\n")
    script_db_state_tables.write("(\n")
    script_db_state_tables.write(f"\ttable_schema {var_lang_nvarchar_type} (128) not null,\n")
    script_db_state_tables.write(f"\ttable_name {var_lang_nvarchar_type} (128) not null,\n")
    script_db_state_tables.write(f"\tcol_name {var_lang_nvarchar_type} (128) not null,\n")
    script_db_state_tables.write(f"\tuser_type_name {var_lang_nvarchar_type} (128) null,\n")
    script_db_state_tables.write(f"\tuser_type_name_diff {var_lang_boolean_type} null, \n")
    script_db_state_tables.write(f"\tuser_type_name_db  {var_lang_nvarchar_type} (128) null, \n")
    script_db_state_tables.write(f"\tmax_length smallint null,\n")
    script_db_state_tables.write(f"\tmax_length_diff {var_lang_boolean_type} null,\n")
    script_db_state_tables.write(f"\tmax_length_db smallint null,\n")
    script_db_state_tables.write(f"\tprecision smallint null,\n")
    script_db_state_tables.write(f"\tprecision_diff bit null,\n")
    script_db_state_tables.write(f"\tprecision_db smallint null,\n")
    script_db_state_tables.write(f"\tscale smallint null,\n")
    script_db_state_tables.write(f"\tscale_diff bit null,\n")
    script_db_state_tables.write(f"\tscale_db smallint null,\n")
    script_db_state_tables.write(f"\tis_nullable {var_lang_boolean_type} null,\n")
    script_db_state_tables.write(f"\tis_nullable_diff bit null,\n")
    script_db_state_tables.write(f"\tis_nullable_db {var_lang_boolean_type} null,\n")
    script_db_state_tables.write(f"\tis_identity {var_lang_boolean_type} null,\n")
    script_db_state_tables.write(f"\tis_identity_diff bit null,\n")
    script_db_state_tables.write(f"\tis_identity_db {var_lang_boolean_type} null,\n")
    script_db_state_tables.write(f"\tis_computed bit null,\n")
    script_db_state_tables.write(f"\tis_computed_diff bit null,\n")
    script_db_state_tables.write(f"\tcollation_name {var_lang_nvarchar_type} (128) null,\n")
    script_db_state_tables.write(f"\tcollation_name_diff bit null,\n")
    script_db_state_tables.write(f"\tcollation_name_db {var_lang_nvarchar_type} (128) null,\n")
    script_db_state_tables.write(f"\tcomputed_definition {var_lang_nvarchar_type} {var_lang_max_length_str} null,\n")
    script_db_state_tables.write(f"\tcomputed_definition_diff bit null,\n")
    script_db_state_tables.write(f"\tcomputed_definition_db {var_lang_nvarchar_type} {var_lang_max_length_str} null,\n")
    script_db_state_tables.write(f"\tcolStat smallint null,\n")
    script_db_state_tables.write(f"\tdiff_descr {var_lang_nvarchar_type} {var_lang_max_length_str} null,\n")
    script_db_state_tables.write(f"\tSQL_CREATE {var_lang_nvarchar_type} {var_lang_max_length_str} null,\n")
    script_db_state_tables.write(f"\tSQL_ALTER {var_lang_nvarchar_type} {var_lang_max_length_str} null,\n")
    script_db_state_tables.write(f"\tSQL_DROP {var_lang_nvarchar_type} {var_lang_max_length_str} null\n")
    
    if got_data:
        script_db_state_tables.write(f"\t,SQL_ALTER_PostData_NotNULL {var_lang_nvarchar_type} {var_lang_max_length_str} null --if we are adding NULL column and got data as well - then add, set data, then change to NOT NULL\n")
    
    script_db_state_tables.write(");\n\n")
    
    # Query the database for table columns
    tbl_cols = pd.DataFrame()
    
    if rndph_instance_id == 0:  # MPBF
        if table_schema_name_in:
            if db_info.src_db_type == DBType.MSSQL:
                sql_cols = """
                select SCHEMA_NAME(o.schema_id) as table_schema, o.name as table_name, c.name as col_name, 
                       type_name(c.user_type_id) as [user_type_name], 
                       Case type_name(c.system_type_id) 
                           WHEN 'nchar' THEN c.max_length/2 
                           WHEN 'nvarchar' THEN c.max_length/2 
                           ELSE c.max_length 
                       END as max_length, 
                       c.precision, c.scale, c.is_nullable, c.is_identity, c.is_computed, 
                       c.collation_name, cc.definition as computed_definition,
                       ic.seed_value, ic.increment_value  
                from sys.columns c 
                LEFT JOIN sys.computed_columns cc on c.object_id=cc.object_id AND c.column_id=cc.column_id 
                inner join sys.objects O on c.object_id=o.object_id 
                LEFT JOIN sys.identity_columns ic on c.object_id=ic.object_id 
                where SCHEMA_NAME(o.schema_id) + o.name IN ({})
                """.format(table_schema_name_in)
                
                engine = create_engine(f"mssql+pyodbc://{conn_str}")
                tbl_cols = pd.read_sql(sql_cols, engine)
                
            elif db_info.src_db_type == DBType.PostgreSQL:
                sql_cols = """
                select C.table_schema || '.' || C.table_name as object_id, 
                       COLUMN_NAME as col_name, ORDINAL_POSITION as column_id, 
                       C.table_schema, C.table_name, COLLATION_NAME as col_collation, 
                       COLLATION_NAME, DATA_TYPE AS user_type_name, 
                       CHARACTER_MAXIMUM_LENGTH as max_length,
                       NULL as col_xtype, CHARACTER_MAXIMUM_LENGTH as col_length, 
                       NUMERIC_PRECISION as precision, NUMERIC_SCALE as scale, 
                       case WHEN IS_NULLABLE = 'YES' then 1 WHEN IS_NULLABLE = 'NO' then 0 END AS is_nullable,
                       null as IsRowGuidCol, null as col_default_name, 
                       COLUMN_DEFAULT as col_Default_Text, position(c.data_type in 'unsigned')>0 AS "col_unsigned", 
                       NULL AS "EXTRA", null AS is_computed, null AS computed_definition,
                       case WHEN is_identity = 'YES' then 1 WHEN is_identity = 'NO' then 0 END AS is_identity, 
                       identity_generation, identity_start as indent_seed, 
                       identity_increment as indent_incr, identity_maximum, 
                       identity_minimum, identity_cycle
                FROM information_schema.COLUMNS C 
                INNER JOIN information_schema.tables T on C.table_schema= T.table_schema and C.table_name = T.table_name
                where C.TABLE_SCHEMA not in ('information_schema', 'pg_catalog') 
                and c.table_schema NOT LIKE 'pg_temp%' and t.TABLE_TYPE LIKE '%TABLE%'
                """
                
                engine = create_engine(f"postgresql+psycopg2://{conn_str}")
                tbl_cols = pd.read_sql(sql_cols, engine)
    else:  # All -R instance
        # Load it all from Randolph
        where_table_keys_instance_id = f"dbtable_key IN ( SELECT MAX(dbtable_key) AS EntDBTableKey FROM rndph_save_tables WHERE instance_id <= {rndph_instance_id} AND db_id = {rndph_db_id} GROUP BY table_schema, table_name ) AND ( instance_removed_from_db IS NULL OR instance_removed_from_db > {rndph_instance_id} )"
        
        # Get its columns
        sql_query = f"""
        SELECT T.table_schema, t.table_name, C.dbtable_key AS [object_id], 
               col_name, colid AS column_id, col_length AS max_length, 
               col_xprec AS [precision], col_xscale AS [scale], 
               col_collation AS collation_name, col_nullable AS is_nullable, 
               col_identity AS is_identity, col_computed AS is_computed, 
               col_typename AS user_type_name, col_computed_definition AS [computed_definition], 
               col_identity_seed AS [seed_value], col_identity_increment AS [increment_value] 
        FROM dbo.rndph_save_tables_cols C  
        INNER JOIN dbo.rndph_save_tables t on c.dbtable_key = t.dbtable_key 
        WHERE C.{where_table_keys_instance_id}
        """
        
        engine = create_engine(f"mssql+pyodbc://{rndph_conn_str}")
        tbl_cols = pd.read_sql(sql_query, engine)
    
    # And individual R tables dragged
    if rndph_table_key_in:
        sql_query = f"""
        SELECT T.table_schema, T.table_name, C.dbtable_key, C.dbtable_key AS [object_id], 
               col_name, colid AS column_id, col_length AS max_length, 
               col_xprec AS [precision], col_xscale AS [scale], 
               col_collation AS collation_name, col_nullable AS is_nullable, 
               col_identity AS is_identity, col_computed AS is_computed, 
               col_typename AS [user_type_name], col_computed_definition AS [computed_definition], 
               col_identity_seed AS [seed_value], col_identity_increment AS [increment_value] 
        FROM dbo.rndph_save_tables_cols C 
        INNER JOIN rndph_save_tables T on C.dbtable_key = T.dbtable_key 
        WHERE C.dbtable_key IN ({rndph_table_key_in})
        """
        
        engine = create_engine(f"mssql+pyodbc://{rndph_conn_str}")
        additional_cols = pd.read_sql(sql_query, engine)
        tbl_cols = pd.concat([tbl_cols, additional_cols], ignore_index=True)
    
    # Define function to get column SQL (simplified for this example)
    def get_col_sql(row, table_schema, table_name, db_ent_script_state, db_type, with_data=False, got_data=False, is_for_diff=False):
        # This would need to be implemented based on the original code's GetColSQL function
        # For now, returning a placeholder
        return f"ALTER TABLE {table_schema}.{table_name} ADD {row['col_name']} {row['user_type_name']}"
    
    # Define function to quote string or null
    def quote_str_or_null(value):
        if value is None:
            return "NULL"
        elif isinstance(value, bool):
            return "1" if value else "0"
        elif isinstance(value, (int, float)):
            return str(value)
        else:
            return f"'{str(value).replace("'", "''")}'"
    
    # Generate the column script rows
    for _, row in tbl_cols.iterrows():
        if db_info.src_db_type == DBType.MSSQL:
            alter_col = f"'ALTER TABLE [{row['table_schema']}].[{row['table_name']}] DROP COLUMN [{row['col_name']}]'"
        elif db_info.src_db_type == DBType.PostgreSQL:
            alter_col = f"'ALTER TABLE {row['table_schema']}.{row['table_name']} DROP COLUMN {row['col_name']}'"
        
        script_db_state_tables.write(f"INSERT INTO {var_lang_temp_table_prefix}ScriptCols (table_schema,table_name,col_name,user_type_name,max_length,precision,scale,is_nullable,is_identity,is_computed,collation_name,computed_definition, SQL_CREATE, SQL_ALTER, SQL_DROP{',SQL_ALTER_PostData_NotNULL' if got_data else ''})\n")
        script_db_state_tables.write(f"VALUES ({quote_str_or_null(row['table_schema'])},")
        script_db_state_tables.write(f"{quote_str_or_null(row['table_name'])},")
        script_db_state_tables.write(f"{quote_str_or_null(row['col_name'])},")
        script_db_state_tables.write(f"{quote_str_or_null(row['user_type_name'])},")
        script_db_state_tables.write(f"{quote_str_or_null(row['max_length'])},")
        script_db_state_tables.write(f"{quote_str_or_null(row['precision'])},")
        script_db_state_tables.write(f"{quote_str_or_null(row['scale'])},")
        script_db_state_tables.write(f"{quote_str_or_null(row['is_nullable'])},")
        script_db_state_tables.write(f"{quote_str_or_null(row['is_identity'])},")
        script_db_state_tables.write(f"{quote_str_or_null(row['is_computed'])},")
        script_db_state_tables.write(f"{quote_str_or_null(row['collation_name'])},")
        script_db_state_tables.write(f"{quote_str_or_null(row['computed_definition'])},")
        script_db_state_tables.write(f"{quote_str_or_null(get_col_sql(row, row['table_schema'], row['table_name'], 'Add', db_info.src_db_type, False, got_data, True))},")
        script_db_state_tables.write(f"{quote_str_or_null(get_col_sql(row, row['table_schema'], row['table_name'], 'Alter', db_info.src_db_type, False, False, True))},")
        script_db_state_tables.write(f"{alter_col}")
        
        if got_data:
            # Was the col NOT NULL to begin with?
            if row['is_nullable']:
                script_db_state_tables.write(",NULL")  # code for this field
            else:
                script_db_state_tables.write(f",{quote_str_or_null(get_col_sql(row, row['table_schema'], row['table_name'], 'Alter', db_info.src_db_type, False, False, True))}")
        
        script_db_state_tables.write(");\n")
    
    # Now update state as against existing table
    script_db_state_tables.write("\n")
    script_db_state_tables.write("--columns only on Johannes database (need to add)\n")
    script_db_state_tables.write(f"update {var_lang_temp_table_prefix}ScriptCols set colStat = 1\n")
    
    if db_info.src_db_type == DBType.MSSQL:
        script_db_state_tables.write("from #ScriptCols J left join (select SCHEMA_NAME(o.schema_id) as table_schema, o.name as table_name, c.name as col_name from sys.tables O inner join sys.columns c on o.object_id=c.object_id) DB \n")
        script_db_state_tables.write("on J.table_schema=DB.table_schema and J.table_name=DB.table_name and J.col_name=DB.col_name \n")
        script_db_state_tables.write("where DB.col_name Is null; \n")
    elif db_info.src_db_type == DBType.PostgreSQL:
        script_db_state_tables.write(f"FROM ScriptCols J left join (select t.table_schema, t.table_name, c.column_name FROM information_schema.tables t INNER JOIN information_schema.columns c on t.table_schema=c.table_schema and t.table_name=c.table_name WHERE t.table_schema not in ('information_schema', 'pg_catalog') AND t.table_schema NOT LIKE 'pg_temp%'  and t.table_type LIKE '%TABLE%' ) DB \n")
        script_db_state_tables.write("on LOWER(J.table_schema) = LOWER(DB.table_schema) and LOWER(J.table_name) = LOWER(DB.table_name) and LOWER(J.col_name) = LOWER(DB.column_name) \n")
        script_db_state_tables.write("where DB.column_name Is null \n")
        script_db_state_tables.write("AND J.table_schema=ScriptCols.table_schema and J.table_name=ScriptCols.table_name and J.col_name=ScriptCols.col_name;\n")
    
    script_db_state_tables.write("\n")
    
    # Generate columns only on DB (need to drop)
    if overall_table_schema_name_in_scripting:
        script_db_state_tables.write("--columns only on DB (need to drop)\n")
        script_db_state_tables.write(f"INSERT INTO {var_lang_temp_table_prefix}ScriptCols (table_schema, table_name, col_name, colStat, SQL_DROP) \n")
        
        if db_info.src_db_type == DBType.MSSQL:
            script_db_state_tables.write("SELECT  DB.table_schema, DB.table_name, DB.col_name, 2, 'ALTER TABLE ['+DB.table_schema+'].['+DB.table_name+'] DROP COLUMN [' +DB.col_name+'];' \n")
            script_db_state_tables.write("FROM    #ScriptCols J \n")
            script_db_state_tables.write("RIGHT JOIN ( SELECT SCHEMA_NAME(o.schema_id) AS table_schema, o.name AS table_name, c.name AS col_name \n")
            script_db_state_tables.write("FROM   sys.tables O \n")
            script_db_state_tables.write("INNER JOIN sys.columns c ON o.object_id = c.object_id \n")
            script_db_state_tables.write(f"WHERE  SCHEMA_NAME(o.schema_id) + o.name IN ({overall_table_schema_name_in_scripting}) \n")
            script_db_state_tables.write(") DB ON J.table_schema = DB.table_schema \n")
            script_db_state_tables.write("AND J.table_name = DB.table_name \n")
            script_db_state_tables.write("AND J.col_name = DB.col_name \n")
            script_db_state_tables.write("WHERE ( J.col_name IS NULL );  \n")
        elif db_info.src_db_type == DBType.PostgreSQL:
            script_db_state_tables.write("SELECT  DB.table_schema, DB.table_name, DB.column_name, 2, 'ALTER TABLE ' || DB.table_schema || '.' || DB.table_name || ' DROP COLUMN ' || DB.column_name || ';' \n")
            script_db_state_tables.write("FROM    ScriptCols J \n")
            script_db_state_tables.write("RIGHT JOIN ( select t.table_schema, t.table_name, c.column_name FROM information_schema.tables t INNER JOIN information_schema.columns c on t.table_schema=c.table_schema and t.table_name=c.table_name WHERE t.table_schema not in ('information_schema', 'pg_catalog') AND t.table_schema NOT LIKE 'pg_temp%'  and t.table_type LIKE '%TABLE%' \n")
            script_db_state_tables.write(f"AND C.table_schema || C.table_name IN ({overall_table_schema_name_in_scripting}) \n")
            script_db_state_tables.write(") DB ON LOWER(J.table_schema) = LOWER(DB.table_schema) \n")
            script_db_state_tables.write("And LOWER(J.table_name) = LOWER(DB.table_name) \n")
            script_db_state_tables.write("And LOWER(J.col_name) = LOWER(DB.column_name) \n")
            script_db_state_tables.write("WHERE ( J.col_name Is NULL );  \n")
    
    # Write updates of flags section
    script_db_state_tables.write("\n\n")
    script_db_state_tables.write("---updates Of flags--------------------\n")
    script_db_state_tables.write("\n")
    
    # System type name
    script_db_state_tables.write("--system type name \n")
    if db_info.src_db_type == DBType.MSSQL:
        script_db_state_tables.write(f"update {var_lang_temp_table_prefix}ScriptCols Set user_type_name_diff = 1, colStat = 3, user_type_name_db=DB.user_type_name, \n")
        script_db_state_tables.write("\tdiff_descr = Case When diff_descr Is NULL Then '' \n")
        script_db_state_tables.write("\t\tELSE diff_descr + ', ' \n")
        script_db_state_tables.write("\tEND + 'user_type_name is ' \n")
        script_db_state_tables.write("\t+ CAST(DB.user_type_name AS VARCHAR(10)) + ', should be ' \n")
        script_db_state_tables.write("\t+ CAST(J.user_type_name AS VARCHAR(10)) \n")
        script_db_state_tables.write("from #ScriptCols J INNER join (select COALESCE(TYPE_NAME(c.user_type_id), TYPE_NAME(c.system_type_id)) as user_type_name, SCHEMA_NAME(o.schema_id) as table_schema, o.name as table_name, c.name as col_name from sys.tables O inner join sys.columns c on o.object_id=c.object_id) DB  \n")
        script_db_state_tables.write("on J.table_schema=DB.table_schema and J.table_name=DB.table_name and J.col_name=DB.col_name \n")
        script_db_state_tables.write("where J.user_type_name <> DB.user_type_name; \n")
    elif db_info.src_db_type == DBType.PostgreSQL:
        script_db_state_tables.write(f"update {var_lang_temp_table_prefix}ScriptCols Set user_type_name_diff=true, colStat = 3, user_type_name_db=DB.user_type_name, \n")
        script_db_state_tables.write("\tdiff_descr = Case When j.diff_descr Is NULL Then '' \n")
        script_db_state_tables.write("\t\tELSE j.diff_descr || ', ' \n")
        script_db_state_tables.write("\tEND || 'user_type_name is ' \n")
        script_db_state_tables.write(f"\t || CAST(DB.user_type_name AS {var_lang_nvarchar_type}(10)) || ', should be ' \n")
        script_db_state_tables.write(f"\t || CAST(J.user_type_name AS {var_lang_nvarchar_type}(10)) \n")
        script_db_state_tables.write(f"from {var_lang_temp_table_prefix}ScriptCols J INNER join (select t.table_schema, t.table_name, c.column_name, c.data_type as user_type_name \n")
        script_db_state_tables.write("from information_schema.columns C INNER JOIN information_schema.tables T on c.table_schema=t.table_schema and c.table_name=t.table_name \n")
        script_db_state_tables.write("where C.TABLE_SCHEMA not in ('information_schema', 'pg_catalog') and t.table_type LIKE '%TABLE%') DB  \n")
        script_db_state_tables.write("on LOWER(J.table_schema) = LOWER(DB.table_schema) and LOWER(J.table_name) = LOWER(DB.table_name) and LOWER(J.col_name) = LOWER(DB.column_name) \n")
        script_db_state_tables.write("where J.user_type_name <> DB.user_type_name \n")
        script_db_state_tables.write("AND (ScriptCols.table_schema = j.table_schema AND ScriptCols.table_name = j.table_name AND ScriptCols.col_name = j.col_name);\n")
    
    # Max length (continued)
    if db_info.src_db_type == DBType.MSSQL:
        script_db_state_tables.write("from #ScriptCols J INNER join (select CASE type_name(c.system_type_id) \n")
        script_db_state_tables.write("WHEN 'nchar' \n")
        script_db_state_tables.write("THEN c.max_length/2 \n")
        script_db_state_tables.write("WHEN 'nvarchar' \n")
        script_db_state_tables.write("THEN c.max_length/2 \n")
        script_db_state_tables.write("ELSE c.max_length \n")
        script_db_state_tables.write("END as max_length, SCHEMA_NAME(o.schema_id) as table_schema, o.name as table_name, c.name as col_name from sys.tables O inner join sys.columns c on o.object_id=c.object_id) DB  \n")
        script_db_state_tables.write("on J.table_schema=DB.table_schema and J.table_name=DB.table_name and J.col_name=DB.col_name \n")
        script_db_state_tables.write("where J.max_length <> DB.max_length;\n")
    elif db_info.src_db_type == DBType.PostgreSQL:
        script_db_state_tables.write(f"update {var_lang_temp_table_prefix}ScriptCols Set max_length_diff = true, colStat = 3, max_length_db=DB.CHARACTER_MAXIMUM_LENGTH, \n")
        script_db_state_tables.write("\tdiff_descr = Case When j.diff_descr Is NULL Then '' \n")
        script_db_state_tables.write("\t\tELSE j.diff_descr || ', ' \n")
        script_db_state_tables.write("\tEND || 'max_length is ' \n")
        script_db_state_tables.write(f"\t || CAST(DB.CHARACTER_MAXIMUM_LENGTH AS {var_lang_nvarchar_type}(10)) || ', should be ' \n")
        script_db_state_tables.write(f"\t || CAST(J.max_length AS {var_lang_nvarchar_type}(10)) \n")
        script_db_state_tables.write(f"from {var_lang_temp_table_prefix}ScriptCols J INNER join (select t.table_schema, t.table_name, c.column_name, c.CHARACTER_MAXIMUM_LENGTH \n")
        script_db_state_tables.write("from information_schema.columns C INNER JOIN information_schema.tables T on c.table_schema=t.table_schema and c.table_name=t.table_name \n")
        script_db_state_tables.write("where C.TABLE_SCHEMA not in ('information_schema', 'pg_catalog') and t.table_type LIKE '%TABLE%') DB  \n")
        script_db_state_tables.write("on LOWER(J.table_schema) = LOWER(DB.table_schema) and LOWER(J.table_name) = LOWER(DB.table_name) and LOWER(J.col_name) = LOWER(DB.column_name) \n")
        script_db_state_tables.write("where J.max_length <> DB.CHARACTER_MAXIMUM_LENGTH \n")
        script_db_state_tables.write("AND ( LOWER(ScriptCols.table_schema) = LOWER(j.table_schema) AND LOWER(ScriptCols.table_name) = LOWER(j.table_name) AND LOWER(ScriptCols.col_name) = LOWER(j.col_name) );\n")
    
    # Precision
    script_db_state_tables.write("\n")
    script_db_state_tables.write("--precision \n")
    if db_info.src_db_type == DBType.MSSQL:
        script_db_state_tables.write(f"update {var_lang_temp_table_prefix}ScriptCols SET precision_diff = 1, colStat = 3, precision_db=DB.precision, \n")
        script_db_state_tables.write("\tdiff_descr = CASE WHEN diff_descr IS NULL THEN '' \n")
        script_db_state_tables.write("\t\tELSE diff_descr + ', ' \n")
        script_db_state_tables.write("\tEND + 'precision is ' \n")
        script_db_state_tables.write("\t+ CAST(DB.precision AS VARCHAR(10)) + ', should be ' \n")
        script_db_state_tables.write("\t+ CAST(J.precision AS VARCHAR(10)) \n")
        script_db_state_tables.write("from #ScriptCols J INNER join (select precision, SCHEMA_NAME(o.schema_id) as table_schema, o.name as table_name, c.name as col_name from sys.tables O inner join sys.columns c on o.object_id=c.object_id) DB  \n")
        script_db_state_tables.write("on J.table_schema=DB.table_schema and J.table_name=DB.table_name and J.col_name=DB.col_name \n")
        script_db_state_tables.write("where J.precision <> DB.precision; \n")
    elif db_info.src_db_type == DBType.PostgreSQL:
        script_db_state_tables.write(f"update {var_lang_temp_table_prefix}ScriptCols Set max_length_diff = true, colStat = 3, precision_db=DB.precision, \n")
        script_db_state_tables.write("\tdiff_descr = Case When j.diff_descr Is NULL Then '' \n")
        script_db_state_tables.write("\t\tELSE j.diff_descr || ', ' \n")
        script_db_state_tables.write("\tEND || 'precision is ' \n")
        script_db_state_tables.write(f"\t || CAST(DB.precision AS {var_lang_nvarchar_type}(10)) || ', should be ' \n")
        script_db_state_tables.write(f"\t || CAST(J.precision AS {var_lang_nvarchar_type}(10)) \n")
        script_db_state_tables.write(f"from {var_lang_temp_table_prefix}ScriptCols J INNER join (select t.table_schema, t.table_name, c.column_name, c.numeric_precision AS precision \n")
        script_db_state_tables.write("from information_schema.columns C INNER JOIN information_schema.tables T on c.table_schema=t.table_schema and c.table_name=t.table_name \n")
        script_db_state_tables.write("where C.TABLE_SCHEMA not in ('information_schema', 'pg_catalog') and t.table_type LIKE '%TABLE%') DB  \n")
        script_db_state_tables.write("on LOWER(J.table_schema) = LOWER(DB.table_schema) and LOWER(J.table_name) = LOWER(DB.table_name) and LOWER(J.col_name) = LOWER(DB.column_name) \n")
        script_db_state_tables.write("where J.precision <> DB.precision \n")
        script_db_state_tables.write("AND ( LOWER(ScriptCols.table_schema) = LOWER(j.table_schema) AND LOWER(ScriptCols.table_name) = LOWER(j.table_name) AND LOWER(ScriptCols.col_name) = LOWER(j.col_name) );\n")
    
    # Scale
    script_db_state_tables.write("\n")
    script_db_state_tables.write("--scale \n")
    if db_info.src_db_type == DBType.MSSQL:
        script_db_state_tables.write(f"update {var_lang_temp_table_prefix}ScriptCols SET scale_diff=1, colStat=3, scale_db=DB.scale, \n")
        script_db_state_tables.write("\tdiff_descr = CASE WHEN diff_descr IS NULL THEN '' \n")
        script_db_state_tables.write("\t\tELSE diff_descr + ', ' \n")
        script_db_state_tables.write("\tEND + 'scale is ' \n")
        script_db_state_tables.write("\t+ CAST(DB.scale AS VARCHAR(10)) + ', should be ' \n")
        script_db_state_tables.write("\t+ CAST(J.scale AS VARCHAR(10)) \n")
        script_db_state_tables.write("from #ScriptCols J INNER join (select scale, SCHEMA_NAME(o.schema_id) as table_schema, o.name as table_name, c.name as col_name from sys.tables O inner join sys.columns c on o.object_id=c.object_id) DB  \n")
        script_db_state_tables.write("on J.table_schema=DB.table_schema and J.table_name=DB.table_name and J.col_name=DB.col_name \n")
        script_db_state_tables.write("where J.scale <> DB.scale; \n")
    elif db_info.src_db_type == DBType.PostgreSQL:
        script_db_state_tables.write(f"update {var_lang_temp_table_prefix}ScriptCols Set max_length_diff = true, colStat = 3, scale_db=DB.scale, \n")
        script_db_state_tables.write("\tdiff_descr = Case When j.diff_descr Is NULL Then '' \n")
        script_db_state_tables.write("\t\tELSE j.diff_descr || ', ' \n")
        script_db_state_tables.write("\tEND || 'scale is ' \n")
        script_db_state_tables.write(f"\t || CAST(DB.scale AS {var_lang_nvarchar_type}(10)) || ', should be ' \n")
        script_db_state_tables.write(f"\t || CAST(J.scale AS {var_lang_nvarchar_type}(10)) \n")
        script_db_state_tables.write(f"from {var_lang_temp_table_prefix}ScriptCols J INNER join (select t.table_schema, t.table_name, c.column_name, c.numeric_scale AS scale \n")
        script_db_state_tables.write("from information_schema.columns C INNER JOIN information_schema.tables T on c.table_schema=t.table_schema and c.table_name=t.table_name \n")
        script_db_state_tables.write("where C.TABLE_SCHEMA not in ('information_schema', 'pg_catalog') and t.table_type LIKE '%TABLE%') DB  \n")
        script_db_state_tables.write("on LOWER(J.table_schema) = LOWER(DB.table_schema) and LOWER(J.table_name) = LOWER(DB.table_name) and LOWER(J.col_name) = LOWER(DB.column_name) \n")
        script_db_state_tables.write("where J.scale <> DB.scale \n")
        script_db_state_tables.write("AND ( LOWER(ScriptCols.table_schema) = LOWER(j.table_schema) AND LOWER(ScriptCols.table_name) = LOWER(j.table_name) AND LOWER(ScriptCols.col_name) = LOWER(j.col_name));\n")
    
    # Is_nullable
    script_db_state_tables.write("\n")
    script_db_state_tables.write("--is_nullable \n")
    if db_info.src_db_type == DBType.MSSQL:
        script_db_state_tables.write(f"update {var_lang_temp_table_prefix}ScriptCols SET is_nullable_diff=1, colStat=3, is_nullable_db=DB.is_nullable, \n")
        script_db_state_tables.write("\tdiff_descr = CASE WHEN diff_descr IS NULL THEN '' \n")
        script_db_state_tables.write("\t\tELSE diff_descr + ', ' \n")
        script_db_state_tables.write("\tEND + 'is_nullable is ' \n")
        script_db_state_tables.write("\t+ CAST(DB.is_nullable AS VARCHAR(10)) + ', should not be ' \n")
        script_db_state_tables.write("from #ScriptCols J INNER join (select is_nullable, SCHEMA_NAME(o.schema_id) as table_schema, o.name as table_name, c.name as col_name from sys.tables O inner join sys.columns c on o.object_id=c.object_id) DB  \n")
        script_db_state_tables.write("on J.table_schema=DB.table_schema and J.table_name=DB.table_name and J.col_name=DB.col_name \n")
        script_db_state_tables.write("where J.is_nullable <> DB.is_nullable; \n")
    elif db_info.src_db_type == DBType.PostgreSQL:
        script_db_state_tables.write(f"update {var_lang_temp_table_prefix}ScriptCols Set max_length_diff = true, colStat = 3, is_nullable_db=DB.is_nullable, \n")
        script_db_state_tables.write("\tdiff_descr = Case When j.diff_descr Is NULL Then '' \n")
        script_db_state_tables.write("\t\tELSE j.diff_descr || ', ' \n")
        script_db_state_tables.write("\tEND || 'is_nullable is ' \n")
        script_db_state_tables.write(f"\t || CAST(DB.is_nullable AS {var_lang_nvarchar_type}(10)) || ', should be ' \n")
        script_db_state_tables.write(f"\t || CAST(J.is_nullable AS {var_lang_nvarchar_type}(10)) \n")
        script_db_state_tables.write(f"from {var_lang_temp_table_prefix}ScriptCols J INNER join (select t.table_schema, t.table_name, c.column_name, case WHEN c.IS_NULLABLE = 'YES' then CAST(1 AS BOOLEAN) WHEN c.IS_NULLABLE = 'NO' then CAST(0 AS BOOLEAN) END AS is_nullable \n")
        script_db_state_tables.write("from information_schema.columns C INNER JOIN information_schema.tables T on c.table_schema=t.table_schema and c.table_name=t.table_name \n")
        script_db_state_tables.write("where C.TABLE_SCHEMA not in ('information_schema', 'pg_catalog') and t.table_type LIKE '%TABLE%') DB  \n")
        script_db_state_tables.write("on LOWER(J.table_schema) = LOWER(DB.table_schema) and LOWER(J.table_name) = LOWER(DB.table_name) and LOWER(J.col_name) = LOWER(DB.column_name) \n")
        script_db_state_tables.write("where J.is_nullable <> DB.is_nullable \n")
        script_db_state_tables.write("AND ( LOWER(ScriptCols.table_schema) = LOWER(j.table_schema) AND LOWER(ScriptCols.table_name) = LOWER(j.table_name) AND LOWER(ScriptCols.col_name) = LOWER(j.col_name) );\n")
    
    # Is_identity
    script_db_state_tables.write("\n")
    script_db_state_tables.write("--is_identity \n")
    if db_info.src_db_type == DBType.MSSQL:
        script_db_state_tables.write(f"update {var_lang_temp_table_prefix}ScriptCols SET is_identity_diff=1, colStat=3, \n")
        script_db_state_tables.write("\tdiff_descr = CASE WHEN diff_descr IS NULL THEN '' \n")
        script_db_state_tables.write("\t\tELSE diff_descr + ', ' \n")
        script_db_state_tables.write("\tEND + 'is_identity is ' \n")
        script_db_state_tables.write("\t+ CAST(DB.is_identity AS VARCHAR(10)) + ', should not be ' \n")
        script_db_state_tables.write("from #ScriptCols J INNER join (select is_identity, SCHEMA_NAME(o.schema_id) as table_schema, o.name as table_name, c.name as col_name from sys.tables O inner join sys.columns c on o.object_id=c.object_id) DB  \n")
        script_db_state_tables.write("on J.table_schema=DB.table_schema and J.table_name=DB.table_name and J.col_name=DB.col_name \n")
        script_db_state_tables.write("where J.is_identity <> DB.is_identity;\n")
    elif db_info.src_db_type == DBType.PostgreSQL:
        script_db_state_tables.write(f"update {var_lang_temp_table_prefix}ScriptCols Set max_length_diff = true, colStat = 3, is_identity_db=DB.is_identity, \n")
        script_db_state_tables.write("\tdiff_descr = Case When j.diff_descr Is NULL Then '' \n")
        script_db_state_tables.write("\t\tELSE j.diff_descr || ', ' \n")
        script_db_state_tables.write("\tEND || 'is_identity is ' \n")
        script_db_state_tables.write(f"\t || CAST(DB.is_identity AS {var_lang_nvarchar_type}(10)) || ', should be ' \n")
        script_db_state_tables.write(f"\t || CAST(J.is_identity AS {var_lang_nvarchar_type}(10)) \n")
        script_db_state_tables.write(f"from {var_lang_temp_table_prefix}ScriptCols J INNER join (select t.table_schema, t.table_name, c.column_name, case WHEN c.IS_IDENTITY = 'YES' then CAST(1 AS BOOLEAN)  WHEN c.IS_IDENTITY = 'NO' then CAST(0 AS BOOLEAN)  END AS is_identity \n")
        script_db_state_tables.write("from information_schema.columns C INNER JOIN information_schema.tables T on c.table_schema=t.table_schema and c.table_name=t.table_name \n")
        script_db_state_tables.write("where C.TABLE_SCHEMA not in ('information_schema', 'pg_catalog') and t.table_type LIKE '%TABLE%') DB  \n")
        script_db_state_tables.write("on LOWER(J.table_schema) = LOWER(DB.table_schema) and LOWER(J.table_name) = LOWER(DB.table_name) and LOWER(J.col_name) = LOWER(DB.column_name) \n")
        script_db_state_tables.write("where J.is_identity <> DB.is_identity \n")
        script_db_state_tables.write("AND ( LOWER(ScriptCols.table_schema) = LOWER(j.table_schema) AND LOWER(ScriptCols.table_name) = LOWER(j.table_name) AND LOWER(ScriptCols.col_name) = LOWER(j.col_name) );\n")
    
    # Is_computed
    script_db_state_tables.write("\n")
    script_db_state_tables.write("--is_computed \n")
    if db_info.src_db_type == DBType.MSSQL:
        script_db_state_tables.write(f"update {var_lang_temp_table_prefix}ScriptCols SET is_computed_diff=1, colStat=3, \n")
        script_db_state_tables.write("\tdiff_descr = CASE WHEN diff_descr IS NULL THEN '' \n")
        script_db_state_tables.write("\t\tELSE diff_descr + ', ' \n")
        script_db_state_tables.write("\tEND + 'is_computed is ' \n")
        script_db_state_tables.write("\t+ CAST(DB.is_computed AS VARCHAR(10)) + ', should not be ' \n")
        script_db_state_tables.write("from #ScriptCols J INNER join (select is_computed, SCHEMA_NAME(o.schema_id) as table_schema, o.name as table_name, c.name as col_name from sys.tables O inner join sys.columns c on o.object_id=c.object_id) DB  \n")
        script_db_state_tables.write("on J.table_schema=DB.table_schema and J.table_name=DB.table_name and J.col_name=DB.col_name \n")
        script_db_state_tables.write("where J.is_computed <> DB.is_computed; \n")
    
    # Collation_name
    script_db_state_tables.write("\n")
    script_db_state_tables.write("--collation_name \n")
    if db_info.src_db_type == DBType.MSSQL:
        script_db_state_tables.write(f"update {var_lang_temp_table_prefix}ScriptCols SET collation_name_diff=1, colStat=3, collation_name_db=DB.collation_name, \n")
        script_db_state_tables.write("\tdiff_descr = CASE WHEN diff_descr IS NULL THEN '' \n")
        script_db_state_tables.write("\t\tELSE diff_descr + ', ' \n")
        script_db_state_tables.write("\tEND + 'collation_name is ' \n")
        script_db_state_tables.write("\t+ CAST(DB.collation_name AS NVARCHAR(max)) + ', should be ' \n")
        script_db_state_tables.write("\t+ CAST(J.collation_name AS NVARCHAR(max)) \n")
        script_db_state_tables.write("from #ScriptCols J INNER join (select collation_name, SCHEMA_NAME(o.schema_id) as table_schema, o.name as table_name, c.name as col_name from sys.tables O inner join sys.columns c on o.object_id=c.object_id) DB  \n")
        script_db_state_tables.write("on J.table_schema=DB.table_schema and J.table_name=DB.table_name and J.col_name=DB.col_name \n")
        script_db_state_tables.write("where J.collation_name <> DB.collation_name; \n")
    
    # Computed_definition
    script_db_state_tables.write("\n")
    script_db_state_tables.write("--computed_definition \n")
    if db_info.src_db_type == DBType.MSSQL:
        script_db_state_tables.write(f"update {var_lang_temp_table_prefix}ScriptCols SET computed_definition_diff=1, colStat=3, computed_definition_db=DB.computed_definition, \n")
        script_db_state_tables.write("\tdiff_descr = CASE WHEN diff_descr IS NULL THEN '' \n")
        script_db_state_tables.write("\t\tELSE diff_descr + ', ' \n")
        script_db_state_tables.write("\tEND + 'computed_definition is ' \n")
        script_db_state_tables.write("\t+ CAST(DB.computed_definition AS NVARCHAR(max)) + ', should be ' \n")
        script_db_state_tables.write("\t+ CAST(J.computed_definition AS NVARCHAR(max)) \n")
        script_db_state_tables.write(f"from {var_lang_temp_table_prefix}ScriptCols J INNER join (select cc.definition as computed_definition, SCHEMA_NAME(o.schema_id) as table_schema, o.name as table_name, c.name as col_name from sys.tables O inner join sys.columns c on o.object_id=c.object_id LEFT JOIN sys.computed_columns cc on c.object_id=cc.object_id AND c.column_id=cc.column_id) DB  \n")
        script_db_state_tables.write("on J.table_schema=DB.table_schema and J.table_name=DB.table_name and J.col_name=DB.col_name \n")
        script_db_state_tables.write("where J.computed_definition <> DB.computed_definition; \n")
    
    # Update tables where columns are different
    script_db_state_tables.write("\n\n")
    script_db_state_tables.write("--update tables where columns are different\n")
    script_db_state_tables.write(f"update {var_lang_temp_table_prefix}ScriptTables set tableStat=3 \n")
    script_db_state_tables.write(f"from {var_lang_temp_table_prefix}ScriptTables T INNER JOIN {var_lang_temp_table_prefix}ScriptCols C on LOWER(T.table_schema) = LOWER(C.table_schema) AND LOWER(T.table_name) = LOWER(C.table_name) \n")
    script_db_state_tables.write("where C.colStat IN (1,2,3) AND (T.tableStat NOT IN (1,2) OR t.tableStat IS NULL); --extra, missing, or different \n")
    
    # Wherever got columns different, mark the tables as different
    script_db_state_tables.write("\n")
    script_db_state_tables.write("--wherever got columns different, mark the tables as different\n")
    script_db_state_tables.write(f"UPDATE {var_lang_temp_table_prefix}ScriptTables SET col_diff={var_lang_boolean_val_true}\n")
    script_db_state_tables.write(f"FROM {var_lang_temp_table_prefix}ScriptTables T INNER JOIN {var_lang_temp_table_prefix}ScriptCols C ON LOWER(T.table_schema) = LOWER(C.table_schema) AND LOWER(T.table_name) = LOWER(C.table_name)\n")
    script_db_state_tables.write("WHERE C.ColStat Is Not NULL AND (T.tableStat NOT IN (1,2) OR t.tableStat IS NULL);\n")
    script_db_state_tables.write("\n")