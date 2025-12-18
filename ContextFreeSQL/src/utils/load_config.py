import json
from pathlib import Path
from typing import Optional, Union
from src.defs.script_defs import ConfigVals, DBConnSettings, ScriptingOptions, ScriptTableOptions, ListTables, InputOutput, SQLScriptParams


def load_config(config_path: Optional[Union[str, Path]] = None) -> ConfigVals:
    """Load configuration from JSON file and return ConfigVals object."""

    # Use default path if none provided
    if config_path is None:
        config_path = Path(__file__).parent.parent / "config.json"
    else:
        config_path = Path(config_path)

    # Load and parse JSON
    with open(config_path, 'r') as f:
        data = json.load(f)

    # Create objects from config data
    db_conn = DBConnSettings(**data['database'])
    script_ops = ScriptingOptions(**data['scripting_options'])
    table_script_ops = ScriptTableOptions(**data['table_script_ops'])
    db_ents_to_load = ListTables(**data['db_ents_to_load'])
    tables_data = ListTables(**data['tables_data'])
    input_output = InputOutput(**data['input_output'])

    # Load SQL script params (with defaults if not present in config)
    sql_script_params_data = data.get('sql_script_params', {})
    sql_script_params = SQLScriptParams(**sql_script_params_data)

    # Create and return ConfigVals
    return ConfigVals(
        db_conn=db_conn,
        script_ops=script_ops,
        table_script_ops=table_script_ops,
        db_ents_to_load=db_ents_to_load,
        tables_data=tables_data,
        input_output=input_output,
        sql_script_params=sql_script_params
    )
