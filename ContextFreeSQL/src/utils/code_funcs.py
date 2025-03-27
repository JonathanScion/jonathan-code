from src.defs.script_defs import DBType
from io import StringIO
from src.utils import funcs as utils

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


def append_commit_changes(buffer: StringIO):    
    # Commit transaction block
    buffer.write("COMMIT TRANSACTION;\n")
    buffer.write("END TRY\n")
    buffer.write("BEGIN CATCH\n")
    buffer.write("SELECT \n")
    buffer.write("ERROR_NUMBER() AS ErrorNumber,\n")
    buffer.write("ERROR_SEVERITY() AS ErrorSeverity,\n")
    buffer.write("ERROR_STATE() as ErrorState,\n")
    buffer.write("--ERROR_PROCEDURE() as ErrorProcedure,\n")
    buffer.write("ERROR_LINE() as ErrorLine,\n")
    buffer.write("ERROR_MESSAGE() as ErrorMessage;\n")
    buffer.write("\n")
    
    # Transaction state checking
    buffer.write("-- Test XACT_STATE for 1 or -1.\n")
    buffer.write("-- XACT_STATE = 0 means there is no transaction and\n")
    buffer.write("-- a commit or rollback operation would generate an error.\n")
    buffer.write("\n")
    
    # Check uncommittable state
    buffer.write("-- Test whether the transaction is uncommittable.\n")
    buffer.write("If (XACT_STATE()) = -1\n")
    buffer.write("BEGIN\n")
    buffer.write("\tPrint N'The transaction is in an uncommittable state. '\n")
    buffer.write("\t+ 'Rolling back transaction. No Changes were made to the database'\n")
    buffer.write("\tROLLBACK TRANSACTION;\n")
    buffer.write("END;\n")
    
    # Check committable state
    buffer.write("-- Test whether the transaction is active and valid.\n")
    buffer.write("If (XACT_STATE()) = 1\n")
    buffer.write("BEGIN\n")
    buffer.write("\tPrint N'The transaction is committable. '\n")
    buffer.write("\t+ 'Committing transaction. Only changes mentioned above were committed'\n")
    buffer.write("\tCOMMIT TRANSACTION;   \n")
    buffer.write("END;\n")
    buffer.write("END CATCH\n")
    buffer.write("\n")

def add_size_precision_scale(row_col):
        type_name_field = "typename"
        length_field = "max_length"
        precision_field = "precision"
        scale_field = "scale"
        
        type_name = str(row_col[type_name_field])
        
        if type_name.lower() in ["varchar", "char", "nvarchar", "nchar", "binary", "varbinary", "text", "ntext"]:
            if row_col[length_field] == 0:
                return " (max) "  # In SQL 2005+ this means max size
            else:
                if type_name.lower() in ["nchar", "nvarchar"]:
                    # Unicode: trim to half-size
                    if row_col[length_field] == -1:
                        return " (max) "
                    else:
                        return f" ({int(row_col[length_field] / 2)}) "
                elif type_name.lower() in ["text", "ntext"]:
                    return ""  # Never specify size for text/ntext
                else:
                    if row_col[length_field] == -1:
                        return " (max) "
                    else:
                        return f" ({row_col[length_field]}) "
        elif type_name.lower() in ["decimal", "numeric"]:
            return f" ({row_col[precision_field]},{row_col[scale_field]}) "
        else:
            return ""  # Don't add anything for other types


def add_value_to_sql_str(db_type, col_name, col_var_name, user_type_name, indent, field_values_builder):
    """
    Converts the VB.NET AddVarValueToSQLStr function to Python.
    Adds formatted variable values to SQL string based on data type.
    """
    if db_type == DBType.MSSQL:
        field_values_builder.append(f"{indent}IF @{col_var_name} IS NULL\n")
        field_values_builder.append(f"{indent}\tSET @sqlCode+='NULL'\n")
        field_values_builder.append(f"{indent}ELSE\n")
        
        # Check if it's a datetime or string type
        is_datetime = False
        if not utils.is_type_string(user_type_name, is_datetime):
            if is_datetime:
                field_values_builder.append(f"{indent}\tSET @sqlCode+=''''+CAST(@{col_var_name} AS varchar(30))+''''\n")
            else:
                field_values_builder.append(f"{indent}\tSET @sqlCode+=CAST(@{col_var_name} AS varchar(30))\n")
        else:
            field_values_builder.append(f"{indent}\tSET @sqlCode+= ''''+@{col_var_name}+''''\n")
        
    elif db_type == DBType.PostgreSQL:
        field_values_builder.append(f"{indent}IF (temprow.{col_name} IS NULL) THEN\n")
        field_values_builder.append(f"{indent}\tsqlCode = sqlCode || 'NULL';\n")
        field_values_builder.append(f"{indent}ELSE\n")
        
        # Check if it's a datetime or string type
        is_datetime = False
        if not utils.is_type_string(user_type_name, is_datetime):
            if is_datetime:
                field_values_builder.append(f"{indent}\tsqlCode = sqlCode || '''' || CAST(temprow.{col_name} AS varchar(30)) || '''';\n")
            else:
                field_values_builder.append(f"{indent}\tsqlCode = sqlCode || CAST(temprow.{col_name} AS varchar(30));\n")
        else:
            field_values_builder.append(f"{indent}\tsqlCode = sqlCode || '''' || temprow.{col_name} ||'''';\n")
        
        field_values_builder.append(f"{indent}END IF;\n")
        field_values_builder.append("\n")