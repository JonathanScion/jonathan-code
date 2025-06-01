import sys
from pathlib import Path
import site; print(site.getsitepackages())  # Show where Python looks for packages
from dotenv import load_dotenv
from dataclasses import dataclass
import os

from src.utils.load_config import load_config
from src.data_load.from_db.load_from_db_pg import load_all_schema, load_all_db_ents, load_all_tables_data
from src.generate.generate_script import generate_all_script
from src.defs.script_defs import DBType, ScriptingOptions, ConfigVals

def main():
    load_dotenv()
    
    # Load configuration
    config_path = sys.argv[1] if len(sys.argv) > 1 else None
    config_vals: ConfigVals = load_config(config_path)


    schema = load_all_schema(config_vals.db_conn)

    tbl_ents = load_all_db_ents(config_vals.db_conn)
   
    
    # Mark tables for scripting
    if config_vals.tables_to_load:
        mask = False
        for table in config_vals.tables_to_load:
            mask = mask | (tbl_ents['entkey'] == table)
        tbl_ents.loc[mask, 'scriptdata'] = True
    

    load_all_tables_data(config_vals.db_conn, db_all = schema, table_names = config_vals.tables_to_load)
  
    script = generate_all_script(schema, db_type= DBType.PostgreSQL, tbl_ents=tbl_ents, scrpt_ops= config_vals.script_ops )

    with open(r'C:\Users\yonis\source\repos\veteran-developer\ContextFreeSQL\tests\sample_out.sql', 'w') as f:
       f.write(script)
       
print(sys.executable)  # Shows which Python is running
#print(sys.version)
main()



