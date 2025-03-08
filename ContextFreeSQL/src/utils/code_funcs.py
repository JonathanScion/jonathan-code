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