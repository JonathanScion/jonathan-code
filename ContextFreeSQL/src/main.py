from data_load.from_db.load_from_db_pg import load_all_schema
import sys
from pathlib import Path
import site; print(site.getsitepackages())  # Show where Python looks for packages
from dotenv import load_dotenv


def main():
    load_dotenv()

    results = load_all_schema()
    # Process results...

print(sys.executable)  # Shows which Python is running
main()



