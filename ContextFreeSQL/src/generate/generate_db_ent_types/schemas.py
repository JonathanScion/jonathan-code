from typing import Tuple
from src.defs.script_defs import DBType, DBSyntax
from src.utils import funcs as utils
from dataclasses import dataclass
import pandas as pd
from io import StringIO


#based on: CreateDBStateSchemas
def create_db_state_schemas(dbtype: DBType, tbl_ents: pd.DataFrame, tbl_schemas: pd.DataFrame, ops_all_schemas: bool, ops_remove_all_extra_ents: bool) -> StringIO:
    
    schemas_buffer = StringIO()    
    
    # Get database-specific syntax
    db_syntax = DBSyntax.get_syntax(dbtype)
    ident_level = 1;
    
    # Write schema creation header    
    schemas_buffer.write(f"{'\t' * ident_level}--Schemas\n")
    schemas_buffer.write(f"{'\t' * ident_level}DECLARE {db_syntax.var_prefix}schema_name {db_syntax.nvarchar_type} (128){db_syntax.declare_separator}\n")
    
    # PostgreSQL specific BEGIN block
    if dbtype == DBType.PostgreSQL:
        schemas_buffer.write(f"{'\t' * ident_level}BEGIN --schema code\n")

    ident_level+=1
    
    # Drop existing temp table if it exists
    if dbtype == DBType.MSSQL:
        schemas_buffer.write(f"{'\t' * ident_level}IF (OBJECT_ID('tempdb..#ScriptSchemas') IS NOT NULL)\n")
        schemas_buffer.write(f"{'\t' * ident_level}BEGIN\n")
        schemas_buffer.write(f"{'\t' * ident_level}DROP TABLE {db_syntax.temp_table_prefix}ScriptSchemas;\n")
        schemas_buffer.write(f"{'\t' * ident_level}END;\n")
    else:  # PostgreSQL
        schemas_buffer.write(f"""{'\t' * ident_level}perform n.nspname, c.relname
            FROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname like 'pg_temp_%' AND c.relname='scriptschemas' AND pg_catalog.pg_table_is_visible(c.oid);\n""")
        schemas_buffer.write(f"{'\t' * ident_level}IF FOUND THEN\n")
        schemas_buffer.write(f"{'\t' * (ident_level+1)}DROP TABLE {db_syntax.temp_table_prefix}ScriptSchemas;\n")
        schemas_buffer.write(f"{'\t' * ident_level}END IF;\n")
    
    # Create temporary table for schema tracking
    schemas_buffer.write(f"\n")
    schemas_buffer.write(f"{'\t' * ident_level}{db_syntax.temp_table_create}ScriptSchemas\n")
    schemas_buffer.write(f"{'\t' * (ident_level)}(\n")
    schemas_buffer.write(f"{'\t' * (ident_level+1)}schema_name {db_syntax.nvarchar_type} (128) not null,\n")
    schemas_buffer.write(f"{'\t' * (ident_level+1)}principal_name {db_syntax.nvarchar_type} {db_syntax.max_length_str} null,\n")
    schemas_buffer.write(f"{'\t' * (ident_level+1)}SQL_CREATE {db_syntax.nvarchar_type} {db_syntax.max_length_str} null,\n")
    schemas_buffer.write(f"{'\t' * (ident_level+1)}SQL_DROP {db_syntax.nvarchar_type} {db_syntax.max_length_str} null,\n")
    schemas_buffer.write(f"{'\t' * (ident_level+1)}schemaStat smallint null\n")
    schemas_buffer.write(f"{'\t' * ident_level});\n\n")

    # Inside create_db_state_schemas function:
    schemas_buffer.write(f"{'\t' * ident_level}--INSErting all existing schemas \n")
    for _, row in tbl_schemas.iterrows():
        schemas_buffer.write(f"{'\t' * ident_level}INSERT INTO {db_syntax.temp_table_prefix}ScriptSchemas (schema_name,principal_name, SQL_CREATE)\n")
        schemas_buffer.write(f"{'\t' * ident_level}VALUES (" + utils.quote_str_or_null(row['schema_name']) + ",")
        schemas_buffer.write(utils.quote_str_or_null(row['principal_name']) + ",")
        
        if dbtype == DBType.MSSQL:
            sql_create = f"{'\t' * ident_level}'CREATE SCHEMA [" + row['schema_name'] + "]"
            if pd.isna(row['principal_name']):
                sql_create += ";"
            else:
                sql_create += f" AUTHORIZATION {row['principal_name']};"
            schemas_buffer.write(sql_create + "');\n")
        else:  # PostgreSQL
            sql_create = f"{'\t' * ident_level}'CREATE SCHEMA {row['schema_name']}"
            if pd.isna(row['principal_name']):
                sql_create += ";"
            else:
                sql_create += f" AUTHORIZATION {row['principal_name']};"
            schemas_buffer.write(sql_create + "');\n")

    #now update against existing schemas
    schemas_buffer.write(f"\n{'\t' * ident_level}--Schemas only on Johannes database (need to add)\n")
    schemas_buffer.write(f"{'\t' * ident_level}update {db_syntax.temp_table_prefix}ScriptSchemas set schemaStat = 1\n")

    if dbtype == DBType.MSSQL:
        #! see all loginc in original for sMS_SchemaNamesFilter, maybe put it here. for now deactivated
        # schemas_buffer.write(f"FROM {db_syntax.temp_table_prefix}ScriptSchemas J left join (select name as schema_name from sys.schemas S WHERE {ms_schema_names_filter} AND s.NAME NOT LIKE 'db_%') DB\n")
        schemas_buffer.write(f"{'\t' * ident_level}on J.schema_name=DB.schema_name \n")
        schemas_buffer.write(f"{'\t' * ident_level}where DB.schema_name Is null; \n")

    elif dbtype == DBType.PostgreSQL:  
        schemas_buffer.write(f"{'\t' * ident_level}FROM {db_syntax.temp_table_prefix}ScriptSchemas S\n")
        schemas_buffer.write(f"{'\t' * ident_level}where LOWER(S.schema_name) not in \n")
        schemas_buffer.write(f"{'\t' * ident_level}( \n")
        schemas_buffer.write(f"{'\t' * ident_level}select LOWER(J.schema_name) from information_schema.schemata J \n")
        schemas_buffer.write(f"{'\t' * ident_level}WHERE J.schema_name NOT IN ('pg_catalog','information_schema') and J.schema_name NOT LIKE 'pg_temp%' and J.schema_name NOT LIKE 'pg_toast%' \n")
        schemas_buffer.write(f"{'\t' * ident_level})  \n")
        schemas_buffer.write(f"{'\t' * ident_level}AND (S.schema_name=ScriptSchemas.schema_name);\n")


    schemas_buffer.write(f"{'\t' * ident_level}\n")


    schemas_buffer.write(f"{'\t' * ident_level}--Schemas only on DB (need to drop)\n")
    if dbtype == DBType.MSSQL:
        schemas_buffer.write(f"{'\t' * ident_level}INSERT  INTO {db_syntax.temp_table_prefix}ScriptSchemas ( schema_name, SQL_DROP, schemaStat)\n")
        schemas_buffer.write(f"{'\t' * ident_level}SELECT  DB.schema_name,'DROP SCHEMA ['+DB.schema_name+']', 2 \n")
        schemas_buffer.write(f"{'\t' * ident_level}FROM    {db_syntax.temp_table_prefix}ScriptSchemas J \n")
        schemas_buffer.write(f"{'\t' * ident_level}RIGHT JOIN ( SELECT name AS schema_name  \n")
        #see comment above about reactivating with ms_schema_names_filter
        #schemas_buffer.write(f"FROM   sys.schemas S WHERE {ms_schema_names_filter} AND s.NAME NOT LIKE 'db_%' \n")
        schemas_buffer.write(f"{'\t' * ident_level}) DB ON J.schema_name = DB.schema_name \n")
        schemas_buffer.write(f"{'\t' * ident_level}WHERE J.schema_name Is NULL; \n")

    elif dbtype == DBType.PostgreSQL:  
        schemas_buffer.write(f"{'\t' * ident_level}INSERT  INTO {db_syntax.temp_table_prefix}ScriptSchemas ( schema_name, SQL_DROP, schemaStat)\n")
        schemas_buffer.write(f"{'\t' * ident_level}SELECT  J.schema_name,'DROP SCHEMA ' || J.schema_name || ';', 2 \n")
        schemas_buffer.write(f"{'\t' * ident_level}FROM    information_schema.schemata J \n")
        schemas_buffer.write(f"{'\t' * ident_level}Where J.schema_name Not In ('pg_catalog','information_schema') AND J.schema_name NOT LIKE 'pg_temp%' AND J.schema_name NOT LIKE 'pg_toast%' \n")
        schemas_buffer.write(f"{'\t' * ident_level}AND LOWER(J.schema_name) Not IN (select LOWER(J1.schema_name) from {db_syntax.temp_table_prefix}scriptschemas J1);\n")

    schemas_buffer.write(f"{'\t' * ident_level}\n")

    #time to generate the code
    if ops_remove_all_extra_ents:
        schemas_buffer.write(f"{'\t' * ident_level}--Dropping Schemas that need to be dropped:\n")

        if dbtype == DBType.MSSQL:
            schemas_buffer.write(f"{'\t' * ident_level}DECLARE schemaDrop CURSOR FAST_FORWARD \n")
            schemas_buffer.write(f"{'\t' * ident_level}FOR \n")
            # no SQL_DROP here since many of them where INSERTed live , we dont know in advance what's in the DB, so we dont have a DROP
            schemas_buffer.write(f"{'\t' * ident_level}\tSELECT  schema_name ,SQL_DROP \n")
            schemas_buffer.write(f"{'\t' * ident_level}\tFROM    #ScriptSchemas \n") 
            schemas_buffer.write(f"{'\t' * ident_level}\tWHERE schemaStat =2 \n")
            schemas_buffer.write(f"{'\t' * ident_level}\t\tOPEN schemaDrop \n")
            schemas_buffer.write(f"{'\t' * ident_level}FETCH NEXT FROM schemaDrop INTO @schema_name, @SQL_DROP \n")
            schemas_buffer.write(f"{'\t' * ident_level}WHILE @@FETCH_STATUS = 0  \n")
            schemas_buffer.write(f"{'\t' * ident_level}\tBEGIN \n")
            utils.add_print(dbtype, 1, schemas_buffer, "Dropping Schema ['+@schema_name+']:'")
            schemas_buffer.write(f"{'\t' * ident_level}\t\tSET @sqlCode = @SQL_DROP\n")
            utils.add_exec_sql(dbtype, 1, schemas_buffer)
            schemas_buffer.write(f"{'\t' * ident_level}\n")
            schemas_buffer.write(f"{'\t' * ident_level}\tFETCH NEXT FROM schemaDrop INTO @schema_name, @SQL_DROP \n")
            schemas_buffer.write(f"{'\t' * ident_level}END\n")
            schemas_buffer.write(f"{'\t' * ident_level}\n")
            schemas_buffer.write(f"{'\t' * ident_level}CLOSE schemaDrop;\n")
            schemas_buffer.write(f"{'\t' * ident_level}DEALLOCATE schemaDrop;\n")
            schemas_buffer.write(f"{'\t' * ident_level}\n")

        elif dbtype == DBType.PostgreSQL:  # !MySQL
            schemas_buffer.write(f"{'\t' * ident_level}DECLARE temprow record;\n")
            schemas_buffer.write(f"{'\t' * ident_level}BEGIN\n")
            schemas_buffer.write(f"{'\t' * ident_level}\tFOR temprow IN\n")
            schemas_buffer.write(f"{'\t' * ident_level}\t\tSELECT  s.schema_name ,  \n")
            schemas_buffer.write(f"{'\t' * ident_level}\t\ts.SQL_DROP \n")
            schemas_buffer.write(f"{'\t' * ident_level}\t\tFROM    {db_syntax.temp_table_prefix}ScriptSchemas s\n")
            schemas_buffer.write(f"{'\t' * ident_level}\t\t\tWHERE SchemaStat = 2\n")
            schemas_buffer.write(f"{'\t' * ident_level}\t\tLOOP\n")
            utils.add_print(dbtype, 4, schemas_buffer, "'Dropping Schema ' || temprow.schema_name || ':'")
            utils.add_exec_sql(dbtype, 4, schemas_buffer, "'DROP SCHEMA ' || temprow.schema_name || ';'")
            schemas_buffer.write(f"{'\t' * ident_level}\t\tEND LOOP;\n")
            schemas_buffer.write(f"{'\t' * ident_level}\tEND; --FOR\n")


    schemas_buffer.write(f"{'\t' * ident_level}--Adding new entities and ones that were modified\n")

    if dbtype == DBType.MSSQL:
        schemas_buffer.write(f"{'\t' * ident_level}DECLARE schemaAdd CURSOR FAST_FORWARD \n")
        schemas_buffer.write(f"{'\t' * ident_level}FOR \n")
        schemas_buffer.write(f"{'\t' * ident_level}\tSELECT  schema_name , \n")
        schemas_buffer.write(f"{'\t' * ident_level}\t\tSQL_CREATE \n")
        schemas_buffer.write(f"{'\t' * ident_level}FROM    {db_syntax.temp_table_prefix}ScriptSchemas \n")
        schemas_buffer.write(f"{'\t' * ident_level}\tWHERE SchemaStat IN (1,3) --right now there aren't any 3 here but whatever. need to think about what to do when got a schema with a different authorization (principal_name in the table) \n")
        schemas_buffer.write(f"{'\t' * ident_level}\t\tOPEN schemaAdd \n")
        schemas_buffer.write(f"{'\t' * ident_level}FETCH NEXT FROM schemaAdd INTO @schema_name,@SQL_CREATE \n")
        schemas_buffer.write(f"{'\t' * ident_level}WHILE @@FETCH_STATUS = 0  \n")
        schemas_buffer.write(f"{'\t' * ident_level}\tBEGIN \n")
        utils.add_print(dbtype, 1, schemas_buffer, "Schema ['+@schema_name+'] needs to be created'")
        schemas_buffer.write(f"{'\t' * ident_level}\t\tSET @sqlCode = @SQL_CREATE \n")
        utils.add_exec_sql(dbtype, 1, schemas_buffer)
        schemas_buffer.write(f"{'\t' * ident_level}\n")
        schemas_buffer.write(f"{'\t' * ident_level}\tFETCH NEXT FROM schemaAdd INTO @schema_name,@SQL_CREATE \n")
        schemas_buffer.write(f"{'\t' * ident_level}END\n")
        schemas_buffer.write(f"{'\t' * ident_level}\n")
        schemas_buffer.write(f"{'\t' * ident_level}CLOSE schemaAdd\n")
        schemas_buffer.write(f"{'\t' * ident_level}DEALLOCATE schemaAdd\n")

    elif dbtype == DBType.PostgreSQL:  
        schemas_buffer.write(f"{'\t' * ident_level}declare temprow record;\n")
        schemas_buffer.write(f"{'\t' * ident_level}BEGIN\n")
        schemas_buffer.write(f"{'\t' * ident_level}\tFOR temprow IN\n")
        schemas_buffer.write(f"{'\t' * ident_level}\t\tSELECT  s.schema_name ,  \n")
        schemas_buffer.write(f"{'\t' * ident_level}\t\ts.SQL_CREATE \n")
        schemas_buffer.write(f"{'\t' * ident_level}\t\tFROM    {db_syntax.temp_table_prefix}ScriptSchemas s\n")
        schemas_buffer.write(f"{'\t' * ident_level}\t\t\tWHERE SchemaStat IN (1,3) --right now there aren't any 3 here but whatever. need to think about what to do when got a schema with a different authorization (principal_name in the table) \n")
        schemas_buffer.write(f"{'\t' * ident_level}\t\tLOOP\n")
        utils.add_print(dbtype, 4, schemas_buffer, "'Adding Schema ' || temprow.schema_name || ':'")
        utils.add_exec_sql(dbtype, 4, schemas_buffer, "temprow.SQL_CREATE")
        schemas_buffer.write(f"{'\t' * ident_level}\t\tEND LOOP;\n")
        schemas_buffer.write(f"{'\t' * ident_level}\tEND; --FOR \n")
        schemas_buffer.write(f"{'\t' * ident_level}END; --of adding new entities and ones that were modified\n")

    # PostgreSQL specific BEGIN block
    ident_level -= 1
    if dbtype == DBType.PostgreSQL:
        schemas_buffer.write(f"{'\t' * ident_level}END; --schema code\n")
    
    return schemas_buffer