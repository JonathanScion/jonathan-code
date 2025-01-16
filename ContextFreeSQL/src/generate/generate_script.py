from data_load.from_db.load_from_db_pg import TableSchema
from enum import Enum
from dataclasses import dataclass
from .generate_defs import DBType, DBSyntax



def generate_all_script(schema: TableSchema, dbtype: DBType):
    db_syntax = DBSyntax.get_syntax(dbtype)
    build_script_header(db_syntax, 'theSome.sql')
    return



def build_script_header(db_syntax: DBSyntax ,filename):
    # Using list of strings for better performance when building large strings
    header_lines = []
    header_lines.append("------------------------Context Free Script------------------------------------------")
    header_lines.append("--Parameters: @print: PRINT english description of what the script is doing")
    header_lines.append("--            @printExec: PRINT the SQL statements the script generates")
    header_lines.append("--            @execCode: EXECUTE the script on the database")
    header_lines.append("")
    header_lines.append("--feel free to change these flags")
    
    
    header_lines.append(f"DECLARE {db_syntax.var_prefix}print {db_syntax.boolean_type} {db_syntax.set_operator} 1{db_syntax.declare_separator} ")
    header_lines.append(f"\t{db_syntax.var_prefix}printExec {db_syntax.boolean_type} {db_syntax.set_operator} 1{db_syntax.declare_separator} ")
    header_lines.append(f"\t{db_syntax.var_prefix}execCode {db_syntax.boolean_type} {db_syntax.set_operator} 1;")
    header_lines.append("-------------------------------------------------------------------------------------")
    header_lines.append("")
    
    # Join all lines with newline character
    header_content = "\n".join(header_lines)

    # Write content to file
    with open(filename, 'w') as f:
        f.write(header_content)
    
    return header_content