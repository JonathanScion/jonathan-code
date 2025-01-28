from dataclasses import dataclass
from enum import Enum
from typing import Optional, List, Tuple
import pandas as pd
from src.defs.script_defs import DBType, DBSyntax, ScriptingOptions, ScriptTableOptions


@dataclass
class ScriptTableOptions:
    table_name: str = ""
    column_identity: bool = True
    indexes: bool = True
    foreign_keys: bool = True
    defaults: bool = True
    check_constraints: bool = True
    extended_props: bool = True

def get_create_table_from_sys_tables(
    conn_str: str,
    db_type: DBType,
    table_schema: str,
    table_name: str,
    db_tables: pd.DataFrame,
    db_tables_cols: pd.DataFrame,
    db_tables_indexes: pd.DataFrame,
    db_tables_indexes_cols: pd.DataFrame,
    db_tables_fks: pd.DataFrame,
    db_tables_fks_cols: pd.DataFrame,
    db_defaults: pd.DataFrame,
    db_check_constraints: pd.DataFrame,
    db_ext_props: pd.DataFrame,
    script_table_ops: Optional[ScriptTableOptions] = None,
    pre_add_constraints_data_checks: bool = False,    
    as_temp_table: bool = False
) -> Tuple[bool, Optional[str], Optional[str]]:
  
    out_script = None
    out_err = None
    
    if script_table_ops is None:
        script_table_ops = ScriptTableOptions()
    
    try:
   

        # Get the table information
        table_rows = db_tables[
            (db_tables['EntSchema'] == table_schema) & 
            (db_tables['EntName'] == table_name)
        ]
        
        if len(table_rows) == 0:
            return False, None, f"could not find table in the result set: {table_schema}.{table_name}"
        
        table_row = table_rows.iloc[0]
        create_table_lines = []

        # Determine full table name based on DB type
        if script_table_ops.table_name:
            full_table_name = script_table_ops.table_name
        else:
            if db_type == DBType.MSSQL:
                full_table_name = f"[{table_schema}].[{table_name}]"
            else:  # MySQL or PostgreSQL
                full_table_name = f"{table_schema}.{table_name}"

        # Start CREATE TABLE statement
        if as_temp_table:
            create_table_lines.append(f"{var_lang['temp_table_create']}{full_table_name}")
        else:
            create_table_lines.append(f"CREATE TABLE {full_table_name}")
        create_table_lines.append("(")

        # Add columns
        col_rows = db_tables_cols[
            db_tables_cols['object_id'] == table_row['object_id']
        ].sort_values('column_id')

        for idx, col_row in col_rows.iterrows():
            col_sql = get_col_sql(
                col_row, table_row['table_schema'], table_row['table_name'],
                'InLine', db_type, script_table_ops.column_identity, force_allow_null
            ).strip()
            
            if idx < len(col_rows) - 1:
                col_sql += ","
            create_table_lines.append(col_sql)

        create_table_lines.append(");")

        # Add indexes if requested
        if script_table_ops.indexes and db_tables_indexes is not None:
            idx_rows = db_tables_indexes[
                db_tables_indexes['object_id'] == table_row['object_id']
            ]
            
            for _, idx_row in idx_rows.iterrows():
                if db_type == DBType.MSSQL:
                    idx_cols = db_tables_indexes_cols[
                        (db_tables_indexes_cols['object_id'] == table_row['object_id']) &
                        (db_tables_indexes_cols['index_id'] == idx_row['index_id'])
                    ]
                else:
                    idx_cols = db_tables_indexes_cols[
                        (db_tables_indexes_cols['object_id'] == table_row['object_id']) &
                        (db_tables_indexes_cols['index_name'] == idx_row['index_name'])
                    ]
                
                create_table_lines.append(get_index_sql(idx_row, idx_cols, db_type) + ";")

        # Add foreign keys if requested
        if script_table_ops.foreign_keys and db_tables_fks is not None:
            fk_rows = db_tables_fks[
                (db_tables_fks['fkey_table_schema'] == table_schema) &
                (db_tables_fks['fkey_table_name'] == table_name)
            ]
            
            for _, fk_row in fk_rows.iterrows():
                fk_cols = db_tables_fks_cols[
                    (db_tables_fks_cols['fkey_table_schema'] == fk_row['fkey_table_schema']) &
                    (db_tables_fks_cols['fkey_table_name'] == fk_row['fkey_table_name']) &
                    (db_tables_fks_cols['fk_name'] == fk_row['fk_name'])
                ]
                create_table_lines.append(get_fk_sql(fk_row, fk_cols, db_type) + ";")

        # Add defaults if requested
        if script_table_ops.defaults and db_defaults is not None:
            default_rows = db_defaults[
                (db_defaults['table_schema'] == table_schema) &
                (db_defaults['table_name'] == table_name)
            ]
            
            for _, default_row in default_rows.iterrows():
                create_table_lines.append(get_default_sql(db_type, default_row))
            create_table_lines.append("")

        # Add check constraints if requested
        if script_table_ops.check_constraints and db_check_constraints is not None:
            check_rows = db_check_constraints[
                (db_check_constraints['table_schema'] == table_schema) &
                (db_check_constraints['table_name'] == table_name)
            ]
            
            for _, check_row in check_rows.iterrows():
                create_table_lines.append(get_check_constraint_sql(check_row))

        # Add extended properties for MSSQL
        if db_type == DBType.MSSQL and script_table_ops.extended_props and db_ext_props is not None:
            ext_prop_rows = db_ext_props[
                (db_ext_props['table_schema'] == table_schema) &
                (db_ext_props['table_name'] == table_name) &
                (db_ext_props['class'] == 1)
            ]
            
            for _, ext_prop_row in ext_prop_rows.iterrows():
                create_table_lines.append(get_ext_prop_sql(ext_prop_row, "TABLE", False, False))

        return True, "\n".join(create_table_lines).strip(), None

    except Exception as e:
        error_msg = f"Error occurred: {str(e)}"
        return False, None, error_msg