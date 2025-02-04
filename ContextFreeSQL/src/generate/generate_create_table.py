from dataclasses import dataclass
from enum import Enum
from typing import Optional, List, Tuple
import pandas as pd
from src.defs.script_defs import DBType, DBSyntax, ScriptingOptions, ScriptTableOptions, DBEntScriptState
from src.data_load.from_db.load_from_db_pg import DBSchema

def get_create_table_from_sys_tables(
    db_type: DBType,
    table_schema: str,
    table_name: str,
    schema_tables : DBSchema,
    script_table_ops: ScriptTableOptions = None,
    force_allow_null: bool,
    pre_add_constraints_data_checks: bool = False,    
    as_temp_table: bool = False
) -> Tuple[bool, Optional[str], Optional[str]]:
  
    out_script = None
    out_err = None
    
    if script_table_ops is None:
        script_table_ops = ScriptTableOptions()
    
    try:
   
        db_syntax = DBSyntax.get_syntax(db_type)

        # Get the table information
        table_rows = schema_tables.tables[
            (schema_tables.tables['entschema'] == table_schema) & 
            (schema_tables.tables['entname'] == table_name)
        ]
        
        if len(table_rows) == 0:
            return False, None, f"could not find table in the result set: {table_schema}.{table_name}"
        
        table_row = table_rows.iloc[0]
        create_table_lines = []

        # Determine full table name based on DB type        
        if script_table_ops.table_name:  # Checks if not empty
            full_table_name = script_table_ops.table_name
        else:
            if db_type == DBType.MSSQL:
                full_table_name = f"[{table_schema}].[{table_name}]"
            else:  # MySQL or PostgreSQL
                full_table_name = f"{table_schema}.{table_name}"

        # Start CREATE TABLE statement
        if as_temp_table:
            create_table_lines.append(f"{db_syntax.temp_table_create}{full_table_name}")
        else:
            create_table_lines.append(f"CREATE TABLE {full_table_name}")
        create_table_lines.append("(")

        # Add columns
        col_rows = schema_tables.columns[
            schema_tables.columns['object_id'] == table_row['object_id']
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
        """ reactivate all below once above is working (wnat to see basic table and columns... index\fk add later)
        if script_table_ops.indexes and schema_tables.indexes is not None:
            idx_rows = schema_tables.indexes[
                schema_tables.indexes['object_id'] == table_row['object_id']
            ]
            
            for _, idx_row in idx_rows.iterrows():
                if db_type == DBType.MSSQL:
                    idx_cols = schema_tables.indexes_cols[
                        (schema_tables.indexes_cols['object_id'] == table_row['object_id']) &
                        (schema_tables.indexes_cols['index_id'] == idx_row['index_id'])
                    ]
                else:
                    idx_cols = schema_tables.indexes_cols[
                        (schema_tables.indexes_cols['object_id'] == table_row['object_id']) &
                        (schema_tables.indexes_cols['index_name'] == idx_row['index_name'])
                    ]
                
                create_table_lines.append(get_index_sql(idx_row, idx_cols, db_type) + ";")

        # Add foreign keys if requested
        if script_table_ops.foreign_keys and schema_tables.fks is not None:
            fk_rows = schema_tables.fks[
                (schema_tables.fks['fkey_table_schema'] == table_schema) &
                (schema_tables.fks['fkey_table_name'] == table_name)
            ]
            
            for _, fk_row in fk_rows.iterrows():
                fk_cols = schema_tables.fk_cols[
                    (schema_tables.fk_cols['fkey_table_schema'] == fk_row['fkey_table_schema']) &
                    (schema_tables.fk_cols['fkey_table_name'] == fk_row['fkey_table_name']) &
                    (schema_tables.fk_cols['fk_name'] == fk_row['fk_name'])
                ]
                create_table_lines.append(get_fk_sql(fk_row, fk_cols, db_type) + ";")

        # Add defaults if requested
        if script_table_ops.defaults and schema_tables.defaults is not None:
            default_rows = schema_tables.defaults[
                (schema_tables.defaults['table_schema'] == table_schema) &
                (schema_tables.defaults['table_name'] == table_name)
            ]
            
            for _, default_row in default_rows.iterrows():
                create_table_lines.append(get_default_sql(db_type, default_row))
            create_table_lines.append("")

        ""to be completed later, once we do MSSQL, if at all
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
"""
        return True, "\n".join(create_table_lines).strip(), None

    except Exception as e:
        error_msg = f"Error occurred: {str(e)}"
        return False, None, error_msg
    
    


def get_col_sql(
    sys_cols_row: pd.Series, 
    table_owner: str, 
    table_name: str, 
    script_state: DBEntScriptState, 
    db_type: DBType, 
    column_identity: bool = True, 
    force_allow_null: bool = False, 
    actual_size: bool = False
) -> str:
    sql = []

    # Check for default constraint
    has_default = False
    if 'col_default_name' in sys_cols_row.index:
        has_default = not pd.isna(sys_cols_row['col_default_name'])

    # Build ALTER TABLE part
    if script_state in [DBEntScriptState.Add, DBEntScriptState.Alter]:
        sql.append("ALTER TABLE ")
        if db_type == DBType.MSSQL:
            sql.append(f"[{table_owner}].[{table_name}] ")
        else:
            sql.append(f"{table_owner}.{table_name} ")

        if script_state == DBEntScriptState.Add:
            sql.append("ADD ")
        else:
            if db_type == DBType.MSSQL:
                sql.append("ALTER COLUMN ")
            elif db_type == DBType.PostgreSQL:
                sql.append("ALTER COLUMN ")
            elif db_type == DBType.MySQL:
                sql.append("MODIFY ")

    actual_type = str(sys_cols_row['user_type_name'])

    # Column name
    if db_type == DBType.MSSQL:
        sql.append(f"[{str(sys_cols_row['col_name'])}] ")
    elif db_type == DBType.PostgreSQL:
        sql.append(f"{str(sys_cols_row['col_name'])} ")
        if script_state == DBEntScriptState.Alter:
            sql.append(" TYPE ")
    elif db_type == DBType.MySQL:
        sql.append(f"{str(sys_cols_row['col_name'])} ")

    # Check if computed
    if sys_cols_row.get('is_computed', False):
        sql.append(f"AS {sys_cols_row['computed_definition']}")
        return "".join(sql)

    # Type
    if db_type == DBType.MSSQL:
        sql.append(f" [{actual_type}] ")
    else:
        sql.append(f" {actual_type} ")

    # Add size, precision, scale (assuming Utils.AddSizePrecisionScale is implemented elsewhere)
    type_size_prec_scale = add_size_precision_scale(sys_cols_row, actual_size)
    if type_size_prec_scale:
        sql.append(type_size_prec_scale)

    # MySQL unsigned
    if 'col_unsigned' in sys_cols_row.index:
        if sys_cols_row.get('col_unsigned', False):
            sql.append(" UNSIGNED ")

    # Collation
    collation_field = "collation_name"
    if not pd.isna(sys_cols_row.get(collation_field)):
        sql.append(f" COLLATE {sys_cols_row[collation_field]}")

    # NULL/NOT NULL
    if force_allow_null:
        sql.append(" NULL ")
    else:
        is_null_field = "is_nullable"
        if db_type == DBType.MSSQL:
            sql.append(" NULL " if sys_cols_row.get(is_null_field, False) else " NOT NULL ")
        elif db_type == DBType.PostgreSQL:
            if script_state == DBEntScriptState.Alter:
                null_value = " NULL " if sys_cols_row.get(is_null_field, False) else " NOT NULL "
                sql.append(f",\n\tALTER COLUMN {sys_cols_row['col_name']} SET {null_value}")
            else:
                sql.append(" NULL " if sys_cols_row.get(is_null_field, False) else " NOT NULL ")

    # Identity/Auto Increment
    if column_identity:
        if db_type == DBType.MSSQL:
            if sys_cols_row.get('is_Identity', False):
                if script_state == DBEntScriptState.Alter:
                    print_warning = (f"PRINT 'Field {table_owner}.{table_name}.{sys_cols_row['col_name']} "
                                   "needs to have an Identity on it, but this cannot be done via script. "
                                   "Make sure to add Identity to that field via enterprise manager'\n")
                else:
                    sql.append(f" IDENTITY ({sys_cols_row['seed_value']},{sys_cols_row['increment_value']})")
        else:
            extra_val = str(sys_cols_row.get('EXTRA', ''))
            if 'auto_increment' in extra_val.lower():
                sql.append(" AUTO_INCREMENT")

    return "".join(sql)

def add_size_precision_scale(row: pd.Series, actual_size: bool) -> str:
    # This is a placeholder - implement the actual logic based on your needs
    return ""