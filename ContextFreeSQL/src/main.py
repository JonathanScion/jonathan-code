import sys
from pathlib import Path
import site; print(site.getsitepackages())  # Show where Python looks for packages
from dataclasses import dataclass
import os
import shutil

from src.utils.load_config import load_config
from src.data_load.from_db.load_from_db_pg import load_all_schema, load_all_db_ents, load_all_tables_data
from src.generate.generate_script import generate_all_script
from src.defs.script_defs import DBType, ScriptingOptions, ConfigVals

def main():
    # Load configuration
    config_path = sys.argv[1] if len(sys.argv) > 1 else None
    config_vals: ConfigVals = load_config(config_path)

    # Copy HTML template to output directory so pg_read_file can access it
    output_dir = os.path.dirname(config_vals.input_output.output_sql)
    os.makedirs(output_dir, exist_ok=True)

    if config_vals.input_output.html_template_path:
        template_filename = os.path.basename(config_vals.input_output.html_template_path)
        new_template_path = os.path.join(output_dir, template_filename).replace("\\", "/")

        # Copy the template file
        shutil.copy2(config_vals.input_output.html_template_path, new_template_path)
        print(f"Copied template to: {new_template_path}")

        # Update the path so SQL will reference the copied file
        config_vals.input_output.html_template_path = new_template_path

    # Copy CSV compare template if we have data tables to script
    if len(config_vals.tables_data.tables) >= 1:
        src_dir = os.path.dirname(os.path.abspath(__file__))
        csv_compare_template = os.path.join(src_dir, "templates", "csv_compare_standalone.html")
        if os.path.exists(csv_compare_template):
            new_csv_template_path = os.path.join(output_dir, "csv_compare_standalone.html").replace("\\", "/")
            shutil.copy2(csv_compare_template, new_csv_template_path)
            print(f"Copied CSV compare template to: {new_csv_template_path}")

    schema = load_all_schema(config_vals.db_conn)

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
       
print(sys.executable)  # Shows which Python is running
#print(sys.version)
main()



