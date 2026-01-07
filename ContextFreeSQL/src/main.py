import sys
import argparse
import getpass
from pathlib import Path
from dataclasses import dataclass
from datetime import datetime
import os
import shutil

from src.utils.load_config import load_config
from src.utils.resources import get_template_path, get_default_config_path, get_docs_path, is_bundled
from src.data_load.from_db.load_from_db_pg import load_all_schema, load_all_db_ents, load_all_tables_data
from src.generate.generate_script import generate_all_script
from src.defs.script_defs import DBType, ScriptingOptions, ConfigVals

__version__ = '0.2.2'


def show_config_docs():
    """Display the configuration documentation."""
    docs_path = get_docs_path('CONFIG.md')
    if os.path.exists(docs_path):
        with open(docs_path, 'r', encoding='utf-8') as f:
            print(f.read())
    else:
        # Fallback inline documentation
        print("""
ContextFreeSQL Configuration Reference
======================================

Configuration file documentation not found at: {docs_path}

For full documentation, see: docs/CONFIG.md in the source repository.

Quick Reference:
----------------

database:
  host        - Database server hostname
  db_name     - Database name
  user        - Database username
  password    - Database password (or use --password flag)
  port        - Database port (default: 5432)

scripting_options:
  remove_all_extra_ents    - Drop entities not in source (default: false)
  script_schemas           - Include schema DDL (default: true)
  script_security          - Include roles/permissions (default: true)

db_ents_to_load:
  tables      - List of entities to script (empty = all)

tables_data:
  tables      - List of tables to script data for (empty = all)
  from_file   - Load data from CSV files (default: false)

input_output:
  output_sql  - Path for generated SQL script

sql_script_params:
  print       - Print descriptions (default: true)
  print_exec  - Print SQL statements (default: true)
  exec_code   - Execute statements (default: true)
  html_report - Generate HTML report (default: true)
  export_csv  - Export to CSV (default: false)

For complete documentation, visit:
https://github.com/JonathanScion/jonathan-code
""".format(docs_path=docs_path))


def resolve_output_filename(template_path: str, host: str, database: str) -> str:
    """
    Resolve placeholders in the output filename template.

    Supported placeholders:
        {host}      - Database host
        {database}  - Database name
        {timestamp} - Current timestamp (yyyyMMdd_HHmmss)

    Args:
        template_path: Path with optional placeholders
        host: Database host value
        database: Database name value

    Returns:
        Resolved path with placeholders replaced
    """
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

    resolved = template_path.replace('{host}', host)
    resolved = resolved.replace('{database}', database)
    resolved = resolved.replace('{timestamp}', timestamp)

    return resolved


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        prog='contextfreesql',
        description='''ContextFreeSQL - Generate database migration scripts from PostgreSQL

Command Line Options Summary:
+------------------+-------+--------------------------------------------------+
| Option           | Short | Description                                      |
+------------------+-------+--------------------------------------------------+
| --help           | -h    | Show this help message                           |
| --version        | -v    | Show version number                              |
| --show-config    | -c    | Show full config.json documentation              |
| --password VALUE | -p    | Override database password from config           |
| --password       | -p    | Prompt for password interactively                |
| config           |       | Path to config.json (default: src/config.json)   |
+------------------+-------+--------------------------------------------------+

Environment Variables (override config.json values):
  PGHOST       - Database host
  PGPORT       - Database port
  PGUSER       - Database user
  PGPASSWORD   - Database password
  PGDATABASE   - Database name
''',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  contextfreesql config.json                    Run with config file
  contextfreesql config.json --password=secret  Override password
  contextfreesql config.json -p                 Prompt for password
  contextfreesql --show-config                  Show config.json documentation
  contextfreesql -c | more                      Page through config docs

  # Using environment variables:
  set PGPASSWORD=secret && contextfreesql config.json
  export PGPASSWORD=secret && contextfreesql config.json  (Linux/Mac)

Priority (highest to lowest):
  1. Command line arguments (--password)
  2. Environment variables (PGPASSWORD, etc.)
  3. config.json values
  4. Interactive prompt (for password only)

