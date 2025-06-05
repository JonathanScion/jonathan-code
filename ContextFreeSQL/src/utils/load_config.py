import json
from pathlib import Path
from typing import Optional, Union
from src.defs.script_defs import ConfigVals, DBConnSettings, ScriptingOptions, ScriptTableOptions, ListTables

def load_config(config_path: Optional[Union[str, Path]] = None) -> ConfigVals:
    """Load configuration from JSON file and return ConfigVals object."""
    
    # Use default path if none provided
    if config_path is None:
        config_path = Path(__file__).parent.parent / "config.json" #!no. fix makeshift (hencefore FMS)
    else:
        config_path = Path(config_path)
    
    # Load and parse JSON
    with open(config_path, 'r') as f:
        data = json.load(f)
    
    # Create DBConnSettings
    db_conn = DBConnSettings(**data['database'])
    
    # Create ScriptingOptions
    script_ops = ScriptingOptions(**data['scripting_options'])
    
    # Create ScriptTableOptions
    table_script_ops = ScriptTableOptions(**data['table_script_ops'])

    tables_to_load = ListTables(**data['tables_to_load'])
    tables_data = ListTables(**data['tables_data'])

    # Create and return ConfigVals
    return ConfigVals(
        db_conn = db_conn,
        script_ops = script_ops,
        table_script_ops = table_script_ops,
        tables_to_load = tables_to_load,
        tables_data = tables_data
    )

# Example usage
if __name__ == "__main__":
    try:
        config = load_config()
        print(f"Database host: {config.db_conn.host}")
        print(f"Script schemas: {config.script_ops.script_schemas}")
        print(f"Include indexes: {config.table_script_ops.indexes}")
    except Exception as e:
        print(f"Error loading config: {e}")