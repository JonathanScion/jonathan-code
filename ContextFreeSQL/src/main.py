import sys
from pathlib import Path
import site; print(site.getsitepackages())  # Show where Python looks for packages
from dotenv import load_dotenv
from dataclasses import dataclass

from src.data_load.from_db.load_from_db_pg import load_all_schema
from src.generate.generate_script import generate_all_script
from src.defs.script_defs import DBType, ScriptingOptions

def main():
    load_dotenv()

    script_ops = ScriptingOptions() #! get this from command line (optional param, can point to a file)

    schema = load_all_schema()
    # Process results...

    generate_all_script(schema, DBType.PostgreSQL, script_ops )

print(sys.executable)  # Shows which Python is running
#print(sys.version)
main()



