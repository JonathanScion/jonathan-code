from src.defs.script_defs import DBType

def get_code_check_unq_data(db_type: DBType, full_table_name, index_cols_rows):
    sql_check = []
    
    # Start with the appropriate SELECT or PERFORM statement
    if db_type == DBType.MSSQL:
        sql_check.append("SELECT ")
    elif db_type == DBType.PostgreSQL:
        sql_check.append("PERFORM ")  # because it's in a batch
    
    # Build the list of fields
    fields_list = []
    for row in index_cols_rows:
        fields_list.append(row['col_name'])
    
    # Add fields to the SQL
    sql_check.append(','.join(fields_list))
    
    # Complete the statement
    sql_check.append(f", COUNT(*) as NumRecords FROM {full_table_name}")
    sql_check.append(f" GROUP BY {','.join(fields_list)} HAVING COUNT(*) > 1")
    
    # Return the combined SQL statement
    return ''.join(sql_check)


def get_code_check_fk_data(db_type: DBType, row_fk, rows_fk_cols):
    sql_check = []
    
    # Start with the appropriate SELECT or PERFORM statement
    if db_type == DBType.MSSQL:
        sql_check.append("SELECT ")
    elif db_type == DBType.PostgreSQL:
        sql_check.append("PERFORM ")  # because it's in a batch
    
    # Build the list of fields
    fields_list = []
    for row_fk_col in rows_fk_cols:
        if db_type == DBType.MSSQL:
            fields_list.append(f"FKEY.[{row_fk_col['fkey_col_name']}]")
        elif db_type == DBType.PostgreSQL:
            fields_list.append(f"FKEY.{row_fk_col['fkey_col_name']}")
    
    # Add fields to the SQL
    sql_check.append(','.join(fields_list))
    
    # Add FROM clause with appropriate table formatting
    if db_type == DBType.MSSQL:
        fkey_table = f"[{row_fk['fkey_table_schema']}].[{row_fk['fkey_table_name']}]"
        rkey_table = f"[{row_fk['rkey_table_schema']}].[{row_fk['rkey_table_name']}]"
    elif db_type == DBType.PostgreSQL:
        fkey_table = f"{row_fk['fkey_table_schema']}.{row_fk['fkey_table_name']}]"
        rkey_table = f"{row_fk['rkey_table_schema']}.{row_fk['rkey_table_name']}]"
    
    #!non of this code, above and below, was ever tested.
    sql_check.append(f" FROM {row_fk['fkey_table_name']} FKEY")
    sql_check.append(f" LEFT JOIN {row_fk['rkey_table_name']} RKEY")
    
    # Add ON clause for join conditions
    join_conditions = []
    for row_fk_col in rows_fk_cols:
        if db_type == DBType.MSSQL:
            join_conditions.append(f"FKEY.[{row_fk_col['fkey_col_name']}]=RKEY.[{row_fk_col['rkey_col_name']}]")
        elif db_type == DBType.PostgreSQL:
            join_conditions.append(f"FKEY.{row_fk_col['fkey_col_name']}=RKEY.{row_fk_col['rkey_col_name']}")
    
    sql_check.append(f" ON {','.join(join_conditions)}")
    
    # Add WHERE clause
    where_conditions = []
    for row_fk_col in rows_fk_cols:
        where_conditions.append(f"(RKEY.{row_fk_col['rkey_col_name']} IS NULL AND " +
                               f"FKEY.{row_fk_col['fkey_col_name']} IS NOT NULL)")
    
    sql_check.append(f" WHERE {' OR '.join(where_conditions)}")
    
    # Return the combined SQL statement
    return ''.join(sql_check)