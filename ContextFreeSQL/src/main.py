import sys
from pathlib import Path
import site; print(site.getsitepackages())  # Show where Python looks for packages
from dotenv import load_dotenv
from dataclasses import dataclass


from src.data_load.from_db.load_from_db_pg import load_all_schema, load_all_db_ents, load_all_tables_data
from src.generate.generate_script import generate_all_script
from src.defs.script_defs import DBType, ScriptingOptions

def main():
    load_dotenv()

    script_ops = ScriptingOptions() #! get this from command line (optional param, can point to a file)

    schema = load_all_schema()

    tbl_ents = load_all_db_ents()

    #!remove of course. load from command line
    tables_to_load = ["public.students", "public.studentgrades"] 
    mask = (tbl_ents['entkey'] == 'public.students') | (tbl_ents['entkey'] == 'public.studentgrades')
    tbl_ents.loc[mask, 'scriptdata'] = True

    load_all_tables_data(db_all = schema, table_names = tables_to_load)
  
    script = generate_all_script(schema, db_type= DBType.PostgreSQL, tbl_ents=tbl_ents, scrpt_ops= script_ops )

    with open(r'C:\Users\yonis\source\repos\veteran-developer\ContextFreeSQL\tests\sample_out.sql', 'w') as f:
       f.write(script)
       
print(sys.executable)  # Shows which Python is running
#print(sys.version)
main()



