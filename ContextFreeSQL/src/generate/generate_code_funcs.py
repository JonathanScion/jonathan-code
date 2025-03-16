from io import StringIO
from enum import Enum
import pandas as pd
from typing import Optional, Dict, List, Tuple, Any
from src.defs.script_defs import DBType, DBSyntax, ScriptingOptions, ScriptTableOptions, DBEntScriptState
from src.utils import funcs as utils


def generate_pre_drop_post_add_indexes_fks(
    db_type: DBType,
    j2_index_pre_drop: StringIO,
    j2_index_post_add: StringIO,
    j2_fk_pre_drop: StringIO,
    j2_fk_post_add: StringIO,
    pre_add_constraints_data_checks: bool = False
) -> None:
  
    
    # ==========================================================================
    # Indexes
    # ==========================================================================
    
    # Pre-drop indexes section
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
        j2_index_pre_drop.write("\tSELECT  I.table_schema , \n")
        j2_index_pre_drop.write("\t\tI.table_name, \n")
        j2_index_pre_drop.write("\t\tI.index_name, I.is_unique_constraint,I.is_primary_key \n")
        j2_index_pre_drop.write("\tFROM    ScriptIndexes I INNER JOIN ScriptTables T ON LOWER(I.table_schema) = LOWER(T.table_schema) AND LOWER(I.table_name) = LOWER(T.table_name)\n")
        j2_index_pre_drop.write("\tWHERE (indexStat in (2,3) or I.col_diff=true or db_col_diff=true) AND (T.tableStat NOT IN (1,2) OR T.tableStat IS NULL) --extra, different, or diferent in index columns or in DB columns (meaning they require index, so cannot have index on them) \n")
        j2_index_pre_drop.write("\t\tLOOP\n")
        j2_index_pre_drop.write("\t\tIF (temprow.is_unique_constraint = true OR temprow.is_primary_key = true) THEN \n")
        utils.add_print(db_type, 3, j2_index_pre_drop, "'Table ' || temprow.table_schema || '.' || temprow.table_name || ': dropping constraint ' || temprow.index_name ")
        j2_index_pre_drop.write("\t\t\tsqlCode = 'ALTER TABLE ' || temprow.table_schema || '.' || temprow.table_name || ' DROP CONSTRAINT ' || temprow.index_name || ';'; \n")
        j2_index_pre_drop.write("\t\tELSE\n")
        utils.add_print(db_type, 3, j2_index_pre_drop, "'Table ' || temprow.table_schema || '.' || temprow.table_name || ': dropping index ' || temprow.index_name")
        j2_index_pre_drop.write("\t\t\tsqlCode = 'DROP INDEX ' || temprow.index_name || ';'; \n")
        j2_index_pre_drop.write("\t\tEND IF;\n")
        utils.add_exec_sql(db_type, 1, j2_index_pre_drop)
        j2_index_pre_drop.write("\t\tEND LOOP;\n")
        j2_index_pre_drop.write("\tEND; --off \n")
    
    j2_index_pre_drop.write("\n")

    # Post-add indexes section
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
        
        fetch_params = ",@is_unique, @GotBadData,@SQL_CheckUnqData" if pre_add_constraints_data_checks else ""
        j2_index_post_add.write(f"FETCH NEXT FROM postAddIdx INTO @table_schema, @table_name, @index_name, @SQL_CREATE {fetch_params}\n")
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
        j2_index_post_add.write(f"\tFETCH NEXT FROM postAddIdx INTO @table_schema, @table_name, @index_name, @SQL_CREATE {fetch_params}\n")
        j2_index_post_add.write("END\n")
        j2_index_post_add.write("\n")
        j2_index_post_add.write("CLOSE postAddIdx\n")
        j2_index_post_add.write("DEALLOCATE postAddIdx\n")
    
    elif db_type == DBType.PostgreSQL:
        j2_index_post_add.write("\tdeclare temprow record;\n")
        j2_index_post_add.write("\tBEGIN\n")
        j2_index_post_add.write("\t\tFOR temprow IN\n")
        j2_index_post_add.write("\tSELECT  I.table_schema , \n")
        j2_index_post_add.write("\t\tI.table_name, \n")
        j2_index_post_add.write("\t\tI.index_name, \n")
        j2_index_post_add.write("\t\tI.sql_create \n")
        
        if pre_add_constraints_data_checks:
            j2_index_post_add.write("\t\t,is_unique, I.GotBadData, I.SQL_CheckUnqData \n")
        
        j2_index_post_add.write("\tFROM    ScriptIndexes I INNER JOIN ScriptTables T ON LOWER(I.table_schema) = LOWER(T.table_schema) AND LOWER(I.table_name) = LOWER(T.table_name)\n")
        j2_index_post_add.write("\tWHERE (indexStat in (1,3) OR I.col_diff=true OR db_col_diff=true) AND (T.tableStat NOT IN (1,2) OR T.tableStat IS NULL) --extra, different, or diferent in index columns or in DB columns (meaning they require index, so cannot have index on them) \n")
        j2_index_post_add.write("\tLOOP\n")
        
        if pre_add_constraints_data_checks:
            j2_index_post_add.write("\t\tIF (temprow.is_unique = true) THEN\n")
            j2_index_post_add.write("\t\t\tif (temprow.GotBadData = true) THEN\n")
            utils.add_print(db_type, 4, j2_index_post_add, "'Error: ''' || temprow.index_name || ''' cannot be added since there are duplicates in the data'")
            utils.add_print(db_type, 4, j2_index_post_add, "'To find those records, run: ' || REPLACE(temprow.SQL_CheckUnqData, 'PERFORM','SELECT')")
            j2_index_post_add.write("\t\t\tELSE\n")
            utils.add_print(db_type, 4, j2_index_post_add, "'No problematic data. Unique index\\constraint will be added'")
            utils.add_exec_sql(db_type, 4, j2_index_post_add, "temprow.SQL_CREATE")
            j2_index_post_add.write("\t\t\tEND IF;\n")
            j2_index_post_add.write("\t\tELSE\n")
            utils.add_exec_sql(db_type, 3, j2_index_post_add, "temprow.SQL_CREATE")
            j2_index_post_add.write("\t\tEND IF;\n")
        else:
            utils.add_print(db_type, 3, j2_index_post_add, "'Table ' || table_schema || '.' || table_name || ': adding index ' || index_name")
            j2_index_post_add.write("\t\tsqlCode = temprow.SQL_CREATE; \n")
            utils.add_exec_sql(db_type, 2, j2_index_post_add)
        
        j2_index_post_add.write("\t\tEND LOOP;\n")
        j2_index_post_add.write("\tEND; --off \n")
    
    j2_index_post_add.write("\n")

    # ==========================================================================
    # Foreign Keys
    # ==========================================================================
    
    # Pre-drop FKs section
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
        j2_fk_pre_drop.write("\tSELECT  FK.fkey_table_schema , \n")
        j2_fk_pre_drop.write("\t\tFK.fkey_table_name, \n")
        j2_fk_pre_drop.write("\t\tFK.fk_name \n")
        j2_fk_pre_drop.write("\tFROM    ScriptFKs  FK INNER JOIN ScriptTables T on LOWER(FK.fkey_table_schema) = LOWER(T.table_schema) AND LOWER(FK.fkey_table_name) = LOWER(T.table_name) \n")
        j2_fk_pre_drop.write("\tWHERE (fkStat in (2,3) or FK.col_diff=true or db_col_diff=true OR indx_col_diff=true) AND (T.tableStat NOT IN (2) OR T.tableStat IS NULL)--extra, different, or diferent in index columns or in DB columns (meaning they require index, so cannot have index on them) also changes on indexes that are on columns tha tthis FK uses (requires re-creating the FK)\n")
        j2_fk_pre_drop.write("\t\tLOOP\n")
        utils.add_print(db_type, 1, j2_fk_pre_drop, "'Table ' || temprow.fkey_table_schema ||'.' || temprow.fkey_table_name || ': dropping foreign key ' || temprow.fk_name ")
        j2_fk_pre_drop.write("\t\tsqlCode = 'ALTER TABLE ' || temprow.fkey_table_schema || '.' || temprow.fkey_table_name || ' DROP CONSTRAINT ' || temprow.fk_name || ';';\n")
        utils.add_exec_sql(db_type, 1, j2_fk_pre_drop)
        j2_fk_pre_drop.write("\t\tEND LOOP;\n")
        j2_fk_pre_drop.write("\tEND; --off \n")
    
    j2_fk_pre_drop.write("\n")

    # Post-add FKs section
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
        
        fetch_params = ",@SQL_CheckFKData, @GotBadData" if pre_add_constraints_data_checks else ""
        j2_fk_post_add.write(f"FETCH NEXT FROM postAddFKs INTO @table_schema, @table_name, @fk_name, @SQL_CREATE{fetch_params}\n")
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
        j2_fk_post_add.write(f"\tFETCH NEXT FROM postAddFKs INTO @table_schema, @table_name, @fk_name, @SQL_CREATE{fetch_params}\n")
        j2_fk_post_add.write("END\n")
        j2_fk_post_add.write("\n")
        j2_fk_post_add.write("CLOSE postAddFKs\n")
        j2_fk_post_add.write("DEALLOCATE postAddFKs\n")
    
    elif db_type == DBType.PostgreSQL:
        j2_fk_post_add.write("\tdeclare temprow record;\n")
        j2_fk_post_add.write("\tBEGIN\n")
        j2_fk_post_add.write("\t\tFOR temprow IN\n")
        j2_fk_post_add.write("\tSELECT  FK.fkey_table_schema , \n")
        j2_fk_post_add.write("\t\tFK.fkey_table_name, \n")
        j2_fk_post_add.write("\t\tFK.fk_name, \n")
        j2_fk_post_add.write("\t\tFK.SQL_CREATE \n")
        
        if pre_add_constraints_data_checks:
            j2_fk_post_add.write("\t\t, FK.SQL_CheckFKData, FK.GotBadData \n")
        
        j2_fk_post_add.write("\tFROM    ScriptFKs FK INNER JOIN ScriptTables T on LOWER(FK.fkey_table_schema) = LOWER(T.table_schema) AND LOWER(FK.fkey_table_name) = LOWER(T.table_name) \n")
        j2_fk_post_add.write("\tWHERE (fkStat in (1,3) or FK.col_diff=True OR db_col_diff=True OR indx_col_diff=True)  AND (T.tableStat NOT IN (2) OR T.tableStat IS NULL)--extra, different, or diferent in index columns or in DB columns (meaning they require index, so cannot have index on them) also changes on indexes that are on columns tha tthis FK uses (requires re-creating the FK) AND: i do add FKs on tables just added (tableStat=1) because i dont add them in the CREATE table\n")
        j2_fk_post_add.write("\t\tLOOP\n")
        utils.add_print(db_type, 1, j2_fk_post_add, "'Table ' || temprow.fkey_table_schema || '.' || temprow.fkey_table_name || ': adding foreign key ' || temprow.fk_name")
        
        if pre_add_constraints_data_checks:
            utils.add_print(db_type, 2, j2_fk_post_add, "'Before adding this foreign key, a check is made to see if there are any data exceptions'")
            j2_fk_post_add.write("\t\tif (temprow.GotBadData=true) THEN\n")
            utils.add_print(db_type, 5, j2_fk_post_add, "'Error: ''' || temprow.fk_name || ''' cannot be added since there are child records without parents'")
            utils.add_print(db_type, 5, j2_fk_post_add, "'To find those records, run: ' || REPLACE(temprow.SQL_CheckFKData, 'PERFORM','SELECT')")
            j2_fk_post_add.write("\t\tELSE\n")
            utils.add_print(db_type, 3, j2_fk_post_add, "'No problematic data. Foreign key will be added'")
            utils.add_exec_sql(db_type, 3, j2_fk_post_add, "temprow.SQL_CREATE")
            j2_fk_post_add.write("\t\tEND IF;\n")
        else:
            utils.add_exec_sql(db_type, 2, j2_fk_post_add, "temprow.SQL_CREATE")
        
        j2_fk_post_add.write("\t\tEND LOOP;\n")
        j2_fk_post_add.write("\tEND; --off \n")
    
    j2_fk_post_add.write("\n")


