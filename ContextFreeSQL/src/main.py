import sys
import argparse
import getpass
from pathlib import Path
from dataclasses import dataclass
import os
import shutil

from src.utils.load_config import load_config
from src.utils.resources import get_template_path, get_default_config_path, is_bundled
from src.data_load.from_db.load_from_db_pg import load_all_schema, load_all_db_ents, load_all_tables_data
from src.generate.generate_script import generate_all_script
from src.defs.script_defs import DBType, ScriptingOptions, ConfigVals


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description='ContextFreeSQL - Generate database migration scripts',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  contextfreesql config.json
  contextfreesql config.json --password=secret123
  contextfreesql prod_config.json --password
        '''
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

    # Load configuration
    config_vals: ConfigVals = load_config(args.config)

    # Handle password: command line > config file > interactive prompt
    if args.password == 'PROMPT':
        # --password flag given without value, prompt for it
        config_vals.db_conn.password = getpass.getpass('Password: ')
    elif args.password is not None:
        # --password=value given, use it
        config_vals.db_conn.password = args.password
    elif not config_vals.db_conn.password:
        # No password in config file either, prompt for it
        config_vals.db_conn.password = getpass.getpass('Password: ')

    # Copy HTML template to output directory so pg_read_file can access it
    output_dir = os.path.dirname(config_vals.input_output.output_sql)
    os.makedirs(output_dir, exist_ok=True)

    # Resolve template paths - use bundled templates if path doesn't exist
    html_template_source = config_vals.input_output.html_template_path
    if not os.path.exists(html_template_source):
        # Try bundled template
        html_template_source = get_template_path('db_compare_template.html')

    if os.path.exists(html_template_source):
        template_filename = os.path.basename(html_template_source)
        new_template_path = os.path.join(output_dir, template_filename).replace("\\", "/")

        # Copy the template file
        shutil.copy2(html_template_source, new_template_path)
        print(f"Copied template to: {new_template_path}")

        # Update the path so SQL will reference the copied file
        config_vals.input_output.html_template_path = new_template_path

    # Resolve diff template path
    diff_template_source = config_vals.input_output.diff_template_path
    if not os.path.exists(diff_template_source):
        # Try bundled template
        diff_template_source = get_template_path('code_diff_template.html')

    if os.path.exists(diff_template_source):
        diff_template_filename = os.path.basename(diff_template_source)
        new_diff_template_path = os.path.join(output_dir, diff_template_filename).replace("\\", "/")

        # Copy the diff template file
        shutil.copy2(diff_template_source, new_diff_template_path)
        print(f"Copied diff template to: {new_diff_template_path}")

        # Update the path so SQL will reference the copied file
        config_vals.input_output.diff_template_path = new_diff_template_path

    # Copy CSV compare template if we have data tables to script
    if len(config_vals.tables_data.tables) >= 1:
        csv_compare_template = get_template_path('csv_compare_standalone.html')
        if os.path.exists(csv_compare_template):
            new_csv_template_path = os.path.join(output_dir, "csv_compare_standalone.html").replace("\\", "/")
            shutil.copy2(csv_compare_template, new_csv_template_path)
            print(f"Copied CSV compare template to: {new_csv_template_path}")

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
  
    script = generate_all_script(schema, db_type= DBType.PostgreSQL, tbl_ents=tbl_ents, scrpt_ops= config_vals.script_ops, input_output=config_vals.input_output, got_specific_tables = (len(config_vals.db_ents_to_load.tables) >= 1), tables_data=config_vals.tables_data, sql_script_params=config_vals.sql_script_params)

    with open(config_vals.input_output.output_sql, 'w') as f:
       f.write(script)

    print(f"Script written to: {config_vals.input_output.output_sql}")


if __name__ == "__main__":
    main()

