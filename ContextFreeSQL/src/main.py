import sys
from pathlib import Path
import site; print(site.getsitepackages())  # Show where Python looks for packages
from dotenv import load_dotenv
from dataclasses import dataclass

from data_load.from_db.load_from_db_pg import load_all_schema
from generate.generate_script import generate_all_script
from generate.generate_defs import DBType

def main():
    load_dotenv()

    schema = load_all_schema()
    # Process results...

    generate_all_script(schema, DBType.PostgreSQL )

print(sys.executable)  # Shows which Python is running
#print(sys.version)
main()



