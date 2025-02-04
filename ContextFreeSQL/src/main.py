import sys
from pathlib import Path
import site; print(site.getsitepackages())  # Show where Python looks for packages
from dotenv import load_dotenv
from dataclasses import dataclass

from src.data_load.from_db.load_from_db_pg import load_all_schema
from src.generate.generate_script import generate_all_script
from src.generate.generate_create_table import  get_create_table_from_sys_tables
from src.defs.script_defs import DBType, ScriptingOptions

def main():
    load_dotenv()

    script_ops = ScriptingOptions() #! get this from command line (optional param, can point to a file)

    schema = load_all_schema()

    #2025/01/30: test, just call the CREATE TABLE generator
    script = get_create_table_from_sys_tables(db_type=DBType.PostgreSQL,                                                          
                                                            table_schema='public',
                                                            table_name='students',
                                                            schema_tables = schema,
                                                            #script_table_ops = script_ops, #its ScriptTableOptions
                                                            force_allow_null = False)
    print (script)
    #script = generate_all_script(schema, DBType.PostgreSQL, script_ops )

    with open(r'C:\Users\yonis\source\repos\veteran-developer\ContextFreeSQL\tests\sample_out.sql', 'w') as f:
       f.write(script)
       
print(sys.executable)  # Shows which Python is running
#print(sys.version)
main()



