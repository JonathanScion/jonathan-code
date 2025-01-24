from io import StringIO
from src.data_load.from_db.load_from_db_pg import DBSchema
from src.defs.script_defs import DBType, DBSyntax, ScriptingOptions
from src.generate.generate_db_ent_types.schemas import create_db_state_schemas


def generate_all_script(schema: DBSchema, dbtype: DBType, scrpt_ops: ScriptingOptions) -> str:
    """
    Generates complete SQL script using StringIO for efficient string building.
    
    Args:
        schema: Table schema information
        dbtype: Type of database (MSSQL or PostgreSQL)
    
    Returns:
        str: Complete SQL script
    """
    db_syntax = DBSyntax.get_syntax(dbtype)
    buffer = StringIO()
    
    # 1. Add header
    header = build_script_header(db_syntax, 'theSome.sql')
    buffer.write(header)

    if dbtype == DBType.PostgreSQL:
        buffer.write("DO $$\n")
        buffer.write("BEGIN --overall code\n")
    
    # 2. State tables
    # TODO: Complete this section
    # bOnlyData = tblEnts.Select("ScriptSchema=False AND ScriptData=True").Length > 0
    # if oScriptOps.ScriptSchemas and (not bOnlyData):
    create_schemas, drop_schemas = create_db_state_schemas(dbtype, schema.tables, schema.schemas , scrpt_ops.all_schemas, scrpt_ops.remove_all_extra_ents)
    buffer.write(create_schemas.getvalue())
    buffer.write(drop_schemas.getvalue())
    
    #end out buffer
    if dbtype == DBType.PostgreSQL:
        buffer.write("END; --overall code\n")  # close all openings of PG code
        buffer.write("$$\n")
        buffer.write(";select * from scriptoutput\n")

    elif dbtype == DBType.MSSQL:
        buffer.write("SET NOCOUNT OFF\n")

    # Get final string and clean up
    result = buffer.getvalue()
    buffer.close()
    
    return result


def build_script_header(db_syntax: DBSyntax, filename: str) -> str:   
    header = StringIO()
    
    # Write header lines
    header.write("------------------------Context Free Script------------------------------------------\n")
    header.write("--Parameters: @print: PRINT english description of what the script is doing\n")
    header.write("--            @printExec: PRINT the SQL statements the script generates\n")
    header.write("--            @execCode: EXECUTE the script on the database\n")
    header.write("\n")
    header.write("--feel free to change these flags\n")
    
    # Write variable declarations
    header.write(f"DECLARE {db_syntax.var_prefix}print {db_syntax.boolean_type} ")
    header.write(f"{db_syntax.set_operator} 1{db_syntax.declare_separator} \n")
    header.write(f"\t{db_syntax.var_prefix}printExec {db_syntax.boolean_type} ")
    header.write(f"{db_syntax.set_operator} 1{db_syntax.declare_separator} \n")
    header.write(f"\t{db_syntax.var_prefix}execCode {db_syntax.boolean_type} ")
    header.write(f"{db_syntax.set_operator} 1;\n")
    header.write("-------------------------------------------------------------------------------------\n")
    header.write("\n")
    
    # Get content and clean up
    header_content = header.getvalue()
    header.close()
    
    # Write to file
    with open(filename, 'w') as f:
        f.write(header_content)
    
    return header_content