def generate_add_alter_drop_cols(
    db_type: DBType,
    sql_buffer: StringIO,
    j2_alter_cols_not_null: StringIO,
    got_data: bool = False
) -> None:
    """
    Generates SQL scripts for adding, altering, and dropping columns
    
    Args:
        db_type: The type of database (MSSQL, PostgreSQL)
        sql_buffer: StringBuilder for SQL statements to add, alter, and drop columns
        j2_alter_cols_not_null: StringBuilder for SQL statements to set columns to NOT NULL after data is added
        got_data: Flag indicating whether data handling is included in the scripts
    """
    
    # ==========================================================================
    # Adding Columns
    # ==========================================================================
    
    sql_buffer.write("\n")
    sql_buffer.write("--Adding Columns\n")
    
    if db_type == DBType.MSSQL:
        sql_buffer.write("DECLARE misCols CURSOR FAST_FORWARD \n")
        sql_buffer.write("FOR \n")
        sql_buffer.write("\tSELECT  C.table_schema , \n")
        sql_buffer.write("\t\tC.table_name, \n")
        sql_buffer.write("\t\tC.col_name, \n")
        sql_buffer.write("\t\tC.SQL_CREATE \n")
        sql_buffer.write("\tFROM    #ScriptCols C INNER JOIN #ScriptTables T on C.table_schema=T.table_schema AND C.table_name = T.table_name \n")
        sql_buffer.write("\tWHERE colStat = 1 AND T.tableStat=3 \n")
        sql_buffer.write("\t\tOPEN misCols \n")
        sql_buffer.write("FETCH NEXT FROM misCols INTO @table_schema, @table_name, @col_name, \n")
        sql_buffer.write("\t@SQL_CREATE \n")
        sql_buffer.write("WHILE @@FETCH_STATUS = 0  \n")
        sql_buffer.write("\tBEGIN \n")
        utils.add_print(db_type, 1, sql_buffer, "'Table ['+@table_schema+'].['+@table_name+']: adding column ['+@col_name+']'")
        sql_buffer.write("\t\tSET @sqlCode = @SQL_CREATE \n")
        utils.add_exec_sql(db_type, 1, sql_buffer)
        sql_buffer.write("\n")
        sql_buffer.write("\tFETCH NEXT FROM misCols INTO @table_schema, @table_name, @col_name, \n")
        sql_buffer.write("\t\t@SQL_CREATE \n")
        sql_buffer.write("END\n")
        sql_buffer.write("\n")
        sql_buffer.write("CLOSE misCols\n")
        sql_buffer.write("DEALLOCATE misCols\n")
    
    elif db_type == DBType.PostgreSQL:
        sql_buffer.write("declare temprow record;\n")
        sql_buffer.write("BEGIN\n")
        sql_buffer.write("\tFOR temprow IN \n")
        sql_buffer.write("\t\tSELECT  C.table_schema , \n")
        sql_buffer.write("\t\tC.table_name, \n")
        sql_buffer.write("\t\tC.col_name, \n")
        sql_buffer.write("\t\tC.SQL_CREATE \n")
        sql_buffer.write("\t\tFROM    ScriptCols C INNER JOIN ScriptTables T on LOWER(C.table_schema) = LOWER(T.table_schema) AND LOWER(C.table_name) = LOWER(T.table_name) \n")
        sql_buffer.write("\t\tWHERE colStat = 1 AND T.tableStat=3 \n")
        sql_buffer.write("\tLOOP\n")
        utils.add_print(db_type, 1, sql_buffer, "'Table ' || temprow.table_schema ||  '.' || temprow.table_name ||': adding column ' || temprow.col_name")
        utils.add_exec_sql(db_type, 1, sql_buffer, "temprow.SQL_CREATE")
        sql_buffer.write("\tEND LOOP;\n")
        sql_buffer.write("END; --of cursor \n")
    
    # ==========================================================================
    # Altering Columns
    # ==========================================================================
    
    sql_buffer.write("\n")
    sql_buffer.write("--Altering Columns\n")
    
    if db_type == DBType.MSSQL:
        sql_buffer.write("DECLARE alterCols CURSOR FAST_FORWARD \n")
        sql_buffer.write("FOR \n")
        sql_buffer.write("\tSELECT  table_schema , \n")
        sql_buffer.write("\t\ttable_name, \n")
        sql_buffer.write("\t\tcol_name, \n")
        sql_buffer.write("\t\tSQL_ALTER, \n")
        sql_buffer.write("\t\tdiff_descr \n")
        sql_buffer.write("\tFROM    #ScriptCols \n")
        sql_buffer.write("\tWHERE colStat = 3 \n")
        sql_buffer.write("\t\tOPEN alterCols \n")
        sql_buffer.write("FETCH NEXT FROM alterCols INTO @table_schema, @table_name, @col_name,@SQL_ALTER, @diff_descr \n")
        sql_buffer.write("WHILE @@FETCH_STATUS = 0  \n")
        sql_buffer.write("\tBEGIN \n")
        utils.add_print(db_type, 1, sql_buffer, "'Table ['+@table_schema+'].['+@table_name+']: column ['+@col_name+'] needs to be changed: '+@diff_descr")
        sql_buffer.write("\t\tSET @sqlCode = @SQL_ALTER \n")
        utils.add_exec_sql(db_type, 1, sql_buffer)
        sql_buffer.write("\n")
        sql_buffer.write("\tFETCH NEXT FROM alterCols INTO @table_schema, @table_name, @col_name,@SQL_ALTER, @diff_descr \n")
        sql_buffer.write("END\n")
        sql_buffer.write("\n")
        sql_buffer.write("CLOSE alterCols\n")
        sql_buffer.write("DEALLOCATE alterCols\n")
    
    elif db_type == DBType.PostgreSQL:
        sql_buffer.write("declare temprow record;\n")
        sql_buffer.write("BEGIN\n")
        sql_buffer.write("\tFOR temprow IN \n")
        sql_buffer.write("\t\tSELECT  C.table_schema , \n")
        sql_buffer.write("\t\tC.table_name, \n")
        sql_buffer.write("\t\tC.col_name, \n")
        sql_buffer.write("\t\tC.SQL_ALTER, \n")
        sql_buffer.write("\t\tC.diff_descr \n")
        sql_buffer.write("\t\tFROM  ScriptCols C\n")
        sql_buffer.write("\t\tWHERE colStat = 3\n")
        sql_buffer.write("\tLOOP\n")
        utils.add_print(db_type, 1, sql_buffer, "'Table ' || temprow.table_schema ||  '.' || temprow.table_name ||': column ' || temprow.col_name || ' needs to be changed: ' || temprow.diff_descr")
        utils.add_exec_sql(db_type, 1, sql_buffer, "temprow.SQL_ALTER")
        sql_buffer.write("\tEND LOOP;\n")
        sql_buffer.write("END; --of cursor \n")
    
    # ==========================================================================
    # Dropping Columns
    # ==========================================================================
    
    sql_buffer.write("\n")
    sql_buffer.write("--Dropping Columns\n")
    
    if db_type == DBType.MSSQL:
        sql_buffer.write("DECLARE extraCols CURSOR FAST_FORWARD \n")
        sql_buffer.write("FOR \n")
        sql_buffer.write("\tSELECT  table_schema , \n")
        sql_buffer.write("\t\ttable_name, \n")
        sql_buffer.write("\t\tcol_name, \n")
        sql_buffer.write("\t\tSQL_DROP \n")
        sql_buffer.write("\tFROM    #ScriptCols \n")
        sql_buffer.write("\tWHERE colStat = 2 \n")
        sql_buffer.write("\t\tOPEN extraCols \n")
        sql_buffer.write("FETCH NEXT FROM extraCols INTO @table_schema, @table_name, @col_name, \n")
        sql_buffer.write("\t@SQL_DROP \n")
        sql_buffer.write("WHILE @@FETCH_STATUS = 0  \n")
        sql_buffer.write("\tBEGIN \n")
        utils.add_print(db_type, 1, sql_buffer, "'Table ['+@table_schema+'].['+@table_name+']: dropping column ['+@col_name+']'")
        sql_buffer.write("\t\tSET @sqlCode = @SQL_DROP \n")
        utils.add_exec_sql(db_type, 1, sql_buffer)
        sql_buffer.write("\n")
        sql_buffer.write("\tFETCH NEXT FROM extraCols INTO @table_schema, @table_name, @col_name, \n")
        sql_buffer.write("\t\t@SQL_DROP \n")
        sql_buffer.write("END\n")
        sql_buffer.write("\n")
        sql_buffer.write("CLOSE extraCols\n")
        sql_buffer.write("DEALLOCATE extraCols\n")
    
    elif db_type == DBType.PostgreSQL:
        sql_buffer.write("declare temprow record;\n")
        sql_buffer.write("BEGIN\n")
        sql_buffer.write("\tFOR temprow IN \n")
        sql_buffer.write("\tSELECT  C.table_schema , \n")
        sql_buffer.write("\t\tC.table_name, \n")
        sql_buffer.write("\t\tC.col_name, \n")
        sql_buffer.write("\t\tC.SQL_DROP \n")
        sql_buffer.write("\tFROM    ScriptCols C \n")
        sql_buffer.write("\tWHERE colStat = 2 \n")
        sql_buffer.write("\tLOOP\n")
        utils.add_print(db_type, 1, sql_buffer, "'Table ' || temprow.table_schema ||  '.' || temprow.table_name ||': dropping column ' || temprow.col_name")
        utils.add_exec_sql(db_type, 1, sql_buffer, "temprow.SQL_DROP")
        sql_buffer.write("\tEND LOOP;\n")
        sql_buffer.write("END; --of cursor \n")
    
    sql_buffer.write("\n")

    # ==========================================================================
    # Post-data NOT NULL updates (if got_data is True)
    # ==========================================================================
    
    if got_data:
        j2_alter_cols_not_null.write("\n")
        j2_alter_cols_not_null.write("--Now that I got the data: some columns may need to be set to NOT NULL\n")
        
        if db_type == DBType.MSSQL:
            j2_alter_cols_not_null.write("DECLARE @SQL_ALTER_PostData_NotNULL NVARCHAR(max)\n")
            j2_alter_cols_not_null.write("DECLARE alterCols CURSOR FAST_FORWARD \n")
            j2_alter_cols_not_null.write("FOR \n")
            j2_alter_cols_not_null.write("\tSELECT  table_schema , \n")
            j2_alter_cols_not_null.write("\t\ttable_name, \n")
            j2_alter_cols_not_null.write("\t\tcol_name, \n")
            j2_alter_cols_not_null.write("\t\tSQL_ALTER_PostData_NotNULL \n")
            j2_alter_cols_not_null.write("\tFROM    #ScriptCols \n")
            j2_alter_cols_not_null.write("\tWHERE colStat = 1 AND SQL_ALTER_PostData_NotNULL IS NOT NULL \n")
            j2_alter_cols_not_null.write("\t\tOPEN alterCols \n")
            j2_alter_cols_not_null.write("FETCH NEXT FROM alterCols INTO @table_schema, @table_name, @col_name,@SQL_ALTER_PostData_NotNULL \n")
            j2_alter_cols_not_null.write("WHILE @@FETCH_STATUS = 0  \n")
            j2_alter_cols_not_null.write("\tBEGIN \n")
            utils.add_print(db_type, 1, j2_alter_cols_not_null, "'Table ['+@table_schema+'].['+@table_name+']: column ['+@col_name+'] needs to be changed to NOT NULL, now that I got the data:'")
            j2_alter_cols_not_null.write("\t\tSET @sqlCode = @SQL_ALTER_PostData_NotNULL \n")
            utils.add_exec_sql(db_type, 1, j2_alter_cols_not_null)
            j2_alter_cols_not_null.write("\n")
            j2_alter_cols_not_null.write("\tFETCH NEXT FROM alterCols INTO @table_schema, @table_name, @col_name,@SQL_ALTER_PostData_NotNULL \n")
            j2_alter_cols_not_null.write("END\n")
            j2_alter_cols_not_null.write("\n")
            j2_alter_cols_not_null.write("CLOSE alterCols\n")
            j2_alter_cols_not_null.write("DEALLOCATE alterCols\n")
        
        elif db_type == DBType.PostgreSQL:
            j2_alter_cols_not_null.write("declare temprow record;\n")
            j2_alter_cols_not_null.write("BEGIN\n")
            j2_alter_cols_not_null.write("\tFOR temprow IN \n")
            j2_alter_cols_not_null.write("\tSELECT  C.table_schema , \n")
            j2_alter_cols_not_null.write("\t\tC.table_name, \n")
            j2_alter_cols_not_null.write("\t\tC.col_name, \n")
            j2_alter_cols_not_null.write("\t\tC.SQL_ALTER_PostData_NotNULL \n")
            j2_alter_cols_not_null.write("\tFROM    ScriptCols C \n")
            j2_alter_cols_not_null.write("\tWHERE colStat = 1  AND SQL_ALTER_PostData_NotNULL IS NOT NULL \n")
            j2_alter_cols_not_null.write("\tLOOP\n")
            utils.add_print(db_type, 1, j2_alter_cols_not_null, "'Table ' || temprow.table_schema ||  '.' || temprow.table_name ||': column ' || temprow.col_name || ' needs to be changed to NOT NULL, now that I got the data:'")
            utils.add_exec_sql(db_type, 1, j2_alter_cols_not_null, "temprow.SQL_ALTER_PostData_NotNULL")
            j2_alter_cols_not_null.write("\tEND LOOP;\n")
            j2_alter_cols_not_null.write("END; --of cursor \n")

