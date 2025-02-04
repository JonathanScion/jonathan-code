from enum import Enum
from typing import Optional, Dict, List
from dataclasses import dataclass
import pandas as pd
from io import StringIO
from src.defs.script_defs import DBType, DBSyntax, ScriptingOptions, ScriptTableOptions
from src.generate.generate_create_table import get_create_table_from_sys_tables

@dataclass
class DBInfo:
    src_db_type: DBType


#CreateDBStateTempTables_ForTables
def create_db_state_temp_tables_for_tables(
    script_db_state_tables: StringIO,
    tbl_ents: pd.DataFrame,
    conn_str: str,
    db_info: DBInfo,
    script_ops: ScriptingOptions,
    tbl_db_tables: pd.DataFrame,
    tbl_db_tables_cols: pd.DataFrame,
    tbl_db_tables_indexes: pd.DataFrame,
    tbl_db_tables_indexes_cols: pd.DataFrame,
    tbl_db_tables_fks: pd.DataFrame,
    tbl_db_tables_fks_cols: pd.DataFrame,
    tbl_db_defaults: pd.DataFrame,
    tbl_db_check_cnstrnts: pd.DataFrame,
    tbl_db_ext_props: pd.DataFrame,
    script_table_ops: Optional[ScriptTableOptions] = None,
    pre_add_constraints_data_checks: bool = False
) -> tuple[StringIO, StringIO, StringIO]:
    
    if script_db_state_tables is None:
        script_db_state_tables = StringIO()
    
    
    # Select and sort tables to script
    mask = (tbl_ents['ScriptSchema'] == True) & (tbl_ents['EntType'] == 'Table')
    rows_tables_script = tbl_ents[mask].sort_values('ScriptSortOrder')
    
    # Prepare lists of tables we're working with
    table_schema_name_in_scripting = StringIO()
    overall_table_schema_name_in_scripting = StringIO()
    
    for idx, row in rows_tables_script.iterrows():
        if db_info.src_db_type == DBType.MSSQL:
            schema_name = f"'{row['entschema']}{row['entname']}'"
        elif db_info.src_db_type == DBType.PostgreSQL:
            schema_name = f"'{row['entschema'].lower()}{row['entname'].lower()}'"
            
        table_schema_name_in_scripting.write(schema_name)
        overall_table_schema_name_in_scripting.write(schema_name)
        
        if idx < len(rows_tables_script) - 1:
            table_schema_name_in_scripting.write(",")
            overall_table_schema_name_in_scripting.write(",")
    
    
    # Generate the scripts
    script_db_state_tables.write("--DB State Temp Tables for Tables\n")
    
    # Get all tables including randolph tables
    all_tables_mask = (tbl_ents['ScriptSchema'] == True) & (tbl_ents['EntType'] == 'Table')
    all_tables = tbl_ents[all_tables_mask].sort_values('ScriptSortOrder')
    
    # Create various DB state elements
    create_db_state_tables(
        script_db_state_tables, all_tables, conn_str, db_info, script_ops,
        tbl_db_tables, tbl_db_tables_cols, tbl_db_tables_indexes,
        tbl_db_tables_indexes_cols, tbl_db_tables_fks, tbl_db_tables_fks_cols,
        tbl_db_defaults, tbl_db_check_cnstrnts, tbl_db_ext_props, script_table_ops,
        pre_add_constraints_data_checks,
        script_ops.rndph_conn_str, 
        script_ops.instance_id, script_ops.rndph_db_id
    )
    
    bad_data_pre_add_indx = StringIO()
    bad_data_pre_add_fk = StringIO()
    
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
    
    script_db_state_tables.write("--End DB State Temp Tables for Tables\n")
    
    return (
        overall_table_schema_name_in_scripting,
        bad_data_pre_add_indx,
        bad_data_pre_add_fk
    )


