from src.defs.script_defs import DBType, DBSyntax, ScriptingOptions
from src.utils import funcs as utils


# Drop dependents before what they depend on: a trigger uses a function, a view can use both
DROP_ORDER_SQL = ("ORDER BY CASE UPPER(s.ent_type) WHEN 'TRIGGER' THEN 1 WHEN 'VIEW' THEN 2 ELSE 3 END, "
                  "s.ent_schema, s.ent_name")

# Create them the other way round, or a trigger is created before the function it calls and the run fails
# with 'function ... does not exist'. A view built on another view still depends on the name order below
ADD_ORDER_SQL = ("ORDER BY CASE UPPER(s.ent_type) WHEN 'TRIGGER' THEN 3 WHEN 'VIEW' THEN 2 ELSE 1 END, "
                 "s.ent_schema, s.ent_name")


def skip_coded_ents(got_specific_tables: bool, got_specific_ents: bool | None) -> bool:
    """Whether views, functions and triggers are left alone entirely.

    A named list of entities means exactly those, so code objects that aren't on it are out of scope. A named
    schema is different: it means that schema, its tables and its code alike, and leaving the code out made a
    filtered run report a view as different and then do nothing about it.

    got_specific_ents is None for callers that don't tell the two apart, who keep the old behaviour.
    """
    if got_specific_ents is None:
        return got_specific_tables
    return got_specific_ents


def write_pg_drop_coded_ent(sql_buffer, indent: int, db_type: DBType) -> None:
    """PostgreSQL: build the DROP for the coded entity in temprow and run it.

    A trigger needs the table it is on ('DROP TRIGGER x ON schema.table'), which ScriptCode doesn't hold, so it is
    looked up in the catalog; if it isn't found there the drop is skipped rather than executing NULL.
    ent_type is stored capitalised ('Function'), hence UPPER() before comparing."""
    align = "\t" * indent
    sql_buffer.write(f"{align}sqlCode := CASE WHEN UPPER(temprow.ent_type) = 'TRIGGER' THEN\n")
    sql_buffer.write(f"{align}\t\t(SELECT 'DROP TRIGGER ' || temprow.ent_name || ' ON ' || n.nspname || '.' || c.relname || ';'\n")
    sql_buffer.write(f"{align}\t\t\tFROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace\n")
    sql_buffer.write(f"{align}\t\t\tWHERE tg.tgname = temprow.ent_name AND LOWER(n.nspname) = LOWER(temprow.ent_schema) AND NOT tg.tgisinternal\n")
    sql_buffer.write(f"{align}\t\t\tLIMIT 1)\n")
    sql_buffer.write(f"{align}\tELSE 'DROP ' || temprow.ent_type || ' ' || temprow.ent_schema || '.' || temprow.ent_name\n")
    sql_buffer.write(f"{align}\t\t|| CASE WHEN UPPER(temprow.ent_type) IN ('FUNCTION', 'PROCEDURE') THEN '(' || COALESCE(temprow.param_type_list,'') || ')' ELSE '' END || ';'\n")
    sql_buffer.write(f"{align}\tEND;\n")
    sql_buffer.write(f"{align}IF sqlCode IS NOT NULL THEN\n")
    utils.add_exec_sql(db_type, indent + 1, sql_buffer)
    sql_buffer.write(f"{align}END IF;\n")