def generate_drop_tables(
    db_type: DBType,
    sql_buffer: StringIO
) -> None:
    """
    Generates SQL scripts for dropping tables that need to be removed
    
    Args:
        db_type: The type of database (MSSQL, PostgreSQL)
        sql_buffer: StringBuilder for SQL statements to drop tables
    """
    
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
        sql_buffer.write("declare temprow record;\n")
        sql_buffer.write("BEGIN\n")
        sql_buffer.write("\tFOR temprow IN \n")
        sql_buffer.write("\t\tSelect s.table_schema , s.table_name \n")
        sql_buffer.write("\t\tFROM ScriptTables s\n")
        sql_buffer.write("\t\tWHERE tableStat = 2\n")
        sql_buffer.write("\tLOOP\n")
        utils.add_print(db_type, 1, sql_buffer, "'Table ' || temprow.table_schema || '.' || temprow.table_name || ' is different. Drop and then add:'")
        utils.add_exec_sql(db_type, 1, sql_buffer, "'DROP TABLE ' || temprow.table_schema || '.' || temprow.table_name")
        sql_buffer.write("\tEND LOOP;\n")
        sql_buffer.write("END; --of cursor \n")


def generate_coded_ents(
    db_type: DBType,
    sql_buffer: StringIO,
    script_ops: JScriptingOptions
) -> None:
    """
    Generates SQL scripts for handling coded entities (functions, procedures, etc.)
    
    Args:
        db_type: The type of database (MSSQL, PostgreSQL)
        sql_buffer: StringBuilder for SQL statements 
        script_ops: Options controlling the script generation behavior
    """
    
    sql_buffer.write("\n")
    
    # Handle dropping of extra entities if removal is enabled
    if script_ops.remove_all_extra_ents:
        if db_type == DBType.MSSQL:
            sql_buffer.write("--Dropping Entities that need to be dropped:\n")
            sql_buffer.write("DECLARE codedDrop CURSOR FAST_FORWARD \n")
            sql_buffer.write("FOR \n")
            sql_buffer.write("\tSELECT  ent_schema , \n")
            sql_buffer.write("\t\tent_name, \n")  # no SQL_DROP here since many were INSERTed live
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
            sql_buffer.write("\tLOOP\n")
            utils.add_print(db_type, 1, sql_buffer, "'' || temprow.ent_schema || '.' || temprow.ent_name || ' is extra. Drop this code:'")
            utils.add_exec_sql(db_type, 1, sql_buffer, "'DROP  ' || temprow.ent_type || ' ' || temprow.ent_schema || '.' || temprow.ent_name || '(' || COALESCE(temprow.param_type_list,'') || ')'")
            sql_buffer.write("\tEND LOOP;\n")
            sql_buffer.write("END; --of cursor \n")
    
    # Handle entities that need to be altered (drop then recreate)
    sql_buffer.write("--Dropping Entities that need to be altered: (will then be added again. we don't do ALTER. just DROP-CREATE)\n")
    
    if db_type == DBType.MSSQL:
        sql_buffer.write("DECLARE codedDropPreAdd CURSOR FAST_FORWARD \n")
        sql_buffer.write("FOR \n")
        sql_buffer.write("\tSELECT  ent_schema , \n")
        sql_buffer.write("\t\tent_name, \n")
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
    
    # Handle adding new entities and recreating modified ones
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
        utils.add_exec_sql(db_type, 1, sql_buffer, None, True)  # True for separateExec
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
    
    # Final wrapping up
    if db_type == DBType.PostgreSQL:
        sql_buffer.write("END; --of coded entities\n")


