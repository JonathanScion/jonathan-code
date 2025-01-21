from typing import Tuple
from src.defs.script_defs import DBType, DBSyntax
from src.utils import funcs as utils
from dataclasses import dataclass
import pandas as pd
from io import StringIO


#based on: CreateDBStateSchemas
def create_db_state_schemas(dbtype: DBType, tbl_ents: pd.DataFrame, tbl_schemas: pd.DataFrame, ops_all_schemas: bool, ops_remove_all_extra_ents: bool) -> Tuple[StringIO, StringIO]:
    
    create_schemas = StringIO()
    drop_schemas = StringIO()
    
    # Get database-specific syntax
    db_syntax = DBSyntax.get_syntax(dbtype)
    
    # Write schema creation header
    create_schemas.write("--Schemas\n")
    create_schemas.write(f"DECLARE {db_syntax.var_prefix}schema_name {db_syntax.nvarchar_type} (128){db_syntax.declare_separator}\n")
    
    # PostgreSQL specific BEGIN block
    if dbtype == DBType.PostgreSQL:
        create_schemas.write("BEGIN --schema code\n")
    
    # Drop existing temp table if it exists
    if dbtype == DBType.MSSQL:
        create_schemas.write("IF (OBJECT_ID('tempdb..#ScriptSchemas') IS NOT NULL)\n")
        create_schemas.write("BEGIN\n")
        create_schemas.write(f"\tDROP TABLE {db_syntax.temp_table_prefix}ScriptSchemas;\n")
        create_schemas.write("END;\n")
    else:  # PostgreSQL
        create_schemas.write("""perform n.nspname, c.relname
                                FROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
                                WHERE n.nspname like 'pg_temp_%' AND c.relname='scriptschemas' AND pg_catalog.pg_table_is_visible(c.oid);\n""")
        create_schemas.write("IF FOUND THEN\n")
        create_schemas.write(f"\tDROP TABLE {db_syntax.temp_table_prefix}ScriptSchemas;\n")
        create_schemas.write("END IF;\n")
    
    # Create temporary table for schema tracking
    create_schemas.write(f"{db_syntax.temp_table_create}ScriptSchemas\n")
    create_schemas.write("(\n")
    create_schemas.write(f"\tschema_name {db_syntax.nvarchar_type} (128) not null,\n")
    create_schemas.write(f"\tprincipal_name {db_syntax.nvarchar_type} {db_syntax.max_length_str} null,\n")
    create_schemas.write(f"\tSQL_CREATE {db_syntax.nvarchar_type} {db_syntax.max_length_str} null,\n")
    create_schemas.write(f"\tSQL_DROP {db_syntax.nvarchar_type} {db_syntax.max_length_str} null,\n")
    create_schemas.write("\tschemaStat smallint null\n")
    create_schemas.write(");\n\n")

    # Inside create_db_state_schemas function:
    for _, row in tbl_schemas.iterrows():
        create_schemas.write(f"INSERT INTO {db_syntax.temp_table_prefix}ScriptSchemas (schema_name,principal_name, SQL_CREATE)\n")
        create_schemas.write("VALUES (" + utils.quote_str_or_null(row['schema_name']) + ",")
        create_schemas.write(utils.quote_str_or_null(row['principal_name']) + ",")
        
        if dbtype == DBType.MSSQL:
            sql_create = "'CREATE SCHEMA [" + row['schema_name'] + "]"
            if pd.isna(row['principal_name']):
                sql_create += ";"
            else:
                sql_create += f" AUTHORIZATION {row['principal_name']};"
            create_schemas.write(sql_create + "');\n")
        else:  # PostgreSQL
            sql_create = f"'CREATE SCHEMA {row['schema_name']}"
            if pd.isna(row['principal_name']):
                sql_create += ";"
            else:
                sql_create += f" AUTHORIZATION {row['principal_name']};"
            create_schemas.write(sql_create + "');\n")

        #now update against existing schemas
        create_schemas.write("--Schemas only on Johannes database (need to add)\n")
        create_schemas.write(f"update {db_syntax.temp_table_prefix}ScriptSchemas set schemaStat = 1\n")

        if dbtype == DBType.MSSQL:
            #! see all loginc in original for sMS_SchemaNamesFilter, maybe put it here. for now deactivated
            # create_schemas.write(f"FROM {db_syntax.temp_table_prefix}ScriptSchemas J left join (select name as schema_name from sys.schemas S WHERE {ms_schema_names_filter} AND s.NAME NOT LIKE 'db_%') DB\n")
            create_schemas.write("on J.schema_name=DB.schema_name \n")
            create_schemas.write("where DB.schema_name Is null; \n")

        elif dbtype == DBType.PostgreSQL:  
            create_schemas.write(f"FROM {db_syntax.temp_table_prefix}ScriptSchemas S\n")
            create_schemas.write("where LOWER(S.schema_name) not in \n")
            create_schemas.write("( \n")
            create_schemas.write("select LOWER(J.schema_name) from information_schema.schemata J \n")
            create_schemas.write("WHERE J.schema_name NOT IN ('pg_catalog','information_schema') and J.schema_name NOT LIKE 'pg_temp%' and J.schema_name NOT LIKE 'pg_toast%' \n")
            create_schemas.write(")  \n")
            create_schemas.write("AND (S.schema_name=ScriptSchemas.schema_name);\n")


        create_schemas.write("\n")


        create_schemas.write("--Schemas only on DB (need to drop)\n")
        if dbtype == DBType.MSSQL:
            create_schemas.write(f"INSERT  INTO {db_syntax.temp_table_prefix}ScriptSchemas ( schema_name, SQL_DROP, schemaStat)\n")
            create_schemas.write("SELECT  DB.schema_name,'DROP SCHEMA ['+DB.schema_name+']', 2 \n")
            create_schemas.write(f"FROM    {db_syntax.temp_table_prefix}ScriptSchemas J \n")
            create_schemas.write("RIGHT JOIN ( SELECT name AS schema_name  \n")
            #see comment above about reactivating with ms_schema_names_filter
            #create_schemas.write(f"FROM   sys.schemas S WHERE {ms_schema_names_filter} AND s.NAME NOT LIKE 'db_%' \n")
            create_schemas.write(") DB ON J.schema_name = DB.schema_name \n")
            create_schemas.write("WHERE J.schema_name Is NULL; \n")

        elif dbtype == DBType.PostgreSQL:  
            create_schemas.write(f"INSERT  INTO {db_syntax.temp_table_prefix}ScriptSchemas ( schema_name, SQL_DROP, schemaStat)\n")
            create_schemas.write("SELECT  J.schema_name,'DROP SCHEMA ' || J.schema_name || ';', 2 \n")
            create_schemas.write(f"FROM    information_schema.schemata J \n")
            create_schemas.write(f"Where J.schema_name Not In ('pg_catalog','information_schema') AND J.schema_name NOT LIKE 'pg_temp%' AND J.schema_name NOT LIKE 'pg_toast%' \n")
            create_schemas.write(f"AND LOWER(J.schema_name) Not IN (select LOWER(J1.schema_name) from {db_syntax.temp_table_prefix}scriptschemas J1);\n")

        create_schemas.write("\n")

        #time to generate the code
        if ops_remove_all_extra_ents:
            drop_schemas.write("--Dropping Schemas that need to be dropped:\n")

            if dbtype == DBType.MSSQL:
                drop_schemas.write("DECLARE schemaDrop CURSOR FAST_FORWARD \n")
                drop_schemas.write("FOR \n")
                # no SQL_DROP here since many of them where INSERTed live , we dont know in advance what's in the DB, so we dont have a DROP
                drop_schemas.write("\tSELECT  schema_name ,SQL_DROP \n")
                drop_schemas.write("\tFROM    #ScriptSchemas \n") 
                drop_schemas.write("\tWHERE schemaStat =2 \n")
                drop_schemas.write("\t\tOPEN schemaDrop \n")
                drop_schemas.write("FETCH NEXT FROM schemaDrop INTO @schema_name, @SQL_DROP \n")
                drop_schemas.write("WHILE @@FETCH_STATUS = 0  \n")
                drop_schemas.write("\tBEGIN \n")
                utils.add_print(dbtype, 1, drop_schemas, "Dropping Schema ['+@schema_name+']:'")
                drop_schemas.write("\t\tSET @sqlCode = @SQL_DROP\n")
                utils.add_exec_sql(dbtype, 1, drop_schemas)
                drop_schemas.write("\n")
                drop_schemas.write("\tFETCH NEXT FROM schemaDrop INTO @schema_name, @SQL_DROP \n")
                drop_schemas.write("END\n")
                drop_schemas.write("\n")
                drop_schemas.write("CLOSE schemaDrop;\n")
                drop_schemas.write("DEALLOCATE schemaDrop;\n")
                drop_schemas.write("\n")

            elif dbtype == DBType.PostgreSQL:  # !MySQL
                drop_schemas.write("\tdeclare temprow record;\n")
                drop_schemas.write("\tBEGIN\n")
                drop_schemas.write("\t\tFOR temprow IN\n")
                drop_schemas.write("\t\t\tSELECT  s.schema_name ,  \n")
                drop_schemas.write("\t\t\ts.SQL_DROP \n")
                drop_schemas.write(f"\t\t\tFROM    {db_syntax.temp_table_prefix}ScriptSchemas s\n")
                drop_schemas.write("\t\t\tWHERE SchemaStat = 2\n")
                drop_schemas.write("\t\tLOOP\n")
                utils.add_print(dbtype, 1, drop_schemas, "'Dropping Schema ' || temprow.schema_name || ':'")
                utils.add_exec_sql(dbtype, 1, drop_schemas, "'DROP SCHEMA ' || temprow.schema_name || ';'")
                drop_schemas.write("\t\tEND LOOP;\n")
                drop_schemas.write("\tEND; --off \n")


        create_schemas.write("--Adding new entities and ones that were modified\n")

        if dbtype == DBType.MSSQL:
            create_schemas.write("DECLARE schemaAdd CURSOR FAST_FORWARD \n")
            create_schemas.write("FOR \n")
            create_schemas.write("\tSELECT  schema_name , \n")
            create_schemas.write("\t\tSQL_CREATE \n")
            create_schemas.write(f"\tFROM    {db_syntax.temp_table_prefix}ScriptSchemas \n")
            create_schemas.write("\tWHERE SchemaStat IN (1,3) --right now there aren't any 3 here but whatever. need to think about what to do when got a schema with a different authorization (principal_name in the table) \n")
            create_schemas.write("\t\tOPEN schemaAdd \n")
            create_schemas.write("FETCH NEXT FROM schemaAdd INTO @schema_name,@SQL_CREATE \n")
            create_schemas.write("WHILE @@FETCH_STATUS = 0  \n")
            create_schemas.write("\tBEGIN \n")
            utils.add_print(dbtype, 1, create_schemas, "Schema ['+@schema_name+'] needs to be created'")
            create_schemas.write("\t\tSET @sqlCode = @SQL_CREATE \n")
            utils.add_exec_sql(dbtype, 1, create_schemas)
            create_schemas.write("\n")
            create_schemas.write("\tFETCH NEXT FROM schemaAdd INTO @schema_name,@SQL_CREATE \n")
            create_schemas.write("END\n")
            create_schemas.write("\n")
            create_schemas.write("CLOSE schemaAdd\n")
            create_schemas.write("DEALLOCATE schemaAdd\n")

        elif dbtype == DBType.PostgreSQL:  # !MySQL
            create_schemas.write("\tdeclare temprow record;\n")
            create_schemas.write("\tBEGIN\n")
            create_schemas.write("\t\tFOR temprow IN\n")
            create_schemas.write("\t\t\tSELECT  s.schema_name ,  \n")
            create_schemas.write("\t\t\ts.SQL_CREATE \n")
            create_schemas.write(f"\t\t\tFROM    {db_syntax.temp_table_prefix}ScriptSchemas s\n")
            create_schemas.write("\t\t\tWHERE SchemaStat IN (1,3) --right now there aren't any 3 here but whatever. need to think about what to do when got a schema with a different authorization (principal_name in the table) \n")
            create_schemas.write("\t\tLOOP\n")
            utils.add_print(dbtype, 1, create_schemas, "'Adding Schema ' || temprow.schema_name || ':'")
            utils.add_exec_sql(dbtype, 1, create_schemas, "temprow.SQL_CREATE")
            create_schemas.write("\t\tEND LOOP;\n")
            create_schemas.write("\tEND; --off \n")
            create_schemas.write("END; --schema code\n")




    
    
    return create_schemas, drop_schemas