Description:
  Extracts complete schema and data from a PostgreSQL database and generates
  standalone SQL scripts that can recreate the database from scratch. The
  generated scripts are "context-free" - they contain all necessary DDL
  (schema) and DML (data) statements with proper dependency ordering.

Config file:
  Create a config.json file with your database connection settings and
  scripting options. Use --show-config to see full documentation.

More info:
  https://github.com/JonathanScion/jonathan-code
        '''
    )
    parser.add_argument(
        '--version', '-v',
        action='version',
        version=f'%(prog)s {__version__}'
    )
    parser.add_argument(
        '--show-config', '-c',
        action='store_true',
        help='Show full configuration file documentation and exit'
    )
    parser.add_argument(
        'config',
        nargs='?',
        default=None,
        help='Path to config.json file (default: src/config.json)'
    )
    parser.add_argument(
        '--password', '-p',
        nargs='?',
        const='PROMPT',  # If --password is given without value, set to PROMPT
        default=None,
        help='Database password. If flag is given without value, prompts interactively.'
    )
    return parser.parse_args()


def main():
    # Parse command line arguments
    args = parse_args()

    # Handle --show-config flag
    if args.show_config:
        show_config_docs()
        return

    # Load configuration
    config_vals: ConfigVals = load_config(args.config)

    # Apply environment variables (override config.json values)
    if os.environ.get('PGHOST'):
        config_vals.db_conn.host = os.environ['PGHOST']
    if os.environ.get('PGPORT'):
        config_vals.db_conn.port = os.environ['PGPORT']
    if os.environ.get('PGUSER'):
        config_vals.db_conn.user = os.environ['PGUSER']
    if os.environ.get('PGDATABASE'):
        config_vals.db_conn.db_name = os.environ['PGDATABASE']
    # PGPASSWORD is handled below with other password options

    # Handle password: command line > env var > config file > interactive prompt
    if args.password == 'PROMPT':
        # --password flag given without value, prompt for it
        config_vals.db_conn.password = getpass.getpass('Password: ')
    elif args.password is not None:
        # --password=value given, use it
        config_vals.db_conn.password = args.password
    elif os.environ.get('PGPASSWORD'):
        # Environment variable set, use it
        config_vals.db_conn.password = os.environ['PGPASSWORD']
    elif not config_vals.db_conn.password:
        # No password anywhere, prompt for it
        config_vals.db_conn.password = getpass.getpass('Password: ')

    # Resolve output filename template placeholders
    config_vals.input_output.output_sql = resolve_output_filename(
        config_vals.input_output.output_sql,
        config_vals.db_conn.host,
        config_vals.db_conn.db_name
    )

    # Convert all paths to absolute (PostgreSQL COPY requires absolute paths)
    config_vals.input_output.output_sql = os.path.abspath(config_vals.input_output.output_sql).replace("\\", "/")
    config_vals.input_output.html_output_path = os.path.abspath(config_vals.input_output.html_output_path).replace("\\", "/")
    config_vals.input_output.diff_output_dir = os.path.abspath(config_vals.input_output.diff_output_dir).replace("\\", "/")
    print(f"Output SQL path: {config_vals.input_output.output_sql}")

    # Copy HTML template to output directory so pg_read_file can access it
    output_dir = os.path.dirname(config_vals.input_output.output_sql)
    os.makedirs(output_dir, exist_ok=True)

    # Resolve template paths - use bundled templates if path doesn't exist
    html_template_source = config_vals.input_output.html_template_path
    if not html_template_source or not os.path.exists(html_template_source):
        # Try bundled template
        html_template_source = get_template_path('db_compare_template.html')
        if html_template_source and os.path.exists(html_template_source):
            print(f"Using bundled template: {html_template_source}")

    if html_template_source and os.path.exists(html_template_source):
        template_filename = os.path.basename(html_template_source)
        new_template_path = os.path.join(output_dir, template_filename).replace("\\", "/")

        # Copy the template file
        shutil.copy2(html_template_source, new_template_path)
        print(f"Copied template to: {new_template_path}")

        # Update the path so SQL will reference the copied file
        config_vals.input_output.html_template_path = new_template_path
    else:
        print(f"WARNING: HTML template not found. Tried: {config_vals.input_output.html_template_path}")
        print(f"         Bundled path: {get_template_path('db_compare_template.html')}")
        print("         HTML report generation may fail.")

    # Resolve diff template path
    diff_template_source = config_vals.input_output.diff_template_path
    if not diff_template_source or not os.path.exists(diff_template_source):
        # Try bundled template
        diff_template_source = get_template_path('code_diff_template.html')
        if diff_template_source and os.path.exists(diff_template_source):
            print(f"Using bundled diff template: {diff_template_source}")

    if diff_template_source and os.path.exists(diff_template_source):
        diff_template_filename = os.path.basename(diff_template_source)
        new_diff_template_path = os.path.join(output_dir, diff_template_filename).replace("\\", "/")

        # Copy the diff template file
        shutil.copy2(diff_template_source, new_diff_template_path)
        print(f"Copied diff template to: {new_diff_template_path}")

        # Update the path so SQL will reference the copied file
        config_vals.input_output.diff_template_path = new_diff_template_path
    else:
        print(f"WARNING: Diff template not found. Tried: {config_vals.input_output.diff_template_path}")
        print(f"         Bundled path: {get_template_path('code_diff_template.html')}")
        print("         Code diff generation may fail.")

    schema = load_all_schema(config_vals.db_conn, load_security=config_vals.script_ops.script_security)

     # Determine which entities to load
    if len(config_vals.db_ents_to_load.tables) >= 1:
        # Load specific entities from config
        entities_to_load = config_vals.db_ents_to_load.tables
        tbl_ents = load_all_db_ents(config_vals.db_conn, entity_filter=entities_to_load)  # Assuming load_all_db_ents supports filtering
    else:
        # Default: load all entities
        tbl_ents = load_all_db_ents(config_vals.db_conn)

    # Mark tables for scripting
    if len(config_vals.tables_data.tables) >= 1:  # Changed from >1 to >=1 to handle single table
        # Get the specific tables from config
        tables_to_script = config_vals.tables_data.tables
        
        # Mark scriptdata=True for the specified tables
        table_filter = tbl_ents['entschema'] + '.' + tbl_ents['entname']
        tbl_ents.loc[table_filter.isin(tables_to_script), 'scriptdata'] = True
        
        # Load data for these specific tables
        load_all_tables_data(config_vals.db_conn, db_all=schema, table_names=tables_to_script)    
    else: #just load all tables
        table_rows = tbl_ents[tbl_ents['enttype'] == 'Table']
        config_vals.tables_data.tables = (table_rows['entschema'] + '.' + table_rows['entname']).tolist()
        # Set scriptdata to True for all tables
        tbl_ents.loc[tbl_ents['enttype'] == 'Table', 'scriptdata'] = True
        #and load
        load_all_tables_data(config_vals.db_conn, db_all = schema, table_names = config_vals.tables_data.tables)

    # Copy CSV compare template if we have data tables to script (must be after tables_data.tables is populated)
    if len(config_vals.tables_data.tables) >= 1:
        csv_compare_template = get_template_path('csv_compare_standalone.html')
        if csv_compare_template and os.path.exists(csv_compare_template):
            new_csv_template_path = os.path.join(output_dir, "csv_compare_standalone.html").replace("\\", "/")
            shutil.copy2(csv_compare_template, new_csv_template_path)
            print(f"Copied CSV compare template to: {new_csv_template_path}")
        else:
            print(f"WARNING: CSV compare template not found at: {csv_compare_template}")
            print("         Data comparison HTML may fail.")

    script = generate_all_script(schema, db_type= DBType.PostgreSQL, tbl_ents=tbl_ents, scrpt_ops= config_vals.script_ops, input_output=config_vals.input_output, got_specific_tables = (len(config_vals.db_ents_to_load.tables) >= 1), tables_data=config_vals.tables_data, sql_script_params=config_vals.sql_script_params)

    with open(config_vals.input_output.output_sql, 'w') as f:
       f.write(script)

    print(f"Script written to: {config_vals.input_output.output_sql}")


if __name__ == "__main__":
    main()