def generate_drop_add_defaults(
    db_type: DBType,
    j2_defaults_drop: StringIO,
    j2_defaults_add: StringIO
) -> None:
    """
    Generates SQL scripts for dropping and adding default constraints
    
    Args:
        db_type: The type of database (MSSQL, PostgreSQL)
        j2_defaults_drop: StringBuilder for SQL statements to drop default constraints
        j2_defaults_add: StringBuilder for SQL statements to add default constraints
    """
    
    # Dropping defaults section
    j2_defaults_drop.write("--Dropping Defaults that are different or their columns are different\n")
    
    if db_type == DBType.MSSQL:
        j2_defaults_drop.write("DECLARE @default_name NVARCHAR(128)\n")
        j2_defaults_drop.write("DECLARE dropDefault CURSOR FAST_FORWARD \n")
        j2_defaults_drop.write("FOR \n")
        j2_defaults_drop.write("\tSELECT  D.table_schema , \n")
        j2_defaults_drop.write("\t\tD.table_name, \n")
        j2_defaults_drop.write("\t\tdefault_name \n")
        j2_defaults_drop.write("\tFROM    #ScriptDefaults D\n")
        j2_defaults_drop.write("\tINNER JOIN #ScriptTables T ON D.table_schema = T.table_schema AND D.table_name = T.table_name \n")
        j2_defaults_drop.write("\tWHERE (defaultStat in (2,3) OR D.col_diff=1)  --extra, different \n")
        j2_defaults_drop.write("\t\tAND (T.tableStat NOT IN ( 1, 2 ) OR t.tableStat IS NULL)\n")
        j2_defaults_drop.write("\t\tOPEN dropDefault \n")
        j2_defaults_drop.write("FETCH NEXT FROM dropDefault INTO @table_schema, @table_name, @default_name \n")
        j2_defaults_drop.write("WHILE @@FETCH_STATUS = 0  \n")
        j2_defaults_drop.write("\tBEGIN \n")
        utils.add_print(db_type, 1, j2_defaults_drop, "'Table ['+@table_schema+'].['+@table_name+']: dropping default ['+@default_name+']'")
        j2_defaults_drop.write("\t\tSET @sqlCode = 'ALTER TABLE ['+@table_schema+'].['+@table_name+'] DROP CONSTRAINT ['+@default_name+']' \n")
        utils.add_exec_sql(db_type, 1, j2_defaults_drop)
        j2_defaults_drop.write("\n")
        j2_defaults_drop.write("\tFETCH NEXT FROM dropDefault INTO @table_schema, @table_name, @default_name \n")
        j2_defaults_drop.write("END\n")
        j2_defaults_drop.write("\n")
        j2_defaults_drop.write("CLOSE dropDefault\n")
        j2_defaults_drop.write("DEALLOCATE dropDefault\n")
        j2_defaults_drop.write("\n")
        
        # Adding defaults section
        j2_defaults_add.write("--Add Defaults: new, or ones dropped before because they were different or underlying columns where different\n")
        j2_defaults_add.write("DECLARE addDefault CURSOR FAST_FORWARD \n")
        j2_defaults_add.write("FOR \n")
        j2_defaults_add.write("\tSELECT  D.table_schema , \n")
        j2_defaults_add.write("\t\tD.table_name, \n")
        j2_defaults_add.write("\t\tD.default_name, \n")
        j2_defaults_add.write("\t\tD.SQL_CREATE \n")
        j2_defaults_add.write("\tFROM    #ScriptDefaults  D \n")
        j2_defaults_add.write("\tINNER JOIN #ScriptTables T ON D.table_schema = T.table_schema \n")
        j2_defaults_add.write("\tAND D.table_name = T.table_name \n")
        j2_defaults_add.write("\tWHERE (defaultStat in (1,3) OR D.col_diff=1)--extra or different \n")
        j2_defaults_add.write("\t\tAND (T.tableStat NOT IN ( 1, 2 ) OR t.tableStat IS NULL)\n")
        j2_defaults_add.write("\t\tOPEN addDefault \n")
        j2_defaults_add.write("FETCH NEXT FROM addDefault INTO @table_schema, @table_name, @default_name, @SQL_CREATE \n")
        j2_defaults_add.write("WHILE @@FETCH_STATUS = 0  \n")
        j2_defaults_add.write("\tBEGIN \n")
        utils.add_print(db_type, 1, j2_defaults_add, "'Table ['+@table_schema+'].['+@table_name+']: adding default ['+@default_name+']'")
        j2_defaults_add.write("\t\tSET @sqlCode = @SQL_CREATE \n")
        utils.add_exec_sql(db_type, 1, j2_defaults_add)
        j2_defaults_add.write("\n")
        j2_defaults_add.write("\tFETCH NEXT FROM addDefault INTO @table_schema, @table_name, @default_name, @SQL_CREATE \n")
        j2_defaults_add.write("END\n")
        j2_defaults_add.write("\n")
        j2_defaults_add.write("CLOSE addDefault\n")
        j2_defaults_add.write("DEALLOCATE addDefault\n")
        j2_defaults_add.write("\n")
    
    elif db_type == DBType.PostgreSQL:
        # PostgreSQL drop defaults
        j2_defaults_drop.write("\tdeclare temprow record;\n")
        j2_defaults_drop.write("\tBEGIN\n")
        j2_defaults_drop.write("\t\tFOR temprow IN\n")
        j2_defaults_drop.write("\t\tSELECT  D.table_schema , \n")
        j2_defaults_drop.write("\t\t\tD.table_name, \n")
        j2_defaults_drop.write("\t\t\tD.default_name, \n")
        j2_defaults_drop.write("\t\t\tD.col_name \n")
        j2_defaults_drop.write("\t\tFROM    ScriptDefaults D\n")
        j2_defaults_drop.write("\t\t\tINNER JOIN ScriptTables T ON D.table_schema = T.table_schema AND D.table_name = T.table_name \n")
        j2_defaults_drop.write("\t\tWHERE (defaultStat in (2,3) OR D.col_diff=true)  --extra, different \n")
        j2_defaults_drop.write("\t\t\tAND (T.tableStat NOT IN ( 1, 2 ) OR t.tableStat IS NULL)\n")
        j2_defaults_drop.write("\t\tLOOP \n")
        utils.add_print(db_type, 3, j2_defaults_drop, "'Table ' || temprow.table_schema || '.' || temprow.table_name || ': dropping default ' || temprow.default_name ")
        j2_defaults_drop.write("\t\t\tsqlCode = 'ALTER TABLE ' || temprow.table_schema || '.' || temprow.table_name || ' ALTER COLUMN ' || temprow.col_name || ' DROP DEFAULT;'; \n")
        utils.add_exec_sql(db_type, 3, j2_defaults_drop)
        j2_defaults_drop.write("\n")
        j2_defaults_drop.write("\t\tEND LOOP; \n")
        j2_defaults_drop.write("\tEND;\n")
        j2_defaults_drop.write("\n")
        
        # PostgreSQL add defaults
        j2_defaults_add.write("\tDECLARE temprow record;\n")
        j2_defaults_add.write("\tBEGIN\n")
        j2_defaults_add.write("\t\tFOR temprow IN\n")
        j2_defaults_add.write("\tSELECT  D.table_schema , \n")
        j2_defaults_add.write("\t\tD.table_name, \n")
        j2_defaults_add.write("\t\tD.default_name, \n")
        j2_defaults_add.write("\t\tD.SQL_CREATE \n")
        j2_defaults_add.write("\tFROM    ScriptDefaults  D \n")
        j2_defaults_add.write("\tINNER JOIN ScriptTables T ON LOWER(D.table_schema) = LOWER(T.table_schema) \n")
        j2_defaults_add.write("\tAND LOWER(D.table_name) = LOWER(T.table_name) \n")
        j2_defaults_add.write("\tWHERE (defaultStat in (1,3) OR D.col_diff=true)--extra or different \n")
        j2_defaults_add.write("\t\tAND (T.tableStat NOT IN ( 1, 2 ) OR t.tableStat IS NULL)\n")
        j2_defaults_add.write("LOOP \n")
        utils.add_print(db_type, 2, j2_defaults_add, "'Table [' || temprow.table_schema || '].[' || temprow.table_name || ']: adding default [' || temprow.default_name || ']'")
        j2_defaults_add.write("\t\tsqlCode = temprow.SQL_CREATE; \n")
        utils.add_exec_sql(db_type, 1, j2_defaults_add)
        j2_defaults_add.write("\n")
        j2_defaults_add.write("\tEND LOOP;\n")
        j2_defaults_add.write("END;\n")


