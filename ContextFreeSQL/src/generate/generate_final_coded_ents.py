from src.defs.script_defs import DBType, DBSyntax, ScriptingOptions
from src.utils import funcs as utils


def generate_coded_ents(db_type: DBType, sql_buffer, script_ops):
    """Generate SQL statements for handling coded entities (stored procedures, functions, etc.)."""
    
    sql_buffer.write("\n")
    
    # Drop extra entities if configured
    if script_ops.remove_all_extra_ents:
        if db_type == DBType.MSSQL:
            sql_buffer.write("--Dropping Entities that need to be dropped:\n")
            sql_buffer.write("DECLARE codedDrop CURSOR FAST_FORWARD \n")
            sql_buffer.write("FOR \n")
            sql_buffer.write("\tSELECT  ent_schema , \n")
            sql_buffer.write("\t\tent_name, \n")  # no SQL_DROP here since many of them where INSERTed live , we dont know in advance what's in the DB, so we dont have a DROP
            sql_buffer.write("\t\tent_type \n")
            sql_buffer.write("\tFROM    #ScriptCode \n")
            sql_buffer.write("\tWHERE codeStat=2 \n")
            sql_buffer.write("\t\tOPEN codedDrop \n")
            sql_buffer.write("FETCH NEXT FROM codedDrop INTO @table_schema, @table_name,@ent_type \n")
            sql_buffer.write("WHILE @@FETCH_STATUS = 0  \n")
            sql_buffer.write("\tBEGIN \n")
            utils.add_print(db_type, 1, sql_buffer, "'Dropping ['+@table_schema+'].['+@table_name+']:'")
            sql_buffer.write("\t\tSET @sqlCode = 'DROP '+@ent_type+' ['+@table_schema+'].['+@table_name+'];' \n")
            utils.add_exec_sql(db_type, 1, sql_buffer)
            sql_buffer.write("\n")
            sql_buffer.write("\tFETCH NEXT FROM codedDrop INTO @table_schema, @table_name,@ent_type \n")
            sql_buffer.write("END\n")
            sql_buffer.write("\n")
            sql_buffer.write("CLOSE codedDrop\n")
            sql_buffer.write("DEALLOCATE codedDrop\n")
            sql_buffer.write("\n")
        
        elif db_type == DBType.PostgreSQL:
            sql_buffer.write("declare temprow record;\n")
            sql_buffer.write("BEGIN\n")
            sql_buffer.write("\tFOR temprow IN \n")
            sql_buffer.write("\t\tSelect s.ent_schema , s.ent_name, s.ent_type, s.param_type_list  \n")
            sql_buffer.write("\t\tFROM ScriptCode s\n")
            sql_buffer.write("\t\tWHERE codeStat = 2\n")
            sql_buffer.write("LOOP\n")
            utils.add_print(db_type, 1, sql_buffer, "'' || temprow.ent_schema || '.' || temprow.ent_name || ' is extra. Drop this code:'")
            utils.add_exec_sql(db_type, 1, sql_buffer, "'DROP  ' || temprow.ent_type || ' ' || temprow.ent_schema || '.' || temprow.ent_name || '(' || COALESCE(temprow.param_type_list,'') || ')'")
            sql_buffer.write("\tEND LOOP;\n")
            sql_buffer.write("END; --of cursor \n")
    
    # Dropping entities that need to be altered
    sql_buffer.write("--Dropping Entities that need to be altered: (will then be added again. we don't do ALTER. just DROP-CREATE)\n")
    
    if db_type == DBType.MSSQL:
        sql_buffer.write("DECLARE codedDropPreAdd CURSOR FAST_FORWARD \n")
        sql_buffer.write("FOR \n")
        sql_buffer.write("\tSELECT  ent_schema , \n")
        sql_buffer.write("\t\tent_name, \n")  # no SQL_DROP here since many of them where INSERTed live , we dont know in advance what's in the DB, so we dont have a DROP
        sql_buffer.write("\t\tent_type \n")
        sql_buffer.write("\tFROM    #ScriptCode \n")
        sql_buffer.write("\tWHERE codeStat=3 \n")
        sql_buffer.write("\t\tOPEN codedDropPreAdd \n")
        sql_buffer.write("FETCH NEXT FROM codedDropPreAdd INTO @table_schema, @table_name,@ent_type \n")
        sql_buffer.write("WHILE @@FETCH_STATUS = 0  \n")
        sql_buffer.write("\tBEGIN \n")
        utils.add_print(db_type, 1, sql_buffer, "'['+@table_schema+'].['+@table_name+'] is different. Drop and then add:'")
        sql_buffer.write("\t\tSET @sqlCode = 'DROP '+@ent_type+' ['+@table_schema+'].['+@table_name+'];' \n")
        utils.add_exec_sql(db_type, 1, sql_buffer)
        sql_buffer.write("\n")
        sql_buffer.write("\tFETCH NEXT FROM codedDropPreAdd INTO @table_schema, @table_name,@ent_type \n")
        sql_buffer.write("END\n")
        sql_buffer.write("\n")
        sql_buffer.write("CLOSE codedDropPreAdd\n")
        sql_buffer.write("DEALLOCATE codedDropPreAdd\n")
        sql_buffer.write("\n")
    
    elif db_type == DBType.PostgreSQL:
        sql_buffer.write("\tdeclare temprow record;\n")
        sql_buffer.write("\tBEGIN\n")
        sql_buffer.write("\t\tFOR temprow IN\n")
        sql_buffer.write("\t\t\tSELECT  s.ent_schema , s.ent_name, s.ent_type, S.param_type_list \n")
        sql_buffer.write("\t\t\tFROM ScriptCode s\n")
        sql_buffer.write("\t\t\tWHERE codeStat = 3 \n")
        sql_buffer.write("\t\tLOOP\n")
        utils.add_print(db_type, 1, sql_buffer, "'' || temprow.ent_schema || '.' || temprow.ent_name || ' is different. Drop and then add:'")
        utils.add_exec_sql(db_type, 1, sql_buffer, "'DROP ' || temprow.ent_type || ' ' || temprow.ent_schema || '.' || temprow.ent_name || '(' || COALESCE(temprow.param_type_list,'') || ');'")
        sql_buffer.write("\t\tEND LOOP;\n")
        sql_buffer.write("\tEND; --of cursor \n")
    
    # Adding new or modified entities
    sql_buffer.write("--Adding new coded entities and ones that were modified\n")
    
    if db_type == DBType.MSSQL:
        sql_buffer.write("DECLARE codedAdd CURSOR FAST_FORWARD \n")
        sql_buffer.write("FOR \n")
        sql_buffer.write("\tSELECT  ent_schema , \n")
        sql_buffer.write("\t\tent_name, \n")
        sql_buffer.write("\t\tSQL_CREATE \n")
        sql_buffer.write("\tFROM    #ScriptCode \n")
        sql_buffer.write("\tWHERE codeStat IN (1,3)\n")
        sql_buffer.write("\t\tOPEN codedAdd \n")
        sql_buffer.write("FETCH NEXT FROM codedAdd INTO @table_schema, @table_name,@SQL_CREATE \n")
        sql_buffer.write("WHILE @@FETCH_STATUS = 0  \n")
        sql_buffer.write("\tBEGIN \n")
        utils.add_print(db_type, 1, sql_buffer, "'Table ['+@table_schema+'].['+@table_name+']: adding column ['+@col_name+']'")
        sql_buffer.write("\t\tSET @sqlCode = @SQL_CREATE \n")
        # Note: The original code had an additional parameter for add_exec_sql that we need to handle
        utils.add_exec_sql(db_type, 1, sql_buffer, is_batch=True)
        sql_buffer.write("\n")
        sql_buffer.write("\tFETCH NEXT FROM codedAdd INTO @table_schema, @table_name, @SQL_CREATE \n")
        sql_buffer.write("END\n")
        sql_buffer.write("\n")
        sql_buffer.write("CLOSE codedAdd\n")
        sql_buffer.write("DEALLOCATE codedAdd\n")
    
    elif db_type == DBType.PostgreSQL:
        sql_buffer.write("\tdeclare temprow record;\n")
        sql_buffer.write("\tBEGIN\n")
        sql_buffer.write("\t\tFOR temprow IN\n")
        sql_buffer.write("\t\t\tSELECT  s.ent_schema , s.ent_name, s.sql_create, s.ent_type \n")
        sql_buffer.write("\t\t\tFROM ScriptCode s\n")
        sql_buffer.write("\t\t\tWHERE codeStat IN (1,3) \n")
        sql_buffer.write("\t\tLOOP\n")
        utils.add_print(db_type, 1, sql_buffer, "'' || temprow.ent_type || ' ' || temprow.ent_schema || '.' || temprow.ent_name || ' will be added'")
        utils.add_exec_sql(db_type, 1, sql_buffer, "temprow.SQL_CREATE")
        sql_buffer.write("\t\tEND LOOP;\n")
        sql_buffer.write("\tEND; --of cursor \n")
    
    # Wrap it up
    if db_type == DBType.PostgreSQL:
        sql_buffer.write("END; --of coded entities\n")