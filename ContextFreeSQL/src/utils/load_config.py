import json
from dataclasses import MISSING, fields
from pathlib import Path
from typing import Optional, Union
from src.defs.script_defs import ConfigVals, DBConnSettings, ScriptingOptions, ScriptTableOptions, ListTables, InputOutput, SQLScriptParams


class ConfigError(Exception):
    """Something in the config file cannot be used. The message is meant to be read on its own, without a traceback."""


def _section(cls, data: dict, section: str):
    """Build one config section, and say plainly what is wrong with it rather than raising a TypeError.

    An unknown key used to come out as `DBConnSettings.__init__() got an unexpected keyword argument
    'sslmode'` on top of a PyInstaller traceback, which says nothing about which file or what to do.
    """
    if not isinstance(data, dict):
        raise ConfigError(f"'{section}' in the config should be a group of settings, not {type(data).__name__}.")

    known = {f.name: f for f in fields(cls)}
    unknown = [key for key in data if key not in known]
    if unknown:
        raise ConfigError(
            f"'{section}' in the config has {'a setting' if len(unknown) == 1 else 'settings'} "
            f"that {'is' if len(unknown) == 1 else 'are'} not recognised: {', '.join(sorted(unknown))}.\n"
            f"  settings that can go in '{section}': {', '.join(sorted(known))}"
        )

    missing = [name for name, f in known.items()
               if name not in data and f.default is MISSING and f.default_factory is MISSING]
    if missing:
        raise ConfigError(
            f"'{section}' in the config is missing: {', '.join(sorted(missing))}."
        )

    return cls(**data)


def load_config(config_path: Optional[Union[str, Path]] = None) -> ConfigVals:
    """Load configuration from JSON file and return ConfigVals object."""

    # Use default path if none provided
    if config_path is None:
        config_path = Path(__file__).parent.parent / "config.json"
    else:
        config_path = Path(config_path)

    # Load and parse JSON
    if not config_path.exists():
        raise ConfigError(f"no config file at {config_path}")
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        raise ConfigError(f"{config_path} is not valid JSON: {e}") from None

    missing_sections = [name for name in ('database', 'scripting_options', 'table_script_ops',
                                          'db_ents_to_load', 'tables_data', 'input_output')
                        if name not in data]
    if missing_sections:
        raise ConfigError(f"{config_path} has no '{missing_sections[0]}' section."
                          f" Run with --show-config to see what a config file holds.")

    # Create objects from config data
    db_conn = _section(DBConnSettings, data['database'], 'database')
    script_ops = _section(ScriptingOptions, data['scripting_options'], 'scripting_options')
    table_script_ops = _section(ScriptTableOptions, data['table_script_ops'], 'table_script_ops')
    db_ents_to_load = _section(ListTables, data['db_ents_to_load'], 'db_ents_to_load')
    tables_data = _section(ListTables, data['tables_data'], 'tables_data')
    input_output = _section(InputOutput, data['input_output'], 'input_output')

    # Load SQL script params (with defaults if not present in config)
    sql_script_params = _section(SQLScriptParams, data.get('sql_script_params', {}), 'sql_script_params')

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
