"""
The config file is the first thing a new user touches, so what it does with a bad one matters.

A setting it did not recognise used to come out of the bundled binary as

    TypeError: DBConnSettings.__init__() got an unexpected keyword argument 'sslmode'
    [PYI-31225:ERROR] Failed to execute script 'main' due to unhandled exception!

on top of a PyInstaller traceback: nothing about which file, which section, or what may go there. These
check the messages instead of the exception type, because the message is the part a user reads.
"""
import json
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.defs.script_defs import DBConnSettings
from src.utils.load_config import ConfigError, load_config

PROJECT = Path(__file__).parent.parent

MINIMAL = {
    'database': {'host': 'h', 'db_name': 'd', 'user': 'u', 'password': 'p', 'port': '5432'},
    'scripting_options': {},
    'table_script_ops': {},
    'db_ents_to_load': {'tables': [], 'schemas': []},
    'tables_data': {'tables': [], 'schemas': []},
    'input_output': {},
}


def write_config(tmp_path, **database):
    """A config file whose database section is MINIMAL's, changed by the keyword arguments."""
    config = json.loads(json.dumps(MINIMAL))
    for key, value in database.items():
        if value is None:
            config['database'].pop(key, None)
        else:
            config['database'][key] = value
    path = tmp_path / 'config.json'
    path.write_text(json.dumps(config), encoding='utf-8')
    return path


def test_sslmode_is_accepted_and_passed_on(tmp_path):
    """A managed PostgreSQL that refuses plaintext needs this, and the client config that failed had it."""
    config = load_config(write_config(tmp_path, sslmode='require'))
    assert config.db_conn.sslmode == 'require'
    assert config.db_conn.libpq_options() == {'sslmode': 'require'}


def test_the_other_ssl_settings_travel_together(tmp_path):
    """verify-full needs a root certificate, and a client certificate comes as a pair."""
    config = load_config(write_config(tmp_path, sslmode='verify-full', sslrootcert='/etc/ssl/ca.pem',
                                      sslcert='/etc/ssl/client.pem', sslkey='/etc/ssl/client.key',
                                      connect_timeout=10))
    assert config.db_conn.libpq_options() == {
        'sslmode': 'verify-full', 'sslrootcert': '/etc/ssl/ca.pem',
        'sslcert': '/etc/ssl/client.pem', 'sslkey': '/etc/ssl/client.key', 'connect_timeout': 10,
    }


def test_settings_that_were_not_given_are_not_passed_on(tmp_path):
    """
    Left out means left to libpq, not overridden with a default.

    Passing sslmode=None would override PGSSLMODE, so someone who sets that environment variable - which is
    how a shared machine usually carries it - would silently connect the wrong way.
    """
    config = load_config(write_config(tmp_path))
    assert config.db_conn.libpq_options() == {}


def test_a_password_can_be_left_out_of_the_config(tmp_path):
    """It can come from --password, PGPASSWORD or the prompt, so requiring it in the file is wrong.

    The client's config had no password in it, which would have been the next failure after sslmode.
    """
    config = load_config(write_config(tmp_path, password=None))
    assert config.db_conn.password == ''


def test_an_unrecognised_setting_says_so_and_lists_what_fits(tmp_path):
    with pytest.raises(ConfigError) as caught:
        load_config(write_config(tmp_path, sslmodee='require'))
    message = str(caught.value)
    assert 'sslmodee' in message
    assert "'database'" in message
    assert 'sslmode' in message, 'the message should list what can go there, which spells the typo out'


def test_a_missing_required_setting_names_it(tmp_path):
    with pytest.raises(ConfigError) as caught:
        load_config(write_config(tmp_path, host=None))
    assert 'host' in str(caught.value)


def test_a_file_that_is_not_json_says_which_file(tmp_path):
    path = tmp_path / 'broken.json'
    path.write_text('{oops', encoding='utf-8')
    with pytest.raises(ConfigError) as caught:
        load_config(path)
    assert 'broken.json' in str(caught.value)


def test_a_missing_file_is_not_a_traceback(tmp_path):
    with pytest.raises(ConfigError):
        load_config(tmp_path / 'nothing-here.json')


def test_a_missing_section_is_named(tmp_path):
    config = json.loads(json.dumps(MINIMAL))
    del config['input_output']
    path = tmp_path / 'config.json'
    path.write_text(json.dumps(config), encoding='utf-8')
    with pytest.raises(ConfigError) as caught:
        load_config(path)
    assert 'input_output' in str(caught.value)


def test_the_defaults_still_build_a_connection(tmp_path):
    """Adding optional settings must not have changed what a plain config produces."""
    config = load_config(write_config(tmp_path))
    assert (config.db_conn.host, config.db_conn.db_name, config.db_conn.user,
            config.db_conn.password, config.db_conn.port) == ('h', 'd', 'u', 'p', '5432')


def test_a_bad_config_exits_with_a_message_and_not_a_traceback(tmp_path):
    """End to end, the way the client met it: run the program and look at what it printed."""
    path = write_config(tmp_path, sslmodee='require')
    result = subprocess.run([sys.executable, '-m', 'src.main', str(path)],
                            capture_output=True, text=True, cwd=str(PROJECT))
    output = result.stdout + result.stderr
    assert result.returncode != 0, 'a config it cannot use should be a failing exit code'
    assert 'Traceback' not in output, f'a traceback reached the user:\n{output}'
    assert 'sslmodee' in output
