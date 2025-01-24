import pandas as pd
from src.defs.script_defs import DBType
from io import StringIO


def quote_str_or_null(value):
    return "NULL" if pd.isna(value) else f"'{value}'"

def add_print(db_type: DBType, num_tabs: int, script: StringIO, print_line: str) -> None:
   # Build tab alignment
   align = "\t" * num_tabs
   
   if db_type == DBType.MSSQL:
       script.write(f"{align}If (@print=1) PRINT ")
       
       # Handle the print line
       if print_line.startswith("'"):
           script.write("'--")
           script.write(print_line[1:] + "\n")
       else:
           script.write("'--")
           script.write(print_line + "\n")
           
   elif db_type == DBType.PostgreSQL:
       # Simple text: always put to log table
       script.write(f"{align}IF (print=True) THEN\n")
       script.write(f"{align}\tINSERT INTO scriptoutput (SQLText)\n")
       
       # Handle the print line
       if print_line.startswith("'"):
           print_line = print_line[1:]
           
       # Don't need Utils.TrimEnclosing here as we're handling the quotes directly
       script.write(f"{align}\tVALUES ('--{print_line});\n")
       script.write(f"{align}END IF;\n")


def add_exec_sql(db_type: DBType, num_tabs: int, script: StringIO, exec_str_name: str = "sqlCode", prefix_go_for_print: bool = False) -> None:
   # Build tab alignment
   align = "\t" * num_tabs
   
   if db_type == DBType.MSSQL:
       prefix = "'GO'+CHAR(13) + CHAR(10)+" if prefix_go_for_print else ""
       script.write(f"{align}IF (@printExec=1) PRINT {prefix}@{exec_str_name}\n")
       script.write(f"{align}IF (@execCode=1) EXEC(@{exec_str_name})\n")
       script.write(f"{align}SET @schemaChanged = 1\n")
       
   elif db_type == DBType.PostgreSQL:
       script.write(f"{align}IF (printExec = True) THEN \n")
       script.write(f"{align}\tINSERT INTO scriptoutput (SQLText)\n")
       # No quotes if its variable, say the default value, 'sqlCode'. but maybe if i bring in a string, i'll need quotes? how could i distinguish a variable transferred here, from a string?
       script.write(f"{align}\tVALUES ({exec_str_name});\n")
       script.write(f"{align}END IF;\n")
       script.write(f"{align}IF (execCode = True) THEN\n")
       script.write(f"{align}\tEXECUTE {exec_str_name};\n")
       script.write(f"{align}END IF;\n")
       script.write(f"{align}schemaChanged = True;\n")  # !no! what if its only data?? fix also for MS (but maybe its ok... see where this one is used
       


def parse_pg_array(array_str):
    # Remove curly braces and split
    if pd.isna(array_str):
        return []
    clean_str = str(array_str).strip('{}[]')
    if not clean_str:
        return []
    return [int(x.strip()) for x in clean_str.split(',')]