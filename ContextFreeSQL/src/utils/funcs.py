import pandas as pd
from src.defs.script_defs import DBType
from io import StringIO
from typing import Any
from typing import Optional , Union, Any
import math
import json

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


def format_value_for_sql(value: Any) -> str:
    """Format a value for SQL INSERT statement.

    Handles:
    - NULL/NaN -> NULL
    - Floats that are whole numbers (42.0) -> '42' (quoted integer)
    - Other numbers -> quoted as-is
    - Strings -> quoted with escaped single quotes
    - Booleans -> 'true'/'false'
    - Dicts/Lists (JSON/JSONB) -> proper JSON serialization with double quotes
    """
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return "NULL"

    if isinstance(value, bool):
        return "'true'" if value else "'false'"

    # Handle dict and list types (JSON/JSONB columns)
    # Must check before other types since we need proper JSON serialization
    if isinstance(value, (dict, list)):
        json_str = json.dumps(value)
        # Escape single quotes for SQL
        json_str = json_str.replace("'", "''")
        return f"'{json_str}'"

    if isinstance(value, float):
        # Convert whole number floats to integers (42.0 -> 42)
        if value.is_integer():
            return f"'{int(value)}'"
        return f"'{value}'"

    if isinstance(value, int):
        return f"'{value}'"

    # String or other - escape single quotes
    str_val = str(value).replace("'", "''")
    return f"'{str_val}'"

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


def write_drop_temp_table_if_exists(db_type: DBType, indent_level: int, script: StringIO, table_name: str) -> None:
    """Write the drop-if-exists pattern for temp tables (PostgreSQL)."""
    align = "\t" * indent_level
    if db_type == DBType.PostgreSQL:
        script.write(f"{align}PERFORM n.nspname, c.relname\n")
        script.write(f"{align}FROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace\n")
        script.write(f"{align}WHERE n.nspname LIKE 'pg_temp_%' AND c.relname='{table_name.lower()}' AND pg_catalog.pg_table_is_visible(c.oid);\n")
        script.write(f"{align}IF FOUND THEN\n")
        script.write(f"{align}\tDROP TABLE {table_name};\n")
        script.write(f"{align}END IF;\n")


def parse_pg_array(array_str):
    # If already a list, return it as-is
    if isinstance(array_str, list):
        return array_str
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

def is_type_string(type_name: str):
    # Convert argument to lowercase for case-insensitive comparison
    type_lower = type_name.lower()
    
    # Check for string types
    if type_lower in ["varchar", "char", "nvarchar", "nchar", "binary", "varbinary", "character varying"]:
        return [True, False]
    
    # Check for datetime types
    if type_lower.startswith(("time", "date")): #going by PG: https://www.postgresql.org/docs/current/datatype-datetime.html before was: case ["datetime", "smalldatetime", "time"]
        # In Python we can't modify a boolean directly by reference,
        # but if the caller passes a list with one boolean element, we can modify that
        return [False, True]
    
    # Not a string or datetime type
    return [False, False]



""""
"maybe will need this someday:"
def is_pgsql_quote_required(type_name):
    # Convert argument to lowercase for case-insensitive comparison
    type_lower = type_name.lower()
    
    # Check for datetime types
    if type_lower.startswith(("varchar", "char", "nvarchar", "nchar", "binary", "varbinary", "character varying"))  or type_lower.startswith(("time", "date")): #going by PG: https://www.postgresql.org/docs/current/datatype-datetime.html before was: case ["datetime", "smalldatetime", "time"]
        # In Python we can't modify a boolean directly by reference,
        # but if the caller passes a list with one boolean element, we can modify that
        return False
    
    # Not a string or datetime type
    return False"
"""



def can_type_be_compared(type_name):
    type_name_lower = type_name.lower()
    
    if type_name_lower in ["xml", "text", "ntext"]:
        return False
    else:
        return True