import pandas as pd
from src.defs.script_defs import DBType
from io import StringIO
from typing import Any
from typing import Optional , Union, Any 
import math

def quote_str_or_null(value: Any) -> str:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return "NULL"
    if isinstance(value, str):
        return f"'{value.replace('\'', '\'\'')}'"
    return str(f"'{value}'")

def quote_str_or_null_bool(value: bool) -> str:
    if value is None:
        return "NULL"    
    return 'True' if value else 'False'

def numeric_or_null(value: float) -> str:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return "NULL"
    return str(value)

def bool_to_sql_bit_boolean_val(val, full_boolean):    
    if val is None:
        return "NULL"
    
    bool_val = bool(val)
    
    if full_boolean:
        return "True" if bool_val else "False"  # typically PostgreSQL, maybe MySQL
    else:
        return "1" if bool_val else "0"  # typically MS SQL

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
       script.write(f"{align}schemaChanged := True;\n")  # !no! what if its only data?? fix also for MS (but maybe its ok... see where this one is used
       


def parse_pg_array(array_str):
    # Remove curly braces and split
    if pd.isna(array_str):
        return []
    clean_str = str(array_str).strip('{}[]')
    if not clean_str:
        return []
    return [int(x.strip()) for x in clean_str.split(',')]


def val_if_null(value: Any, default: Any) -> Any:
    return default if value is None else value

def c_to_bool(value: Any, default: bool = False) -> bool:
    return bool(value) if value is not None else default

def is_type_string(type_name, out_datetime=False):
    # Convert argument to lowercase for case-insensitive comparison
    type_lower = type_name.lower()
    
    # Check for string types
    if type_lower in ["varchar", "char", "nvarchar", "nchar", "binary", "varbinary", "character varying"]:
        return True
    
    # Check for datetime types
    if type_lower in ["datetime", "smalldatetime", "time"]:
        # In Python we can't modify a boolean directly by reference,
        # but if the caller passes a list with one boolean element, we can modify that
        if isinstance(out_datetime, list) and len(out_datetime) > 0:
            out_datetime[0] = True
        return False
    
    # Not a string or datetime type
    return False