def create_db_state_tables(
    script_builder: List[str],
    tables_script_rows: pd.DataFrame,
    conn_str: str,
    db_info: DBInfo,
    dbtype: DBType, #that's the destination db type
    script_ops: ScriptingOptions,
    db_tables: pd.DataFrame,
    db_tables_cols: pd.DataFrame,
    db_tables_indexes: pd.DataFrame,
    db_tables_indexes_cols: pd.DataFrame,
    db_tables_fks: pd.DataFrame,
    db_tables_fks_cols: pd.DataFrame,
    db_defaults: pd.DataFrame,
    db_check_constraints: pd.DataFrame,
    db_ext_props: pd.DataFrame
) -> None:
    # Define DB-specific variables based on DB type
   

    # Start building script
    script_builder.append("--tables")
    
    # Drop table if exists logic
    if db_info.src_db_type == DBType.MSSQL:
        script_builder.extend([
            "IF (OBJECT_ID('tempdb..#ScriptTables') IS NOT NULL) ",
            "BEGIN",
            f"\tDROP TABLE {db_syntax.temp_table_prefix}ScriptTables;",
            "END;"
        ])
    else:  # PostgreSQL
        script_builder.extend([
            "perform  n.nspname ,c.relname",
            "FROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace",
            "WHERE n.nspname like 'pg_temp_%' AND c.relname='scripttables' AND pg_catalog.pg_table_is_visible(c.oid);",
            "IF FOUND THEN",
            f"\tDROP TABLE {db_syntax.temp_table_prefix}ScriptTables;",
            "END IF;"
        ])

    # Create ScriptTables table
    script_builder.extend([
        f"{db_syntax.temp_table_create}ScriptTables",
        "(",
        f"\ttable_schema {db_syntax.nvarchar_type} (128) not null,",
        f"\ttable_name {db_syntax.nvarchar_type} (128) not null,",
        f"\tSQL_CREATE {db_syntax.nvarchar_type} {db_syntax.max_length_str} null,",
        f"\tSQL_DROP {db_syntax.nvarchar_type} {db_syntax.max_length_str} null,",
        f"\tcol_diff {db_syntax.boolean_type} NULL,",
        f"\tindex_diff {db_syntax.boolean_type} NULL,",
        f"\tfk_diff {db_syntax.boolean_type} NULL,",
        "\ttableStat smallint null",
        ");",
        ""
    ])

    # Process each table
    script_table_options_no_fk = ScriptTableOptions(foreign_keys=False)
    
    for _, row in tables_script_rows.iterrows():
        # Get table creation code
        got_create_table, create_table, create_table_err = get_create_table_from_sys_tables(
            conn_str=conn_str,
            dst_db_type=db_info.dst_db_type,
            schema=row['entschema'],
            table_name=row['entname'],
            db_tables=db_tables,
            db_tables_cols=db_tables_cols,
            db_tables_indexes=db_tables_indexes,
            db_tables_indexes_cols=db_tables_indexes_cols,
            db_tables_fks=db_tables_fks,
            db_tables_fks_cols=db_tables_fks_cols,
            db_defaults=db_defaults,
            db_check_constraints=db_check_constraints,
            db_ext_props=db_ext_props,
            script_table_options=script_table_options_no_fk,
            pre_add_constraints_data_checks=script_ops.pre_add_constraints_data_checks       
        )

        # Get database-specific syntax
        db_syntax = DBSyntax.get_syntax(dbtype)
        ident_level = 1

        # Format entity name based on DB type
        if db_info.src_db_type == DBType.MSSQL:
            ent_full_name = f"[{row['entschema']}].[{row['entname'].replace("'", "''")}]"
        else:
            ent_full_name = f"{row['entschema']}.{row['entname']}"

        if not got_create_table:
            script_builder.append(
                f"PRINT 'Table ''{ent_full_name}'' cannot be scripted: {create_table_err.replace("'", "''")}'''")
            continue

        # Insert table info
        script_builder.extend([
            f"INSERT INTO {db_syntax.temp_table_prefix}ScriptTables (table_schema,table_name, SQL_CREATE, SQL_DROP)",
            f"VALUES ({quote_str_or_null(row['entschema'])},",
            f"{quote_str_or_null(row['entname'])},",
            f"{quote_str_or_null(create_table)},",
            f"'DROP TABLE {ent_full_name};');"
        ])

    # Update state against existing tables
    script_builder.extend([
        "",
        "--tables only on Johannes database (need to add)",
        f"update {db_syntax.temp_table_prefix}ScriptTables set tableStat = 1"
    ])

    # Add DB-specific update logic
    if db_info.src_db_type == DBType.MSSQL:
        script_builder.extend([
            "from #ScriptTables J left join (select SCHEMA_NAME(o.schema_id) as table_schema, o.name as table_name FROM sys.tables O) DB ",
            "on J.table_schema=DB.table_schema AND J.table_name=DB.table_name ",
            "where DB.table_name Is null "
        ])
    else:
        script_builder.extend([
            f"FROM {db_syntax.temp_table_prefix}ScriptTables J left join (select t.table_schema, t.table_name FROM information_schema.tables t WHERE t.table_schema not in ('information_schema', 'pg_catalog') AND t.table_schema NOT LIKE 'pg_temp%' ) DB ",
            "on LOWER(J.table_schema) = LOWER(DB.table_schema) AND LOWER(J.table_name) = LOWER(DB.table_name) ",
            "where DB.table_name Is null; "
        ])

    # Add tables that need to be dropped
    script_builder.append("--table only on DB (need to drop)")
    if db_info.src_db_type == DBType.MSSQL:
        script_builder.extend([
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
        script_builder.extend([
            "INSERT  INTO ScriptTables ( table_schema ,table_name,tableStat)",
            "SELECT  DB.table_schema ,DB.table_name,2 ",
            "FROM    ScriptTables J ",
            "RIGHT JOIN ( SELECT t.table_schema , ",
            "t.table_name ",
            "FROM   information_schema.tables t  where t.table_schema not in ('information_schema', 'pg_catalog') AND t.table_schema NOT LIKE 'pg_temp%'  AND table_type like '%TABLE%' ",
            ") DB ON LOWER(J.table_schema) = LOWER(DB.table_schema) ",
            "AND LOWER(J.table_name) = LOWER(DB.table_name) ",
            "WHERE J.table_name Is NULL; "
        ])
    
    script_builder.append("")

def quote_str_or_null(value: Optional[str]) -> str:
    """Helper function to quote strings or return 'NULL'"""
    if value is None:
        return "NULL"
    return f"'{value.replace("'", "''")}'"