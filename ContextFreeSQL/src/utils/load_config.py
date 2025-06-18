import json
import os
from pathlib import Path
from typing import Optional, Union, Dict, Any
from src.defs.script_defs import ConfigVals, DBConnSettings, ScriptingOptions, ScriptTableOptions, ListTables

def override_with_env_vars(data: Dict[str, Any], prefix: str = "") -> Dict[str, Any]:
    """
    Recursively override dictionary values with environment variables.
    
    Environment variable naming convention:
    - Nested keys separated by double underscores: __
    - Example: database.host -> DATABASE__HOST
    - Example: scripting_options.script_schemas -> SCRIPTING_OPTIONS__SCRIPT_SCHEMAS
    """
    result = data.copy()
    
    for key, value in data.items():
        # Build the environment variable name
        env_key = f"{prefix}__{key}".upper() if prefix else key.upper()
        
        if isinstance(value, dict):
            # Recursively handle nested dictionaries
            result[key] = override_with_env_vars(value, env_key)
        elif isinstance(value, list):
            # Handle lists - environment variable should be comma-separated
            env_value = os.getenv(env_key)
            if env_value is not None:
                result[key] = [item.strip() for item in env_value.split(',')]
        else:
            # Handle primitive values (str, int, bool)
            env_value = os.getenv(env_key)
            if env_value is not None:
                # Convert to appropriate type based on original value
                if isinstance(value, bool):
                    result[key] = env_value.lower() in ('true', '1', 'yes', 'on')
                elif isinstance(value, int):
                    try:
                        result[key] = int(env_value)
                    except ValueError:
                        result[key] = env_value  # Keep as string if conversion fails
                elif isinstance(value, float):
                    try:
                        result[key] = float(env_value)
                    except ValueError:
                        result[key] = env_value  # Keep as string if conversion fails
                else:
                    result[key] = env_value
    
    return result

def load_config(config_path: Optional[Union[str, Path]] = None) -> ConfigVals:
    """Load configuration from JSON file and return ConfigVals object with environment variable overrides."""
    
    # Use default path if none provided
    if config_path is None:
        config_path = Path(__file__).parent.parent / "config.json"
    else:
        config_path = Path(config_path)
    
    # Load and parse JSON
    with open(config_path, 'r') as f:
        data = json.load(f)
    
    # Override with environment variables
    data = override_with_env_vars(data)
    
    # Create objects with potentially overridden values
    db_conn = DBConnSettings(**data['database'])
    script_ops = ScriptingOptions(**data['scripting_options'])
    table_script_ops = ScriptTableOptions(**data['table_script_ops'])
    db_ents_to_load = ListTables(**data['db_ents_to_load'])
    tables_data = ListTables(**data['tables_data'])

    # Create and return ConfigVals
    return ConfigVals(
        db_conn=db_conn,
        script_ops=script_ops,
        table_script_ops=table_script_ops,
        db_ents_to_load=db_ents_to_load,
        tables_data=tables_data
    )

def print_env_var_examples():
    """Print examples of environment variable names for this config."""
    examples = [
        "# Database settings:",
        "DATABASE__HOST=localhost",
        "DATABASE__DB_NAME=MyDatabase", 
        "DATABASE__USER=myuser",
        "DATABASE__PASSWORD=mysecretpassword",
        "DATABASE__PORT=5432",
        "",
        "# Scripting options:",
        "SCRIPTING_OPTIONS__REMOVE_ALL_EXTRA_ENTS=true",
        "SCRIPTING_OPTIONS__COLUMN_COLLATION=false",
        "SCRIPTING_OPTIONS__SCRIPT_SCHEMAS=true",
        "",
        "# Table script options:",
        "TABLE_SCRIPT_OPS__INDEXES=true",
        "TABLE_SCRIPT_OPS__FOREIGN_KEYS=false",
        "",
        "# Tables (comma-separated lists):",
        "DB_ENTS_TO_LOAD__TABLES=public.students,public.courses",
        "TABLES_DATA__TABLES=public.students"
    ]
    
    print("Environment variable examples:")
    print("=" * 40)
    for example in examples:
        print(example)

# Example usage
if __name__ == "__main__":
    try:
        print_env_var_examples()
        print("\n" + "=" * 40 + "\n")
        
        config = load_config()
        print(f"Database host: {config.db_conn.host}")
        print(f"Database password: {'*' * len(config.db_conn.password) if config.db_conn.password else 'Not set'}")
        print(f"Script schemas: {config.script_ops.script_schemas}")
        print(f"Include indexes: {config.table_script_ops.indexes}")
        print(f"Tables to load: {config.db_ents_to_load.tables}")
    except Exception as e:
        print(f"Error loading config: {e}")