def generate_drop_coded_ents(db_type: DBType, sql_buffer, remove_all_extra_ents: bool, got_specific_tables: bool,
                             got_specific_ents: bool | None = None):
    """
    Generate DROP statements for coded entities (views, functions, procedures, triggers).

    This should be called BEFORE column changes, because views may depend on columns
    that will be dropped.

    Drops:
    - Extra entities (codeStat=2) if remove_all_extra_ents is True
    - Entities that need to be altered (codeStat=3) - they will be re-created later
    """
    sql_buffer.write("\n")
    if db_type == DBType.PostgreSQL:
        sql_buffer.write("BEGIN --drop coded entities\n")

    # Drop extra entities if configured. Not when only some entities are being scripted: everything outside the
    # filter would count as extra, and tables are already left alone in that case (see the state table for tables)
    if remove_all_extra_ents and not got_specific_tables:
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
            sql_buffer.write(f"\t\t{DROP_ORDER_SQL}\n")
            sql_buffer.write("LOOP\n")
            utils.add_print(db_type, 1, sql_buffer, "'' || temprow.ent_schema || '.' || temprow.ent_name || ' is extra. Drop this code:'")
            write_pg_drop_coded_ent(sql_buffer, 1, db_type)
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
        if not skip_coded_ents(got_specific_tables, got_specific_ents):
            sql_buffer.write("\tdeclare temprow record;\n")
            sql_buffer.write("\tBEGIN\n")
            sql_buffer.write("\t\tFOR temprow IN\n")
            sql_buffer.write("\t\t\tSELECT  s.ent_schema , s.ent_name, s.ent_type, S.param_type_list \n")
            sql_buffer.write("\t\t\tFROM ScriptCode s\n")
            sql_buffer.write("\t\t\tWHERE codeStat = 3 \n")
            # A function or procedure is written back with CREATE OR REPLACE and never needs dropping - and
            # dropping one that a trigger sits on fails outright with 'other objects depend on it'
            sql_buffer.write("\t\t\tAND UPPER(s.ent_type) NOT IN ('FUNCTION', 'PROCEDURE') \n")
            sql_buffer.write(f"\t\t\t{DROP_ORDER_SQL}\n")
            sql_buffer.write("\t\tLOOP\n")
            utils.add_print(db_type, 1, sql_buffer, "'' || temprow.ent_schema || '.' || temprow.ent_name || ' is different. Drop and then add:'")
            write_pg_drop_coded_ent(sql_buffer, 1, db_type)
            sql_buffer.write("\t\tEND LOOP;\n")
            sql_buffer.write("\tEND; --of cursor \n")

    # Wrap it up
    if db_type == DBType.PostgreSQL:
        sql_buffer.write("END; --drop coded entities\n")


def generate_add_coded_ents(db_type: DBType, sql_buffer, got_specific_tables: bool, got_specific_ents: bool | None = None):
    """
    Generate CREATE statements for coded entities (views, functions, procedures, triggers).

    This should be called AFTER column changes and data operations, because:
    - Views may reference columns that were just added
    - Functions may depend on tables/columns

    Creates:
    - New entities (codeStat=1)
    - Entities that were altered/dropped (codeStat=3) - re-creating them
    """
    sql_buffer.write("\n")
    if db_type == DBType.PostgreSQL:
        sql_buffer.write("BEGIN --add coded entities\n")

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
        utils.add_print(db_type, 1, sql_buffer, "'Adding ['+@table_schema+'].['+@table_name+']'")
        sql_buffer.write("\t\tSET @sqlCode = @SQL_CREATE \n")
        # Note: The original code had an additional parameter for add_exec_sql that we need to handle
        utils.add_exec_sql(db_type, 1, sql_buffer) #had here another param, not sure if important: , is_batch=True
        sql_buffer.write("\n")
        sql_buffer.write("\tFETCH NEXT FROM codedAdd INTO @table_schema, @table_name, @SQL_CREATE \n")
        sql_buffer.write("END\n")
        sql_buffer.write("\n")
        sql_buffer.write("CLOSE codedAdd\n")
        sql_buffer.write("DEALLOCATE codedAdd\n")

    elif db_type == DBType.PostgreSQL:
        if not skip_coded_ents(got_specific_tables, got_specific_ents):
            sql_buffer.write("\tdeclare temprow record;\n")
            sql_buffer.write("\tBEGIN\n")
            sql_buffer.write("\t\tFOR temprow IN\n")
            sql_buffer.write("\t\t\tSELECT  s.ent_schema , s.ent_name, s.sql_create, s.ent_type \n")
            sql_buffer.write("\t\t\tFROM ScriptCode s\n")
            sql_buffer.write("\t\t\tWHERE codeStat IN (1,3) \n")
            sql_buffer.write(f"\t\t\t{ADD_ORDER_SQL} \n")
            sql_buffer.write("\t\tLOOP\n")
            utils.add_print(db_type, 1, sql_buffer, "'' || temprow.ent_type || ' ' || temprow.ent_schema || '.' || temprow.ent_name || ' will be added'")
            utils.add_exec_sql(db_type, 1, sql_buffer, "temprow.SQL_CREATE")
            sql_buffer.write("\t\tEND LOOP;\n")
            sql_buffer.write("\tEND; --of cursor \n")

    # Wrap it up
    if db_type == DBType.PostgreSQL:
        sql_buffer.write("END; --add coded entities\n")


# Keep backward compatibility - original function that does both
def generate_coded_ents(db_type: DBType, sql_buffer, remove_all_extra_ents: bool, got_specific_tables: bool):
    """
    Legacy function that generates both DROP and CREATE statements.

    DEPRECATED: Use generate_drop_coded_ents() and generate_add_coded_ents() separately
    for proper dependency ordering (drops before column changes, adds after).
    """
    generate_drop_coded_ents(db_type, sql_buffer, remove_all_extra_ents, got_specific_tables)
    generate_add_coded_ents(db_type, sql_buffer, got_specific_tables)
