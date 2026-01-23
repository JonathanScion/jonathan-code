from src.defs.script_defs import DBType, DBSyntax, ScriptingOptions
from src.utils import funcs as utils

# GeneratePreDropPostAddIndexesFKs
def generate_pre_drop_post_add_indexes_fks(db_type: DBType, j2_index_pre_drop, j2_index_post_add,
                                          j2_fk_pre_drop, j2_fk_post_add,
                                          j2_cc_pre_drop, j2_cc_post_add,
                                          pre_add_constraints_data_checks):
    """Generate SQL statements for dropping and adding indexes and foreign keys."""
    
    # Indexes pre-drop
    j2_index_pre_drop.write("--Dropping indexes that are different or their columns are different\n")
    
    if db_type == DBType.MSSQL:
        j2_index_pre_drop.write("DECLARE @is_unique_constraint BIT, @is_primary_key BIT\n")
        j2_index_pre_drop.write("DECLARE preDropIdx CURSOR FAST_FORWARD \n")
        j2_index_pre_drop.write("FOR \n")
        j2_index_pre_drop.write("\tSELECT  I.table_schema , \n")
        j2_index_pre_drop.write("\t\tI.table_name, \n")
        j2_index_pre_drop.write("\t\tI.index_name, I.is_unique_constraint,I.is_primary_key \n")
        j2_index_pre_drop.write("\tFROM    #ScriptIndexes I INNER JOIN #ScriptTables T ON I.table_schema=T.table_schema AND I.table_name=T.table_name\n")
        j2_index_pre_drop.write("\tWHERE (indexStat in (2,3) or I.col_diff=1 or db_col_diff=1) AND (T.tableStat NOT IN (1,2) OR T.tableStat IS NULL) --extra, different, or diferent in index columns or in DB columns (meaning they require index, so cannot have index on them) \n")
        j2_index_pre_drop.write("\t\tOPEN preDropIdx \n")
        j2_index_pre_drop.write("FETCH NEXT FROM preDropIdx INTO @table_schema, @table_name, @index_name,@is_unique_constraint,@is_primary_key \n")
        j2_index_pre_drop.write("WHILE @@FETCH_STATUS = 0  \n")
        j2_index_pre_drop.write("\tBEGIN \n")
        j2_index_pre_drop.write("\t\tIF (@is_unique_constraint=1 OR @is_primary_key=1) \n")
        j2_index_pre_drop.write("\t\tBEGIN\n")
        utils.add_print(db_type, 3, j2_index_pre_drop, "'Table ['+@table_schema+'].['+@table_name+']: dropping constraint ['+@index_name+']'")
        j2_index_pre_drop.write("\t\t\tSET @sqlCode = 'ALTER TABLE ['+@table_schema+'].['+@table_name+'] DROP CONSTRAINT ['+@index_name+'];' \n")
        j2_index_pre_drop.write("\t\tEND\n")
        j2_index_pre_drop.write("\t\tELSE\n")
        j2_index_pre_drop.write("\t\tBEGIN\n")
        utils.add_print(db_type, 3, j2_index_pre_drop, "'Table ['+@table_schema+'].['+@table_name+']: dropping index ['+@index_name+']'")
        j2_index_pre_drop.write("\t\t\tSET @sqlCode = 'DROP INDEX ['+@index_name+'] ON ['+@table_schema+'].['+@table_name+'];' \n")
        j2_index_pre_drop.write("\t\tEND\n")
        utils.add_exec_sql(db_type, 1, j2_index_pre_drop)
        j2_index_pre_drop.write("\n")
        j2_index_pre_drop.write("\tFETCH NEXT FROM preDropIdx INTO @table_schema, @table_name, @index_name,@is_unique_constraint,@is_primary_key \n")
        j2_index_pre_drop.write("END\n")
        j2_index_pre_drop.write("\n")
        j2_index_pre_drop.write("CLOSE preDropIdx\n")
        j2_index_pre_drop.write("DEALLOCATE preDropIdx\n")
    
    elif db_type == DBType.PostgreSQL:
        j2_index_pre_drop.write("\tdeclare temprow record;\n")
        j2_index_pre_drop.write("\tBEGIN\n")
        j2_index_pre_drop.write("\t\tFOR temprow IN\n")
        j2_index_pre_drop.write("\t\t\tSELECT  I.table_schema,\n")
        j2_index_pre_drop.write("\t\t\t\tI.table_name,\n")
        j2_index_pre_drop.write("\t\t\t\tI.index_name, I.is_unique_constraint, I.is_primary_key\n")
        j2_index_pre_drop.write("\t\t\tFROM    ScriptIndexes I INNER JOIN ScriptTables T ON LOWER(I.table_schema) = LOWER(T.table_schema) AND LOWER(I.table_name) = LOWER(T.table_name)\n")
        j2_index_pre_drop.write("\t\t\tWHERE (indexStat in (2,3) or I.col_diff=true or db_col_diff=true) AND (T.tableStat NOT IN (1,2) OR T.tableStat IS NULL)\n")
        j2_index_pre_drop.write("\t\tLOOP\n")
        j2_index_pre_drop.write("\t\t\tIF (temprow.is_unique_constraint = true OR temprow.is_primary_key = true) THEN\n")
        utils.add_print(db_type, 4, j2_index_pre_drop, "'Table ' || temprow.table_schema || '.' || temprow.table_name || ': dropping constraint ' || temprow.index_name ")
        j2_index_pre_drop.write("\t\t\t\tsqlCode := 'ALTER TABLE ' || temprow.table_schema || '.' || temprow.table_name || ' DROP CONSTRAINT ' || temprow.index_name || ';';\n")
        j2_index_pre_drop.write("\t\t\tELSE\n")
        utils.add_print(db_type, 4, j2_index_pre_drop, "'Table ' || temprow.table_schema || '.' || temprow.table_name || ': dropping index ' || temprow.index_name")
        j2_index_pre_drop.write("\t\t\t\tsqlCode := 'DROP INDEX ' || temprow.index_name || ';';\n")
        j2_index_pre_drop.write("\t\t\tEND IF;\n")
        utils.add_exec_sql(db_type, 3, j2_index_pre_drop)
        j2_index_pre_drop.write("\t\tEND LOOP;\n")
        j2_index_pre_drop.write("\tEND;\n")

    j2_index_pre_drop.write("\n")

    # Indexes post-add
    j2_index_post_add.write("--Add indexes: new, or ones dropped before because they were different or underlying columns where different\n")
    
    if db_type == DBType.MSSQL:
        j2_index_post_add.write("DECLARE @is_unique BIT\n") 
        j2_index_post_add.write("DECLARE postAddIdx CURSOR FAST_FORWARD \n")
        j2_index_post_add.write("FOR \n")
        j2_index_post_add.write("\tSELECT  I.table_schema , \n")
        j2_index_post_add.write("\t\tI.table_name, \n")
        j2_index_post_add.write("\t\tI.index_name, \n")
        j2_index_post_add.write("\t\tI.SQL_CREATE \n")
        
        if pre_add_constraints_data_checks:
            j2_index_post_add.write("\t\t,is_unique, GotBadData,SQL_CheckUnqData \n")
        
        j2_index_post_add.write("\tFROM    #ScriptIndexes I INNER JOIN #ScriptTables T ON I.table_schema=T.table_schema AND I.table_name=T.table_name\n")
        j2_index_post_add.write("\tWHERE (indexStat in (1,3) OR I.col_diff=1 OR db_col_diff=1) AND (T.tableStat NOT IN (1,2) OR T.tableStat IS NULL) --extra, different, or diferent in index columns or in DB columns (meaning they require index, so cannot have index on them) \n")
        j2_index_post_add.write("\t\tOPEN postAddIdx \n")
        
        if pre_add_constraints_data_checks:
            j2_index_post_add.write("FETCH NEXT FROM postAddIdx INTO @table_schema, @table_name, @index_name, @SQL_CREATE,@is_unique, @GotBadData,@SQL_CheckUnqData\n")
        else:
            j2_index_post_add.write("FETCH NEXT FROM postAddIdx INTO @table_schema, @table_name, @index_name, @SQL_CREATE\n")
        
        j2_index_post_add.write("WHILE @@FETCH_STATUS = 0  \n")
        j2_index_post_add.write("\tBEGIN \n")
        utils.add_print(db_type, 2, j2_index_post_add, "'Table ['+@table_schema+'].['+@table_name+']: adding index ['+@index_name+']'")
        
        if pre_add_constraints_data_checks:
            j2_index_post_add.write("\t\tIF (@is_unique=1)\n")
            j2_index_post_add.write("\t\tBEGIN\n")
            j2_index_post_add.write("\t\t\tif (@GotBadData=1)\n")
            j2_index_post_add.write("\t\t\tBEGIN\n")
            utils.add_print(db_type, 4, j2_index_post_add, "'Error: '''+@index_name +''' cannot be added since there are duplicates in the data'")
            utils.add_print(db_type, 4, j2_index_post_add, "'To find those records, run: '+@SQL_CheckUnqData")
            j2_index_post_add.write("\t\t\tEND\n")
            j2_index_post_add.write("\t\t\tELSE\n")
            j2_index_post_add.write("\t\t\tBEGIN\n")
            utils.add_print(db_type, 4, j2_index_post_add, "'No problematic data. Unique index\\constraint will be added'")
            j2_index_post_add.write("\t\t\t\tSET @sqlCode = @SQL_CREATE \n")
            utils.add_exec_sql(db_type, 4, j2_index_post_add)
            j2_index_post_add.write("\t\t\tEND\n")
            j2_index_post_add.write("\t\tEND\n")
            j2_index_post_add.write("\t\tELSE\n")
            j2_index_post_add.write("\t\tBEGIN\n")
            j2_index_post_add.write("\t\t\tSET @sqlCode = @SQL_CREATE \n")
            utils.add_exec_sql(db_type, 3, j2_index_post_add)
            j2_index_post_add.write("\t\tEND\n")
        else:
            j2_index_post_add.write("\t\tSET @sqlCode = @SQL_CREATE \n")
            utils.add_exec_sql(db_type, 2, j2_index_post_add)
        
        j2_index_post_add.write("\n")
        
        if pre_add_constraints_data_checks:
            j2_index_post_add.write("\tFETCH NEXT FROM postAddIdx INTO @table_schema, @table_name, @index_name, @SQL_CREATE,@is_unique, @GotBadData,@SQL_CheckUnqData\n")
        else:
            j2_index_post_add.write("\tFETCH NEXT FROM postAddIdx INTO @table_schema, @table_name, @index_name, @SQL_CREATE\n")
        
        j2_index_post_add.write("END\n")
        j2_index_post_add.write("\n")
        j2_index_post_add.write("CLOSE postAddIdx\n")
        j2_index_post_add.write("DEALLOCATE postAddIdx\n")
    
    elif db_type == DBType.PostgreSQL:
        j2_index_post_add.write("\tdeclare temprow record;\n")
        j2_index_post_add.write("\tBEGIN\n")
        j2_index_post_add.write("\t\tFOR temprow IN\n")
        j2_index_post_add.write("\t\t\tSELECT  I.table_schema,\n")
        j2_index_post_add.write("\t\t\t\tI.table_name,\n")
        j2_index_post_add.write("\t\t\t\tI.index_name,\n")
        j2_index_post_add.write("\t\t\t\tI.sql_create\n")

        if pre_add_constraints_data_checks:
            j2_index_post_add.write("\t\t\t\t,is_unique, I.GotBadData, I.SQL_CheckUnqData\n")

        j2_index_post_add.write("\t\t\tFROM    ScriptIndexes I INNER JOIN ScriptTables T ON LOWER(I.table_schema) = LOWER(T.table_schema) AND LOWER(I.table_name) = LOWER(T.table_name)\n")
        j2_index_post_add.write("\t\t\tWHERE (indexStat in (1,3) OR I.col_diff=true OR db_col_diff=true) AND (T.tableStat NOT IN (1,2) OR T.tableStat IS NULL)\n")
        j2_index_post_add.write("\t\tLOOP\n")

        if pre_add_constraints_data_checks:
            j2_index_post_add.write("\t\t\tIF (temprow.is_unique = true) THEN\n")
            j2_index_post_add.write("\t\t\t\tif (temprow.GotBadData = true) THEN\n")
            utils.add_print(db_type, 5, j2_index_post_add, "'Error: ''' || temprow.index_name || ''' cannot be added since there are duplicates in the data'")
            utils.add_print(db_type, 5, j2_index_post_add, "'To find those records, run: ' || REPLACE(temprow.SQL_CheckUnqData, 'PERFORM','SELECT')")
            j2_index_post_add.write("\t\t\t\tELSE\n")
            utils.add_print(db_type, 5, j2_index_post_add, "'No problematic data. Unique index\\constraint will be added'")
            utils.add_exec_sql(db_type, 5, j2_index_post_add, "temprow.SQL_CREATE")
            j2_index_post_add.write("\t\t\t\tEND IF;\n")
            j2_index_post_add.write("\t\t\tELSE\n")
            utils.add_exec_sql(db_type, 4, j2_index_post_add, "temprow.SQL_CREATE")
            j2_index_post_add.write("\t\t\tEND IF;\n")
        else:
            utils.add_print(db_type, 3, j2_index_post_add, "'Table ' || temprow.table_schema || '.' || temprow.table_name || ': adding index ' || temprow.index_name")
            j2_index_post_add.write("\t\t\tsqlCode := temprow.SQL_CREATE;\n")
            utils.add_exec_sql(db_type, 3, j2_index_post_add)

        j2_index_post_add.write("\t\tEND LOOP;\n")
        j2_index_post_add.write("\tEND;\n")

    j2_index_post_add.write("\n")

    # FKs pre-drop
    j2_fk_pre_drop.write("--Dropping foreign keys that are different or their columns are different\n")
    
    if db_type == DBType.MSSQL:
        j2_fk_pre_drop.write("DECLARE preDropFKs CURSOR FAST_FORWARD \n")
        j2_fk_pre_drop.write("FOR \n")
        j2_fk_pre_drop.write("\tSELECT  FK.fkey_table_schema , \n")
        j2_fk_pre_drop.write("\t\tFK.fkey_table_name, \n")
        j2_fk_pre_drop.write("\t\tFK.fk_name \n")
        j2_fk_pre_drop.write("\tFROM    #ScriptFKs  FK INNER JOIN #ScriptTables T on FK.fkey_table_schema=T.table_schema AND FK.fkey_table_name=T.table_name \n")
        j2_fk_pre_drop.write("\tWHERE (fkStat in (2,3) or FK.col_diff=1 or db_col_diff=1 OR indx_col_diff=1) AND (T.tableStat NOT IN (2) OR T.tableStat IS NULL)--extra, different, or diferent in index columns or in DB columns (meaning they require index, so cannot have index on them) also changes on indexes that are on columns tha tthis FK uses (requires re-creating the FK)\n")
        j2_fk_pre_drop.write("\t\tOPEN preDropFKs \n")
        j2_fk_pre_drop.write("FETCH NEXT FROM preDropFKs INTO @table_schema, @table_name, @fk_name \n")
        j2_fk_pre_drop.write("WHILE @@FETCH_STATUS = 0  \n")
        j2_fk_pre_drop.write("\tBEGIN \n")
        utils.add_print(db_type, 1, j2_fk_pre_drop, "'Table ['+@table_schema+'].['+@table_name+']: dropping foreign key ['+@fk_name+']'")
        j2_fk_pre_drop.write("\t\tSET @sqlCode = 'ALTER TABLE ['+@table_schema+'].['+@table_name+'] DROP CONSTRAINT ['+@fk_name+'];'\n")
        utils.add_exec_sql(db_type, 1, j2_fk_pre_drop)
        j2_fk_pre_drop.write("\n")
        j2_fk_pre_drop.write("\tFETCH NEXT FROM preDropFKs INTO @table_schema, @table_name, @fk_name \n")
        j2_fk_pre_drop.write("END\n")
        j2_fk_pre_drop.write("\n")
        j2_fk_pre_drop.write("CLOSE preDropFKs\n")
        j2_fk_pre_drop.write("DEALLOCATE preDropFKs\n")
    
    elif db_type == DBType.PostgreSQL:
        j2_fk_pre_drop.write("\tdeclare temprow record;\n")
        j2_fk_pre_drop.write("\tBEGIN\n")
        j2_fk_pre_drop.write("\t\tFOR temprow IN\n")
        j2_fk_pre_drop.write("\t\t\tSELECT  FK.fkey_table_schema,\n")
        j2_fk_pre_drop.write("\t\t\t\tFK.fkey_table_name,\n")
        j2_fk_pre_drop.write("\t\t\t\tFK.fk_name\n")
        j2_fk_pre_drop.write("\t\t\tFROM    ScriptFKs  FK INNER JOIN ScriptTables T on LOWER(FK.fkey_table_schema) = LOWER(T.table_schema) AND LOWER(FK.fkey_table_name) = LOWER(T.table_name)\n")
        j2_fk_pre_drop.write("\t\t\tWHERE (fkStat in (2,3) or FK.col_diff=true or db_col_diff=true OR indx_col_diff=true) AND (T.tableStat NOT IN (2) OR T.tableStat IS NULL)\n")
        j2_fk_pre_drop.write("\t\tLOOP\n")
        utils.add_print(db_type, 3, j2_fk_pre_drop, "'Table ' || temprow.fkey_table_schema ||'.' || temprow.fkey_table_name || ': dropping foreign key ' || temprow.fk_name ")
        j2_fk_pre_drop.write("\t\t\tsqlCode := 'ALTER TABLE ' || temprow.fkey_table_schema || '.' || temprow.fkey_table_name || ' DROP CONSTRAINT ' || temprow.fk_name || ';';\n")
        utils.add_exec_sql(db_type, 3, j2_fk_pre_drop)
        j2_fk_pre_drop.write("\t\tEND LOOP;\n")
        j2_fk_pre_drop.write("\tEND;\n")

    j2_fk_pre_drop.write("\n")

    # FKs post-add
    j2_fk_post_add.write("--Add foreign keys: new, or ones dropped before because they were different or underlying columns where different\n")
    
    if db_type == DBType.MSSQL:
        j2_fk_post_add.write("DECLARE postAddFKs CURSOR FAST_FORWARD \n")
        j2_fk_post_add.write("FOR \n")
        j2_fk_post_add.write("\tSELECT  FK.fkey_table_schema , \n")
        j2_fk_post_add.write("\t\tFK.fkey_table_name, \n")
        j2_fk_post_add.write("\t\tFK.fk_name, \n")
        j2_fk_post_add.write("\t\tFK.SQL_CREATE \n")
        
        if pre_add_constraints_data_checks:
            j2_fk_post_add.write("\t\t,SQL_CheckFKData, GotBadData \n")
        
        j2_fk_post_add.write("\tFROM    #ScriptFKs FK INNER JOIN #ScriptTables T on FK.fkey_table_schema=T.table_schema AND FK.fkey_table_name=T.table_name \n")
        j2_fk_post_add.write("\tWHERE (fkStat in (1,3) or FK.col_diff=1 OR db_col_diff=1 OR indx_col_diff=1)  AND (T.tableStat NOT IN (2) OR T.tableStat IS NULL)--extra, different, or diferent in index columns or in DB columns (meaning they require index, so cannot have index on them) also changes on indexes that are on columns tha tthis FK uses (requires re-creating the FK) AND: i do add FKs on tables just added (tableStat=1) because i dont add them in the CREATE table (maybe they ref a table that doesn't exist at that point or that needs an index added on these columns that's not there yet. FKs should be added only when all tabels and indexes are in)\n")
        j2_fk_post_add.write("\t\tOPEN postAddFKs \n")
        
        if pre_add_constraints_data_checks:
            j2_fk_post_add.write("FETCH NEXT FROM postAddFKs INTO @table_schema, @table_name, @fk_name, @SQL_CREATE,@SQL_CheckFKData, @GotBadData\n")
        else:
            j2_fk_post_add.write("FETCH NEXT FROM postAddFKs INTO @table_schema, @table_name, @fk_name, @SQL_CREATE\n")
        
        j2_fk_post_add.write("WHILE @@FETCH_STATUS = 0  \n")
        j2_fk_post_add.write("\tBEGIN \n")
        utils.add_print(db_type, 1, j2_fk_post_add, "'Table ['+@table_schema+'].['+@table_name+']: adding foreign key ['+@fk_name+']'")
        
        if pre_add_constraints_data_checks:
            utils.add_print(db_type, 2, j2_fk_post_add, "'Before adding this foreign key, a check is made to see if there are any data exceptions'")
            j2_fk_post_add.write("\t\tif (@GotBadData=1)\n")
            j2_fk_post_add.write("\t\tBEGIN\n")
            utils.add_print(db_type, 5, j2_fk_post_add, "'Error: '''+@fk_name +''' cannot be added since there are child records without parents'")
            utils.add_print(db_type, 5, j2_fk_post_add, "'To find those records, run: '+@SQL_CheckFKData")
            j2_fk_post_add.write("\t\tEND\n")
            j2_fk_post_add.write("\t\tELSE\n")
            j2_fk_post_add.write("\t\tBEGIN\n")
            utils.add_print(db_type, 3, j2_fk_post_add, "'No problematic data. Foreign key will be added'")
            j2_fk_post_add.write("\t\t\tSET @sqlCode = @SQL_CREATE \n")
            utils.add_exec_sql(db_type, 3, j2_fk_post_add)
            j2_fk_post_add.write("\t\tEND\n")
        else:
            j2_fk_post_add.write("\t\tSET @sqlCode = @SQL_CREATE \n")
            utils.add_exec_sql(db_type, 2, j2_fk_post_add)
        
        j2_fk_post_add.write("\n")
        
        if pre_add_constraints_data_checks:
            j2_fk_post_add.write("\tFETCH NEXT FROM postAddFKs INTO @table_schema, @table_name, @fk_name, @SQL_CREATE,@SQL_CheckFKData,@GotBadData\n")
        else:
            j2_fk_post_add.write("\tFETCH NEXT FROM postAddFKs INTO @table_schema, @table_name, @fk_name, @SQL_CREATE\n")
        
        j2_fk_post_add.write("END\n")
        j2_fk_post_add.write("\n")
        j2_fk_post_add.write("CLOSE postAddFKs\n")
        j2_fk_post_add.write("DEALLOCATE postAddFKs\n")
    
    elif db_type == DBType.PostgreSQL:
        j2_fk_post_add.write("\tdeclare temprow record;\n")
        j2_fk_post_add.write("\tBEGIN\n")
        j2_fk_post_add.write("\t\tFOR temprow IN\n")
        j2_fk_post_add.write("\t\t\tSELECT  FK.fkey_table_schema,\n")
        j2_fk_post_add.write("\t\t\t\tFK.fkey_table_name,\n")
        j2_fk_post_add.write("\t\t\t\tFK.fk_name,\n")
        j2_fk_post_add.write("\t\t\t\tFK.SQL_CREATE\n")

        if pre_add_constraints_data_checks:
            j2_fk_post_add.write("\t\t\t\t, FK.SQL_CheckFKData, FK.GotBadData\n")

        j2_fk_post_add.write("\t\t\tFROM    ScriptFKs FK INNER JOIN ScriptTables T on LOWER(FK.fkey_table_schema) = LOWER(T.table_schema) AND LOWER(FK.fkey_table_name) = LOWER(T.table_name)\n")
        j2_fk_post_add.write("\t\t\tWHERE (fkStat in (1,3) or FK.col_diff=True OR db_col_diff=True OR indx_col_diff=True)  AND (T.tableStat NOT IN (2) OR T.tableStat IS NULL)\n")
        j2_fk_post_add.write("\t\tLOOP\n")
        utils.add_print(db_type, 3, j2_fk_post_add, "'Table ' || temprow.fkey_table_schema || '.' || temprow.fkey_table_name || ': adding foreign key ' || temprow.fk_name")

        if pre_add_constraints_data_checks:
            utils.add_print(db_type, 3, j2_fk_post_add, "'Before adding this foreign key, a check is made to see if there are any data exceptions'")
            j2_fk_post_add.write("\t\t\tif (temprow.GotBadData=true) THEN\n")
            utils.add_print(db_type, 4, j2_fk_post_add, "'Error: ''' || temprow.fk_name || ''' cannot be added since there are child records without parents'")
            utils.add_print(db_type, 4, j2_fk_post_add, "'To find those records, run: ' || REPLACE(temprow.SQL_CheckFKData, 'PERFORM','SELECT')")
            j2_fk_post_add.write("\t\t\tELSE\n")
            utils.add_print(db_type, 4, j2_fk_post_add, "'No problematic data. Foreign key will be added'")
            utils.add_exec_sql(db_type, 4, j2_fk_post_add, "temprow.SQL_CREATE")
            j2_fk_post_add.write("\t\t\tEND IF;\n")
        else:
            utils.add_exec_sql(db_type, 3, j2_fk_post_add, "temprow.SQL_CREATE")

        j2_fk_post_add.write("\t\tEND LOOP;\n")
        j2_fk_post_add.write("\tEND;\n")

    j2_fk_post_add.write("\n")

    # Check Constraints pre-drop
    j2_cc_pre_drop.write("--Dropping check constraints that are different or extra\n")

    if db_type == DBType.MSSQL:
        j2_cc_pre_drop.write("DECLARE preDropCCs CURSOR FAST_FORWARD \n")
        j2_cc_pre_drop.write("FOR \n")
        j2_cc_pre_drop.write("\tSELECT CC.table_schema, \n")
        j2_cc_pre_drop.write("\t\tCC.table_name, \n")
        j2_cc_pre_drop.write("\t\tCC.constraint_name \n")
        j2_cc_pre_drop.write("\tFROM #ScriptCheckConstraints CC \n")
        j2_cc_pre_drop.write("\tINNER JOIN #ScriptTables T ON CC.table_schema = T.table_schema AND CC.table_name = T.table_name \n")
        j2_cc_pre_drop.write("\tWHERE ccStat IN (2, 3) AND (T.tableStat NOT IN (2) OR T.tableStat IS NULL) \n")
        j2_cc_pre_drop.write("\t\tOPEN preDropCCs \n")
        j2_cc_pre_drop.write("FETCH NEXT FROM preDropCCs INTO @table_schema, @table_name, @constraint_name \n")
        j2_cc_pre_drop.write("WHILE @@FETCH_STATUS = 0 \n")
        j2_cc_pre_drop.write("\tBEGIN \n")
        utils.add_print(db_type, 1, j2_cc_pre_drop, "'Table ['+@table_schema+'].['+@table_name+']: dropping check constraint ['+@constraint_name+']'")
        j2_cc_pre_drop.write("\t\tSET @sqlCode = 'ALTER TABLE ['+@table_schema+'].['+@table_name+'] DROP CONSTRAINT ['+@constraint_name+'];'\n")
        utils.add_exec_sql(db_type, 1, j2_cc_pre_drop)
        j2_cc_pre_drop.write("\n")
        j2_cc_pre_drop.write("\tFETCH NEXT FROM preDropCCs INTO @table_schema, @table_name, @constraint_name \n")
        j2_cc_pre_drop.write("END\n")
        j2_cc_pre_drop.write("\n")
        j2_cc_pre_drop.write("CLOSE preDropCCs\n")
        j2_cc_pre_drop.write("DEALLOCATE preDropCCs\n")

    elif db_type == DBType.PostgreSQL:
        j2_cc_pre_drop.write("\tdeclare temprow record;\n")
        j2_cc_pre_drop.write("\tBEGIN\n")
        j2_cc_pre_drop.write("\t\tFOR temprow IN\n")
        j2_cc_pre_drop.write("\t\t\tSELECT CC.table_schema,\n")
        j2_cc_pre_drop.write("\t\t\t\tCC.table_name,\n")
        j2_cc_pre_drop.write("\t\t\t\tCC.constraint_name\n")
        j2_cc_pre_drop.write("\t\t\tFROM ScriptCheckConstraints CC\n")
        j2_cc_pre_drop.write("\t\t\tINNER JOIN ScriptTables T ON LOWER(CC.table_schema) = LOWER(T.table_schema) AND LOWER(CC.table_name) = LOWER(T.table_name)\n")
        j2_cc_pre_drop.write("\t\t\tWHERE ccStat IN (2, 3) AND (T.tableStat NOT IN (2) OR T.tableStat IS NULL)\n")
        j2_cc_pre_drop.write("\t\tLOOP\n")
        utils.add_print(db_type, 3, j2_cc_pre_drop, "'Table ' || temprow.table_schema || '.' || temprow.table_name || ': dropping check constraint ' || temprow.constraint_name")
        j2_cc_pre_drop.write("\t\t\tsqlCode := 'ALTER TABLE ' || temprow.table_schema || '.' || temprow.table_name || ' DROP CONSTRAINT ' || temprow.constraint_name || ';';\n")
        utils.add_exec_sql(db_type, 3, j2_cc_pre_drop)
        j2_cc_pre_drop.write("\t\tEND LOOP;\n")
        j2_cc_pre_drop.write("\tEND;\n")

    j2_cc_pre_drop.write("\n")

    # Check Constraints post-add
    j2_cc_post_add.write("--Adding check constraints: new or ones dropped before because they were different\n")

    if db_type == DBType.MSSQL:
        j2_cc_post_add.write("DECLARE postAddCCs CURSOR FAST_FORWARD \n")
        j2_cc_post_add.write("FOR \n")
        j2_cc_post_add.write("\tSELECT CC.table_schema, \n")
        j2_cc_post_add.write("\t\tCC.table_name, \n")
        j2_cc_post_add.write("\t\tCC.constraint_name, \n")
        j2_cc_post_add.write("\t\tCC.constraint_definition \n")
        j2_cc_post_add.write("\tFROM #ScriptCheckConstraints CC \n")
        j2_cc_post_add.write("\tINNER JOIN #ScriptTables T ON CC.table_schema = T.table_schema AND CC.table_name = T.table_name \n")
        j2_cc_post_add.write("\tWHERE ccStat IN (1, 3) AND (T.tableStat NOT IN (2) OR T.tableStat IS NULL) \n")
        j2_cc_post_add.write("\t\tOPEN postAddCCs \n")
        j2_cc_post_add.write("FETCH NEXT FROM postAddCCs INTO @table_schema, @table_name, @constraint_name, @constraint_definition \n")
        j2_cc_post_add.write("WHILE @@FETCH_STATUS = 0 \n")
        j2_cc_post_add.write("\tBEGIN \n")
        utils.add_print(db_type, 1, j2_cc_post_add, "'Table ['+@table_schema+'].['+@table_name+']: adding check constraint ['+@constraint_name+']'")
        j2_cc_post_add.write("\t\tSET @sqlCode = 'ALTER TABLE ['+@table_schema+'].['+@table_name+'] ADD CONSTRAINT ['+@constraint_name+'] '+@constraint_definition\n")
        utils.add_exec_sql(db_type, 1, j2_cc_post_add)
        j2_cc_post_add.write("\n")
        j2_cc_post_add.write("\tFETCH NEXT FROM postAddCCs INTO @table_schema, @table_name, @constraint_name, @constraint_definition \n")
        j2_cc_post_add.write("END\n")
        j2_cc_post_add.write("\n")
        j2_cc_post_add.write("CLOSE postAddCCs\n")
        j2_cc_post_add.write("DEALLOCATE postAddCCs\n")

    elif db_type == DBType.PostgreSQL:
        j2_cc_post_add.write("\tdeclare temprow record;\n")
        j2_cc_post_add.write("\tBEGIN\n")
        j2_cc_post_add.write("\t\tFOR temprow IN\n")
        j2_cc_post_add.write("\t\t\tSELECT CC.table_schema,\n")
        j2_cc_post_add.write("\t\t\t\tCC.table_name,\n")
        j2_cc_post_add.write("\t\t\t\tCC.constraint_name,\n")
        j2_cc_post_add.write("\t\t\t\tCC.constraint_definition\n")
        j2_cc_post_add.write("\t\t\tFROM ScriptCheckConstraints CC\n")
        j2_cc_post_add.write("\t\t\tINNER JOIN ScriptTables T ON LOWER(CC.table_schema) = LOWER(T.table_schema) AND LOWER(CC.table_name) = LOWER(T.table_name)\n")
        j2_cc_post_add.write("\t\t\tWHERE ccStat IN (1, 3) AND (T.tableStat NOT IN (2) OR T.tableStat IS NULL)\n")
        j2_cc_post_add.write("\t\tLOOP\n")
        utils.add_print(db_type, 3, j2_cc_post_add, "'Table ' || temprow.table_schema || '.' || temprow.table_name || ': adding check constraint ' || temprow.constraint_name")
        j2_cc_post_add.write("\t\t\tsqlCode := 'ALTER TABLE ' || temprow.table_schema || '.' || temprow.table_name || ' ADD CONSTRAINT ' || temprow.constraint_name || ' ' || temprow.constraint_definition || ';';\n")
        utils.add_exec_sql(db_type, 3, j2_cc_post_add)
        j2_cc_post_add.write("\t\tEND LOOP;\n")
        j2_cc_post_add.write("\tEND;\n")

    j2_cc_post_add.write("\n")