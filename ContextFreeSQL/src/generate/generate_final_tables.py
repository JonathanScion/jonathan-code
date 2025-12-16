from io import StringIO
from src.defs.script_defs import DBType, DBSyntax, ScriptingOptions
from src.utils import funcs as utils

def generate_drop_tables(db_type: DBType, sql_buffer: StringIO):
    """Generate SQL statements for dropping tables that need to be dropped."""
    
    sql_buffer.write("\n")
    sql_buffer.write("--Dropping Tables that need to be dropped:\n")
    
    if db_type == DBType.MSSQL:
        sql_buffer.write("DECLARE tablesDrop CURSOR FAST_FORWARD \n")
        sql_buffer.write("FOR \n")
        sql_buffer.write("\tSELECT  table_schema , \n")
        sql_buffer.write("\t\ttable_name \n")
        sql_buffer.write("\tFROM    #ScriptTables \n")
        sql_buffer.write("\tWHERE tableStat=2 \n")
        sql_buffer.write("\t\tOPEN tablesDrop \n")
        sql_buffer.write("FETCH NEXT FROM tablesDrop INTO @table_schema, @table_name \n")
        sql_buffer.write("WHILE @@FETCH_STATUS = 0  \n")
        sql_buffer.write("\tBEGIN \n")
        utils.add_print(db_type, 1, sql_buffer, "'Dropping ['+@table_schema+'].['+@table_name+']:'")
        sql_buffer.write("\t\tSET @sqlCode = 'DROP TABLE ['+@table_schema+'].['+@table_name+'];' --to be consistent, this must be in ScriptTables.SQL_DROP. (right now we only got it on extra tables) some extra work to create it there... oh well. so far no harm \n")
        utils.add_exec_sql(db_type, 1, sql_buffer)
        sql_buffer.write("\n")
        sql_buffer.write("\tFETCH NEXT FROM tablesDrop INTO @table_schema, @table_name \n")
        sql_buffer.write("END\n")
        sql_buffer.write("\n")
        sql_buffer.write("CLOSE tablesDrop\n")
        sql_buffer.write("DEALLOCATE tablesDrop\n")
        sql_buffer.write("\n")
    
    elif db_type == DBType.PostgreSQL:
        sql_buffer.write("\tdeclare temprow record;\n")
        sql_buffer.write("\tBEGIN\n")
        sql_buffer.write("\t\tFOR temprow IN\n")
        sql_buffer.write("\t\t\tSelect s.table_schema , s.table_name\n")
        sql_buffer.write("\t\t\tFROM ScriptTables s\n")
        sql_buffer.write("\t\t\tWHERE tableStat = 2\n")
        sql_buffer.write("\t\tLOOP\n")
        utils.add_print(db_type, 3, sql_buffer, "'Table ' || temprow.table_schema || '.' || temprow.table_name || ' is different. Drop and then add:'")
        utils.add_exec_sql(db_type, 3, sql_buffer, "'DROP TABLE ' || temprow.table_schema || '.' || temprow.table_name")
        sql_buffer.write("\t\tEND LOOP;\n")
        sql_buffer.write("\tEND; --of cursor\n")



def generate_add_tables(db_type: DBType, sql_buffer: StringIO):
    """Generate SQL statements for adding new tables or those that were modified."""
    
    if db_type == DBType.MSSQL:
        sql_buffer.write("--Adding new entities and ones that were modified\n")
        sql_buffer.write("DECLARE tableAdd CURSOR FAST_FORWARD \n")
        sql_buffer.write("FOR \n")
        sql_buffer.write("\tSELECT  table_schema , \n")
        sql_buffer.write("\t\ttable_name, \n")
        sql_buffer.write("\t\tSQL_CREATE \n")
        sql_buffer.write("\tFROM    #ScriptTables \n")
        sql_buffer.write("\tWHERE tableStat=1 \n")
        sql_buffer.write("\t\tOPEN tableAdd \n")
        sql_buffer.write("FETCH NEXT FROM tableAdd INTO @table_schema, @table_name,@SQL_CREATE \n")
        sql_buffer.write("WHILE @@FETCH_STATUS = 0  \n")
        sql_buffer.write("\tBEGIN \n")
        utils.add_print(db_type, 1, sql_buffer, "'Adding table ['+@table_schema+'].['+@table_name+']'")
        sql_buffer.write("\t\tSET @sqlCode = @SQL_CREATE \n")
        utils.add_exec_sql(db_type, 1, sql_buffer)
        sql_buffer.write("\n")
        sql_buffer.write("\tFETCH NEXT FROM tableAdd INTO @table_schema, @table_name, @SQL_CREATE \n")
        sql_buffer.write("END\n")
        sql_buffer.write("\n")
        sql_buffer.write("CLOSE tableAdd\n")
        sql_buffer.write("DEALLOCATE tableAdd\n")
    
    elif db_type == DBType.PostgreSQL:
        sql_buffer.write("\tdeclare temprow record;\n")
        sql_buffer.write("\tBEGIN\n")
        sql_buffer.write("\t\tFOR temprow IN\n")
        sql_buffer.write("\t\t\tSelect s.table_schema , s.table_name, s.SQL_CREATE\n")
        sql_buffer.write("\t\t\tFROM ScriptTables s\n")
        sql_buffer.write("\t\t\tWHERE tableStat = 1\n")
        sql_buffer.write("\t\tLOOP\n")
        utils.add_print(db_type, 3, sql_buffer, "'Adding table ' || temprow.table_schema || '.' || temprow.table_name")
        utils.add_exec_sql(db_type, 3, sql_buffer, "temprow.SQL_CREATE")
        sql_buffer.write("\t\tEND LOOP;\n")
        sql_buffer.write("\tEND; --of cursor\n")