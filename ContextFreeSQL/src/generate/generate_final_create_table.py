from dataclasses import dataclass
from enum import Enum
from typing import Optional, List, Tuple
import pandas as pd
from src.defs.script_defs import DBType, DBSyntax, ScriptingOptions, ScriptTableOptions, DBEntScriptState
from src.data_load.from_db.load_from_db_pg import DBSchema
from typing import List, Dict, Any
from io import StringIO
from src.utils import funcs as utils, code_funcs 


def get_create_table_from_sys_tables(
    db_type: DBType,
    table_schema: str,
    table_name: str,
    schema_tables : DBSchema,
    script_table_ops: Optional[ScriptTableOptions] = None,
    force_allow_null: bool = False,
    pre_add_constraints_data_checks: bool = False,    #!tbd
    as_temp_table: bool = False
) -> tuple[str, str]:
    
    try:
        out_script = None
        out_err = None
        
        if script_table_ops is None:
            script_table_ops = ScriptTableOptions()
        
        db_syntax = DBSyntax.get_syntax(db_type)

        # Get the table information
        table_rows = schema_tables.tables[
            (schema_tables.tables['entschema'] == table_schema) & 
            (schema_tables.tables['entname'] == table_name)
        ]
        
        if len(table_rows) == 0:
            return ("","could not find table in the result set: {table_schema}.{table_name}")
        
        table_row = table_rows.iloc[0]
        create_table_lines = []

        # Determine full table name based on DB type
        if script_table_ops.table_name and script_table_ops.table_name.strip():
            full_table_name = script_table_ops.table_name.strip()
        else: #table name not overriden. MP
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

        # Build a dict of column defaults for inline inclusion (PostgreSQL)
        col_defaults = {}
        if script_table_ops.defaults and schema_tables.defaults is not None:
            default_rows = schema_tables.defaults[
                (schema_tables.defaults['table_schema'] == table_schema) &
                (schema_tables.defaults['table_name'] == table_name)
            ]
            for _, default_row in default_rows.iterrows():
                col_defaults[default_row['col_name']] = default_row['default_definition']

        col_num = 0
        for idx, col_row in col_rows.iterrows():
            col_num += 1
            col_sql = get_col_sql(
                col_row, table_row['table_schema'], table_row['table_name'],
                DBEntScriptState.InLine, db_type, script_table_ops.column_identity, force_allow_null
            ).strip()

            # For PostgreSQL, include DEFAULT inline with the column
            if db_type == DBType.PostgreSQL and col_row['col_name'] in col_defaults:
                col_sql += f" DEFAULT {col_defaults[col_row['col_name']]}"

            if col_num < len(col_rows):
                col_sql += ","
            create_table_lines.append(col_sql)

        create_table_lines.append(");")

        
        
        if script_table_ops.indexes and schema_tables.indexes is not None:
            idx_rows = schema_tables.indexes[
                schema_tables.indexes['object_id'] == table_row['object_id']
            ]

            # First pass: output PRIMARY KEY constraints first
            for _, idx_row in idx_rows.iterrows():
                if not utils.val_if_null(idx_row.get('is_primary_key'), False):
                    continue  # Skip non-PK indexes in first pass

                if db_type == DBType.MSSQL:
                    idx_cols = schema_tables.index_cols[
                        (schema_tables.index_cols['object_id'] == table_row['object_id']) &
                        (schema_tables.index_cols['index_id'] == idx_row['index_id'])
                    ]
                else:
                    idx_cols = schema_tables.index_cols[
                        (schema_tables.index_cols['object_id'] == table_row['object_id']) &
                        (schema_tables.index_cols['index_name'] == idx_row['index_name'])
                    ]
                index_sql = get_index_sql(idx_row, idx_cols, db_type)
                create_table_lines.append(index_sql + ";")

            # Second pass: output regular indexes (non-PK)
            for _, idx_row in idx_rows.iterrows():
                if utils.val_if_null(idx_row.get('is_primary_key'), False):
                    continue  # Skip PK indexes in second pass

                if db_type == DBType.MSSQL:
                    idx_cols = schema_tables.index_cols[
                        (schema_tables.index_cols['object_id'] == table_row['object_id']) &
                        (schema_tables.index_cols['index_id'] == idx_row['index_id'])
                    ]
                else:
                    idx_cols = schema_tables.index_cols[
                        (schema_tables.index_cols['object_id'] == table_row['object_id']) &
                        (schema_tables.index_cols['index_name'] == idx_row['index_name'])
                    ]
                index_sql = get_index_sql(idx_row, idx_cols, db_type)
                create_table_lines.append(index_sql + ";")

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
                create_table_lines.append(get_fk_sql(fk_row.to_dict(), fk_cols, db_type) + ";")
        
        #defaults - only add as separate ALTER statements for MSSQL (PostgreSQL includes them inline)
        if db_type == DBType.MSSQL and script_table_ops.defaults and schema_tables.defaults is not None:
            default_rows = schema_tables.defaults[
                (schema_tables.defaults['table_schema'] == table_schema) &
                (schema_tables.defaults['table_name'] == table_name)
            ]

            for _, default_row in default_rows.iterrows():
                create_table_lines.append(get_default_sql(db_type, default_row.to_dict()))

        return ("\n".join(create_table_lines),"")
    
    except Exception as e:
        return ("", str(e))



        """to be completed later, once we do MSSQL, if at all
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
        return "\n".join(create_table_lines).strip()


    
def get_col_sql(
    sys_cols_row: pd.Series, 
    table_schema: str, 
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
            sql.append(f"[{table_schema}].[{table_name}] ")
        else:
            sql.append(f"{table_schema}.{table_name} ")

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
        sql.append(f"[{actual_type}]")
    else:
        sql.append(f"{actual_type}")

    # Add size, precision, scale (assuming Utils.AddSizePrecisionScale is implemented elsewhere)
    type_size_prec_scale = code_funcs.add_size_precision_scale(sys_cols_row)
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
                    print_warning = (f"PRINT 'Field {table_schema}.{table_name}.{sys_cols_row['col_name']} "
                                   "needs to have an Identity on it, but this cannot be done via script. "
                                   "Make sure to add Identity to that field via enterprise manager'\n")
                else:
                    sql.append(f" IDENTITY ({sys_cols_row['seed_value']},{sys_cols_row['increment_value']})")
        else:
            extra_val = str(sys_cols_row.get('EXTRA', ''))
            if 'auto_increment' in extra_val.lower():
                sql.append(" AUTO_INCREMENT")

    return "".join(sql)



def get_index_sql(index_row: Dict[str, Any], index_cols_rows: pd.DataFrame, db_type: DBType, in_line: bool = False) -> str:
    buffer = StringIO()
    
    if utils.val_if_null(index_row.get('is_primary_key'), False):
        if db_type == DBType.MSSQL:
            if not in_line:
                buffer.write(f"ALTER TABLE [{index_row['table_schema']}].[{index_row['table_name']}] WITH NOCHECK ADD\n")
            buffer.write(f"CONSTRAINT [{index_row['name']}] PRIMARY KEY {index_row['type_desc']}\n")
            buffer.write("(\n")
            
            if not index_cols_rows:
                raise Exception(f"Internal Error: Primary Key '{index_row['index_name']}' on table [{index_row['table_schema']}].[{index_row['table_name']}] has no columns")
            
            for col in index_cols_rows.to_dict('records'):
                if col is None:
                    raise Exception(f"Primary Key '{index_row['index_name']}' has an unknown field")
                
                buffer.write(f"[{col['col_name']}]")
                if utils.c_to_bool(col.get('is_descending_key'), False):
                    buffer.write(" DESC")
                buffer.write(",\n")
            
            buffer.seek(buffer.tell() - 2)  # Remove last comma
            buffer.write("\n)")
            
            if 'is_padded' in index_row:
                buffer.write("\nWITH (")
                buffer.write(f"PAD_INDEX = {'ON' if utils.c_to_bool(index_row.get('is_padded'), False) else 'OFF'},")
                buffer.write(f"STATISTICS_NORECOMPUTE = {'ON' if utils.c_to_bool(index_row.get('no_recompute'), False) else 'OFF'},")
                buffer.write(f"IGNORE_DUP_KEY = {'ON' if utils.c_to_bool(index_row.get('ignore_dup_key'), False) else 'OFF'},")
                buffer.write(f"ALLOW_ROW_LOCKS = {'ON' if utils.c_to_bool(index_row.get('allow_row_locks'), False) else 'OFF'},")
                buffer.write(f"ALLOW_PAGE_LOCKS = {'ON' if utils.c_to_bool(index_row.get('allow_page_locks'), False) else 'OFF'}")
                
                if utils.val_if_null(index_row.get('fill_factor'), 0) != 0:
                    buffer.write(f", FILLFACTOR = {index_row['fill_factor']}")
                buffer.write(")\n")
                
        elif db_type == DBType.MySQL:
            if not in_line:
                buffer.write(f"ALTER TABLE {index_row['table_name']} ADD\n")
            buffer.write(f"PRIMARY KEY {'CLUSTERED ' if index_row['type'] == 1 else ''}\n")
            buffer.write("(\n")
            
            if not index_cols_rows:
                raise Exception(f"Internal Error: Primary Key '{index_row['index_name']}' on table {index_row['table_name']} has no columns")
            
            for col in index_cols_rows.to_dict('records'):
                if col is None:
                    raise Exception(f"Primary Key '{index_row['index_name']}' has an unknown field")
                
                buffer.write(col['name'])
                if utils.c_to_bool(col.get('is_descending_key'), False):
                    buffer.write(" DESC")
                buffer.write(",\n")
            
            buffer.seek(buffer.tell() - 2)  # Remove last comma
            buffer.write("\n)\n")
            
        elif db_type == DBType.PostgreSQL:
            # Generate single-line format to match pg_indexes output
            if index_cols_rows.empty:
                raise Exception(f"Internal Error: Primary Key '{index_row['index_name']}' on table {index_row['table_schema']}.{index_row['table_name']} has no columns")

            cols = []
            for col in index_cols_rows.to_dict('records'):
                if col is None:
                    raise Exception(f"Primary Key '{index_row['index_name']}' has an unknown field")
                col_str = col['name']
                if utils.c_to_bool(col.get('is_descending_key'), False):
                    col_str += " DESC"
                cols.append(col_str)

            if not in_line:
                buffer.write(f"ALTER TABLE {index_row['table_schema']}.{index_row['table_name']} ADD CONSTRAINT {index_row['index_name']} PRIMARY KEY ({', '.join(cols)})")
            
    elif utils.val_if_null(index_row.get('is_unique_constraint'), False):
        if db_type == DBType.MSSQL:
            if not in_line:
                buffer.write(f"ALTER TABLE [{index_row['table_schema']}].[{index_row['table_name']}] WITH NOCHECK ADD\n")
            buffer.write(f"CONSTRAINT [{index_row['name']}] UNIQUE {'CLUSTERED ' if index_row['type'] == 1 else ''}\n")
            buffer.write("(\n")
            
            if not index_cols_rows:
                raise Exception(f"Internal Error: Index '{index_row['index_name']}' on table [{index_row['table_schema']}].[{index_row['table_name']}] has no columns")
            
            for col in index_cols_rows.to_dict('records'):
                if col is None:
                    raise Exception(f"Unique Constraint '{col['col_name']}' has an unknown field")
                
                buffer.write(f"[{col['col_name']}]")
                if utils.c_to_bool(col.get('is_descending_key'), False):
                    buffer.write(" DESC")
                buffer.write(",\n")
            
            buffer.seek(buffer.tell() - 2)  # Remove last comma
            buffer.write("\n)")
            
        else:  # MySQL and PostgreSQL
            table_ref = (f"{index_row['table_schema']}.{index_row['table_name']}"
                        if db_type == DBType.PostgreSQL else index_row['table_name'])

            if index_cols_rows.empty:
                raise Exception(f"Internal Error: Index '{index_row['index_name']}' on table {table_ref} has no columns")

            cols = []
            for col in index_cols_rows.to_dict('records'):
                if col is None:
                    raise Exception(f"Unique Constraint '{index_row['index_name']}' has an unknown field")
                col_str = col['col_name']
                if utils.c_to_bool(col.get('is_descending_key'), False):
                    col_str += " DESC"
                cols.append(col_str)

            if db_type == DBType.PostgreSQL:
                # Single-line format for PostgreSQL
                if not in_line:
                    buffer.write(f"ALTER TABLE {table_ref} ADD CONSTRAINT {index_row['index_name']} UNIQUE ({', '.join(cols)})")
            else:
                # Multi-line format for MySQL
                if not in_line:
                    buffer.write(f"ALTER TABLE {table_ref} ADD\n")
                    buffer.write(f"CONSTRAINT {index_row['index_name']} UNIQUE\n")
                else:
                    buffer.write(f"UNIQUE KEY {index_row['index_name']}\n")
                buffer.write(f"({', '.join(cols)})\n")
            
    else:  # Regular index
        if db_type == DBType.MSSQL:
            buffer.write("CREATE ")
            if utils.val_if_null(index_row.get('is_unique'), False):
                buffer.write("UNIQUE ")
            buffer.write("CLUSTERED " if index_row.get('type') == 1 else "NONCLUSTERED ")
            buffer.write(f"INDEX [{index_row['name']}]\n")
            buffer.write(f"ON [{index_row['table_schema']}].[{index_row['table_name']}]\n")
            buffer.write("(\n")
            
            included_cols = []
            if not index_cols_rows:
                raise Exception(f"Internal Error: Index '{index_row['index_name']}' on table [{index_row['table_schema']}].[{index_row['table_name']}] has no columns")
            
            for col in index_cols_rows.to_dict('records'): 
                if utils.val_if_null(col.get('is_included_column'), 0):
                    included_cols.append(col['col_name'])
                    continue
                    
                if col is None:
                    raise Exception(f"Index '{index_row['index_name']}' has an unknown field")
                
                buffer.write(f"[{col['col_name']}]")
                if utils.c_to_bool(col.get('is_descending_key'), False):
                    buffer.write(" DESC")
                buffer.write(",\n")
            
            buffer.seek(buffer.tell() - 2)  # Remove last comma
            buffer.write("\n)")
            
            if included_cols:
                buffer.write(f"\nINCLUDE ({', '.join(included_cols)})")
            
            if 'has_filter' in index_row and utils.c_to_bool(index_row.get('has_filter'), False):
                buffer.write(f"\nWHERE {index_row['filter_definition']}")
                
            if 'is_padded' in index_row:
                buffer.write("\nWITH (")
                buffer.write(f"PAD_INDEX = {'ON' if utils.c_to_bool(index_row.get('is_padded'), False) else 'OFF'},")
                buffer.write(f"STATISTICS_NORECOMPUTE = {'ON' if utils.c_to_bool(index_row.get('no_recompute'), False) else 'OFF'},")
                buffer.write(f"IGNORE_DUP_KEY = {'ON' if utils.c_to_bool(index_row.get('ignore_dup_key'), False) else 'OFF'},")
                buffer.write(f"ALLOW_ROW_LOCKS = {'ON' if utils.c_to_bool(index_row.get('allow_row_locks'), False) else 'OFF'},")
                buffer.write(f"ALLOW_PAGE_LOCKS = {'ON' if utils.c_to_bool(index_row.get('allow_page_locks'), False) else 'OFF'}")
                
                if utils.val_if_null(index_row.get('fill_factor'), 0) != 0:
                    buffer.write(f", FILLFACTOR = {index_row['fill_factor']}")
                buffer.write(")\n")
                
        else:  # MySQL and PostgreSQL
            table_ref = (f"{index_row['table_schema']}.{index_row['table_name']}"
                        if db_type == DBType.PostgreSQL else index_row['table_name'])

            if index_cols_rows.empty:
                raise Exception(f"Internal Error: Index '{index_row['index_name']}' on table {table_ref} has no columns")

            cols = []
            for col in index_cols_rows.to_dict('records'):
                if col is None:
                    raise Exception(f"Index '{index_row['index_name']}' has an unknown field")
                col_str = col['col_name']
                if utils.c_to_bool(col.get('is_descending_key'), False):
                    col_str += " DESC"
                cols.append(col_str)

            if db_type == DBType.PostgreSQL:
                # Single-line format to match pg_indexes output: CREATE [UNIQUE] INDEX name ON table USING btree (cols)
                buffer.write("CREATE ")
                if utils.c_to_bool(index_row.get('is_unique'), False):
                    buffer.write("UNIQUE ")
                buffer.write(f"INDEX {index_row['index_name']} ON {table_ref} USING btree ({', '.join(cols)})")
            else:
                # Multi-line format for MySQL
                buffer.write("CREATE ")
                if utils.c_to_bool(index_row.get('is_unique'), False):
                    buffer.write("UNIQUE ")
                buffer.write(f"INDEX {index_row['index_name']}\n")
                buffer.write(f"ON {table_ref}\n")
                buffer.write(f"({', '.join(cols)})\n")
    
    result = buffer.getvalue()
    buffer.close()
    return result

def get_fk_sql(fk_row: Dict[str, Any], fk_cols_rows: pd.DataFrame, db_type: DBType, from_rndph: bool = False) -> str:
    buffer = StringIO()
    
    if db_type == DBType.MSSQL:
        buffer.write(f"ALTER TABLE [{fk_row['fkey_table_schema']}].[{fk_row['fkey_table_name']}] ADD ")
        buffer.write(f"CONSTRAINT [{fk_row['fk_name']}] FOREIGN KEY\n")
        buffer.write("(\n")
        
        if fk_cols_rows.empty:
            raise Exception(f"Internal Error: foreign key '{fk_row['fk_name']}' (on table [{fk_row['fkey_table_schema']}].[{fk_row['fkey_table_name']}]) has no fields defined for it for the table")
        
        # Write foreign key columns
        for col in fk_cols_rows.to_dict('records'):
            buffer.write(f"[{col['fkey_col_name']}],\n")
            
        buffer.seek(buffer.tell() - 2)  # Remove last comma
        buffer.write("\n)")
        
        # Write referenced table and columns
        buffer.write(f"\nREFERENCES [{fk_row['rkey_table_schema']}].[{fk_row['rkey_table_name']}]\n")
        buffer.write("(\n")
        
        # Write referenced columns
        for col in fk_cols_rows.to_dict('records'):
            buffer.write(f"[{col['rkey_col_name']}],\n")
            
        buffer.seek(buffer.tell() - 2)  # Remove last comma
        buffer.write("\n)")
        
        # Add ON UPDATE/DELETE actions
        #!cascade actions... for later. (is it on MSSQL only)
        # if fk_row.get('update_referential_action', 0) != 0:
        #     buffer.write(f" ON UPDATE {c_fk_cascade_action_tsql(fk_row['update_referential_action'])}\n")
        # if fk_row.get('delete_referential_action', 0) != 0:
        #     buffer.write(f" ON DELETE {c_fk_cascade_action_tsql(fk_row['delete_referential_action'])}\n")
        
        if utils.val_if_null(fk_row.get('is_not_for_replication'), False):
            buffer.write(" NOT FOR REPLICATION")
            
    elif db_type == DBType.MySQL:
        buffer.write(f"ALTER TABLE {fk_row['fkey_table_name']} ADD ")
        buffer.write(f"CONSTRAINT {fk_row['fk_name']} FOREIGN KEY\n")
        buffer.write("(\n")
        
        if fk_cols_rows.empty:
            raise Exception(f"Internal Error: foreign key '{fk_row['fk_name']}' (on table {fk_row['fkey_table_name']}) has no fields defined for it for the table")
        
        # Write foreign key columns
        for col in fk_cols_rows.to_dict('records'):
            buffer.write(f"{col['fkey_col_name']},\n")
            
        buffer.seek(buffer.tell() - 2)  # Remove last comma
        buffer.write("\n)")
        
        # Write referenced table and columns
        buffer.write(f"\nREFERENCES {fk_row['rkey_table_name']}\n")
        buffer.write("(\n")
        
        # Write referenced columns
        for col in fk_cols_rows.to_dict('records'):
            buffer.write(f"{col['rkey_col_name']},\n")
            
        buffer.seek(buffer.tell() - 2)  # Remove last comma
        buffer.write("\n)")
        
        # Add MySQL comments if present
        if 'mysql_comments' in fk_row and fk_row['mysql_comments'] is not None:
            buffer.write(f" {fk_row['mysql_comments']}")
            
    elif db_type == DBType.PostgreSQL:
        buffer.write(f"ALTER TABLE {fk_row['fkey_table_schema']}.{fk_row['fkey_table_name']} ADD ")
        buffer.write(f"CONSTRAINT {fk_row['fk_name']} FOREIGN KEY\n")
        buffer.write("(\n")
        
        if fk_cols_rows.empty:
            raise Exception(f"Internal Error: foreign key '{fk_row['fk_name']}' (on table {fk_row['fkey_table_schema']}.{fk_row['fkey_table_name']}) has no fields defined for it for the table")
        
        # Write foreign key columns
        for col in fk_cols_rows.to_dict('records'):
            buffer.write(f"{col['fkey_col_name']},\n")
            
        buffer.seek(buffer.tell() - 2)  # Remove last comma
        buffer.write("\n)")
        
        # Write referenced table and columns
        buffer.write(f"\nREFERENCES {fk_row['rkey_table_schema']}.{fk_row['rkey_table_name']}\n")
        buffer.write("(\n")
        
        # Write referenced columns
        for col in fk_cols_rows.to_dict('records'):
            buffer.write(f"{col['rkey_col_name']},\n")
            
        buffer.seek(buffer.tell() - 2)  # Remove last comma
        buffer.write("\n)")
    
    buffer.write("\n")
    result = buffer.getvalue()
    buffer.close()
    return result

def get_default_sql(db_type: DBType, default_row: Dict[str, Any]) -> str:
    buffer = StringIO()
    
    if db_type == DBType.MSSQL:
        buffer.write(f"ALTER TABLE [{default_row['table_schema']}].[{default_row['table_name']}] ")
        buffer.write(f"ADD CONSTRAINT {default_row['default_name']} DEFAULT ")
        buffer.write(f"{default_row['default_definition']} FOR [{default_row['col_name']}];")
        
    elif db_type == DBType.PostgreSQL:
        buffer.write(f"ALTER TABLE {default_row['table_schema']}.{default_row['table_name']} ")
        buffer.write(f"ALTER COLUMN {default_row['col_name']} ")
        buffer.write(f"SET DEFAULT {default_row['default_definition']};")
    
    result = buffer.getvalue()
    buffer.close()
    return result