def generate_add_tables(
    db_type: DBType,
    sql_buffer: StringIO
) -> None:
    """
    Generates SQL scripts for adding new tables and recreating modified tables
    
    Args:
        db_type: The type of database (MSSQL, PostgreSQL)
        sql_buffer: StringBuilder for SQL statements to add tables
    """
    
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
        sql_buffer.write("declare temprow record;\n")
        sql_buffer.write("BEGIN\n")
        sql_buffer.write("\tFOR temprow IN \n")
        sql_buffer.write("\t\tSelect s.table_schema , s.table_name, s.SQL_CREATE \n")
        sql_buffer.write("\t\tFROM ScriptTables s\n")
        sql_buffer.write("\t\tWHERE tableStat = 1\n")
        sql_buffer.write("\tLOOP\n")
        utils.add_print(db_type, 1, sql_buffer, "'Adding table ' || temprow.table_schema || '.' || temprow.table_name")
        utils.add_exec_sql(db_type, 1, sql_buffer, "temprow.SQL_CREATE")
        sql_buffer.write("\tEND LOOP;\n")
        sql_buffer.write("END; --of cursor \n")


def generate_drop_add_cc(
    db_type: DBType,
    j2_ccs_drop: StringIO,
    j2_ccs_add: StringIO
) -> None:
    """
    Generates SQL scripts for dropping and adding check constraints
    
    Args:
        db_type: The type of database (MSSQL, PostgreSQL)
        j2_ccs_drop: StringBuilder for SQL statements to drop check constraints
        j2_ccs_add: StringBuilder for SQL statements to add check constraints
    """
    
    # Dropping check constraints section
    j2_ccs_drop.write("--Dropping Check Constraints that are different or their columns are different\n")
    j2_ccs_drop.write("DECLARE @cc_name NVARCHAR(128)\n")
    j2_ccs_drop.write("DECLARE dropCC CURSOR FAST_FORWARD \n")
    j2_ccs_drop.write("FOR \n")
    j2_ccs_drop.write("\tSELECT  C.table_schema , \n")
    j2_ccs_drop.write("\t\tC.table_name, \n")
    j2_ccs_drop.write("\t\tcc_name \n")
    j2_ccs_drop.write("\tFROM    #ScriptChkCnstr C\n")
    j2_ccs_drop.write("\tINNER JOIN #ScriptTables T ON C.table_schema = T.table_schema\n")
    j2_ccs_drop.write("\tWHERE (ccStat in (2,3)  OR C.col_diff=1)  --extra, different \n")
    j2_ccs_drop.write("\t\tAND ( T.tableStat NOT IN ( 1, 2 ) OR t.tableStat IS NULL )\n")
    j2_ccs_drop.write("\t\tOPEN dropCC \n")
    j2_ccs_drop.write("FETCH NEXT FROM dropCC INTO @table_schema, @table_name, @cc_name \n")
    j2_ccs_drop.write("WHILE @@FETCH_STATUS = 0  \n")
    j2_ccs_drop.write("\tBEGIN \n")
    utils.add_print(db_type, 1, j2_ccs_drop, "'Table ['+@table_schema+'].['+@table_name+']: dropping check constraint ['+@cc_name+']'")
    j2_ccs_drop.write("\t\tSET @sqlCode = 'ALTER TABLE ['+@table_schema+'].['+@table_name+'] DROP CONSTRAINT ['+@cc_name+'];' \n")
    utils.add_exec_sql(db_type, 1, j2_ccs_drop)
    j2_ccs_drop.write("\n")
    j2_ccs_drop.write("\tFETCH NEXT FROM dropCC INTO @table_schema, @table_name, @cc_name \n")
    j2_ccs_drop.write("END\n")
    j2_ccs_drop.write("\n")
    j2_ccs_drop.write("CLOSE dropCC\n")
    j2_ccs_drop.write("DEALLOCATE dropCC\n")
    j2_ccs_drop.write("\n")
    
    # Adding check constraints section
    j2_ccs_add.write("--Add Check Constraints: new, or ones dropped before because they were different or underlying columns where different\n")
    j2_ccs_add.write("DECLARE addCC CURSOR FAST_FORWARD \n")
    j2_ccs_add.write("FOR \n")
    j2_ccs_add.write("\tSELECT  C.table_schema , \n")
    j2_ccs_add.write("\t\tC.table_name, \n")
    j2_ccs_add.write("\t\tcc_name, \n")
    j2_ccs_add.write("\t\tC.SQL_CREATE \n")
    j2_ccs_add.write("\tFROM    #ScriptChkCnstr C\n")
    j2_ccs_add.write("\tINNER JOIN #ScriptTables T ON C.table_schema = T.table_schema\n")
    j2_ccs_add.write("\t\tAND C.table_name = T.table_name\n")
    j2_ccs_add.write("\tWHERE (ccStat in (1,3)  OR C.col_diff=1) --extra or different \n")
    j2_ccs_add.write("\t\tAND ( T.tableStat NOT IN ( 1, 2 ) OR t.tableStat IS NULL )\n")
    j2_ccs_add.write("\t\tOPEN addCC \n")
    j2_ccs_add.write("FETCH NEXT FROM addCC INTO @table_schema, @table_name, @cc_name, @SQL_CREATE \n")
    j2_ccs_add.write("WHILE @@FETCH_STATUS = 0  \n")
    j2_ccs_add.write("\tBEGIN \n")
    utils.add_print(db_type, 1, j2_ccs_add, "'Table ['+@table_schema+'].['+@table_name+']: adding check constraint ['+@cc_name+']'")
    j2_ccs_add.write("\t\tSET @sqlCode = @SQL_CREATE \n")
    utils.add_exec_sql(db_type, 1, j2_ccs_add)
    j2_ccs_add.write("\n")
    j2_ccs_add.write("\tFETCH NEXT FROM addCC INTO @table_schema, @table_name, @cc_name, @SQL_CREATE \n")
    j2_ccs_add.write("END\n")
    j2_ccs_add.write("\n")
    j2_ccs_add.write("CLOSE addCC\n")
    j2_ccs_add.write("DEALLOCATE addCC\n")
    j2_ccs_add.write("\n")