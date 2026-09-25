import sys
import argparse
import getpass
from pathlib import Path
from dataclasses import dataclass
from datetime import datetime
import os
import shutil
import subprocess
import signal

from src.utils.load_config import load_config, load_target_db_conn, write_target_config_template, ConfigError
from src.utils.resources import get_template_path, get_default_config_path, get_docs_path, is_bundled
from src.data_load.from_db.load_from_db_pg import load_all_schema, load_all_db_ents, load_all_tables_data
from src.data_load.fk_sampling import expand_for_fk_integrity
from src.generate.generate_script import generate_all_script
from src.defs.script_defs import DBType, ScriptingOptions, ConfigVals
from src.infra.database import Database
from src.report_on_target import run_and_write_report
from src.version import __version__  # set in src/version.py, bumped per build

# How long a password_command gets. Long enough for a token fetch that has to talk to a cloud,
# short enough that a command waiting for input does not hang the run for ever
PASSWORD_COMMAND_TIMEOUT = 120


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
  password_command - Command whose output is the password, for one that is
                fetched rather than stored (an Entra token, a vault)
  port        - Database port (default: 5432)
  sslmode     - require, verify-full, disable, ... for a server needing SSL
  connect_timeout - Seconds to wait for a connection

scripting_options:
  remove_all_extra_ents    - Drop entities not in source (default: true)
  script_schemas           - Include schema DDL (default: true)
  script_security          - Include roles/permissions (default: true)
  data_insert_batch_rows   - Rows per INSERT when scripting data; a bigger batch
                             means a smaller script, 1 is one row per statement
                             (default: 200)

db_ents_to_load:
  tables      - List of entities to script (empty = all)
  schemas     - List of schemas to script (empty = all). With both, only the
                listed entities that are also in one of the schemas

tables_data:
  script_data - false scripts no data at all: schema only (default: true)
  tables      - List of tables to script data for (empty = all)
  schemas     - Only data from tables in these schemas (empty = all)
  from_file   - Write data to CSV files and COPY them in, instead of INSERT
                statements: a much smaller script, but it needs those files
                (server-side COPY) when it runs (default: false)
  max_rows_per_table - 0 scripts every row; above that, at most that many rows
                per table, in primary key order. A sample for filling a blank
                database; foreign keys to unsampled rows will fail (default: 0)
  max_rows_per_table_retain_fk_integrity - with the above set, also script every
                row the sampled rows reference, so the foreign keys hold. Parent
                tables then exceed the limit (default: false)

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


def resolve_data_tables(tables_data, tbl_ents) -> tuple:
    """The tables whose data to script, from tables_data's 'script_data', 'tables' and 'schemas'.

    'tables' and 'schemas' both narrow the result: with a list and schemas, a table has to be in the list AND in
    one of the schemas. Returns (tables, script_all): script_all is True only when no filter was configured at
    all, and then the caller scripts every table's data. A filter that matches nothing scripts no data - it does
    not fall back to everything.
    """
    if not tables_data.script_data:
        print("Data scripting is off (tables_data.script_data) - schema only")
        return [], False

    if not tables_data.schemas:
        # unchanged: a list, or empty meaning all tables
        return tables_data.tables, not tables_data.tables

    wanted_schemas = {s.lower() for s in tables_data.schemas}
    table_rows = tbl_ents[tbl_ents['enttype'] == 'Table']
    in_schemas = [f"{r['entschema']}.{r['entname']}" for _, r in table_rows.iterrows()
                  if str(r['entschema']).lower() in wanted_schemas]

    if tables_data.tables:  # AND: keep only the listed ones that are also in those schemas
        listed = set(tables_data.tables)
        in_schemas = [t for t in in_schemas if t in listed]

    if not in_schemas:
        print("WARNING: tables_data matched no tables - check its 'tables' and 'schemas'. No data will be scripted")
    return in_schemas, False


def retain_fk_integrity(config_vals: ConfigVals, schema, tbl_ents) -> None:
    """With tables_data.max_rows_per_table_retain_fk_integrity on, add the rows the sampled rows reference, so the
    script's foreign keys hold. Does nothing unless both that flag and max_rows_per_table are set."""
    if not (config_vals.tables_data.max_rows_per_table > 0 and config_vals.tables_data.max_rows_per_table_retain_fk_integrity):
        return

    # Only tables the script covers: a parent outside it won't exist in a blank target anyway
    scriptable = set((tbl_ents[tbl_ents['enttype'] == 'Table']['entschema'] + '.' +
                      tbl_ents[tbl_ents['enttype'] == 'Table']['entname']).tolist())

    added_tables = expand_for_fk_integrity(config_vals.db_conn, schema.tables_data, schema.fk_cols, scriptable)

    # Tables that only hold referenced rows still have to be scripted, or those rows are left out
    for table in added_tables:
        if table not in config_vals.tables_data.tables:
            config_vals.tables_data.tables.append(table)
        name = tbl_ents['entschema'] + '.' + tbl_ents['entname']
        tbl_ents.loc[(name == table) & (tbl_ents['enttype'] == 'Table'), 'scriptdata'] = True
    if added_tables:
        print(f"FK integrity: also scripting data for {', '.join(added_tables)} (referenced by sampled rows)")


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
  PGSSLMODE    - require, verify-full, disable, ... (or set "sslmode" in the config)
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
        '--report-on',
        metavar='TARGET_CONFIG',
        default=None,
        help='Run the generated script against this target and write the HTML report locally. '
             'The file needs only a "database" section. Nothing is changed on the target: the run '
             'compares and reports. If the file does not exist it is created as a starting point.'
    )
    parser.add_argument(
        '--password', '-p',
        nargs='?',
        const='PROMPT',  # If --password is given without value, set to PROMPT
        default=None,
        help='Database password. If flag is given without value, prompts interactively.'
    )
    return parser.parse_args()


def kill_process_tree(process) -> None:
    """Kill the shell and everything it started, so nothing is left holding the pipes."""
    try:
        if os.name == 'posix':
            os.killpg(os.getpgid(process.pid), signal.SIGKILL)
        else:
            subprocess.run(['taskkill', '/F', '/T', '/PID', str(process.pid)],
                           capture_output=True, timeout=20)
    except Exception:
        try:
            process.kill()
        except Exception:
            pass


def run_password_command(command: str) -> str:
    """Run the configured command and use what it writes to stdout as the password.

    Only the program name is echoed, never the whole command line: a command is free to carry a secret of its
    own (a vault token, say), and this output goes to terminals and CI logs. The password itself is never
    printed, and stderr is left alone so the command can explain itself when it fails.
    """
    program = command.strip().split()[0] if command.strip() else command
    print(f"Fetching the password with: {program} ...")

    # Started in its own process group so the whole tree can be killed on timeout. subprocess.run's own
    # timeout kills only the shell, and a grandchild still holding the pipes then blocks the read for ever -
    # which is a guard that does not guard
    popen_args = {'shell': True, 'stdout': subprocess.PIPE, 'stderr': subprocess.PIPE, 'text': True}
    if os.name == 'posix':
        popen_args['start_new_session'] = True
    else:
        popen_args['creationflags'] = subprocess.CREATE_NEW_PROCESS_GROUP

    process = subprocess.Popen(command, **popen_args)
    try:
        out, command_said = process.communicate(timeout=PASSWORD_COMMAND_TIMEOUT)
    except subprocess.TimeoutExpired:
        kill_process_tree(process)
        try:
            process.communicate(timeout=10)
        except Exception:
            pass
        print(f"error: the password_command ({program}) did not finish within {PASSWORD_COMMAND_TIMEOUT} seconds.", file=sys.stderr)
        sys.exit(1)

    if process.returncode != 0:
        detail = (command_said or out or '').strip().splitlines()
        print(f"error: the password_command ({program}) failed with exit code {process.returncode}."
              + (f"\n  it said: {detail[-1]}" if detail else ''), file=sys.stderr)
        sys.exit(1)

    # A trailing newline is all but certain, and a password with one would fail authentication for no
    # visible reason. Anything an access token can legitimately contain survives a strip()
    password = out.strip()
    if not password:
        print(f"error: the password_command ({program}) printed nothing, so there is no password to use.",
              file=sys.stderr)
        sys.exit(1)
    return password


def resolve_target_config(path: str, source_db_conn):
    """The target connection for --report-on, or a written template and a stop if the file is not there."""
    target_path = Path(path)
    if not target_path.exists():
        written = write_target_config_template(target_path, source_db_conn)
        print(f"\nThere was no target config at {written}, so one has been written, "
              f"filled in from {source_db_conn.host}/{source_db_conn.db_name}.")
        print("  Change 'host' and 'db_name' to the target, then run the same command again.")
        if not source_db_conn.password_command:
            print("  The password was deliberately not copied. Fill in \"password\", or use"
                  " \"password_command\", PGPASSWORD, or leave it empty to be asked.")
        sys.exit(1)

    try:
        target = load_target_db_conn(target_path)
    except ConfigError as e:
        print(f"error: {e}", file=sys.stderr)
        sys.exit(1)

    if (target.host, target.db_name) == (source_db_conn.host, source_db_conn.db_name):
        print(f"error: the target in {target_path} is the same database the script was generated from"
              f" ({target.host}/{target.db_name}). Comparing a database with itself reports nothing."
              f" Change 'host' or 'db_name'.", file=sys.stderr)
        sys.exit(1)

    if target.password_command:
        target.password = run_password_command(target.password_command)
    elif not target.password:
        if os.environ.get('PGPASSWORD'):
            target.password = os.environ['PGPASSWORD']
        else:
            target.password = getpass.getpass(f'Password for the target ({target.db_name} on {target.host}): ')

    print(f"Target for the report: {target.db_name} on {target.host}")
    check_connection(target)
    return target


def check_connection(db_conn) -> None:
    """Connect once before anything else, and turn a failure into one message worth reading."""
    try:
        Database.connect_to_database(db_conn).close()
    except Exception as e:
        message = str(e).strip()
        print(f"error: cannot connect to {db_conn.db_name} on {db_conn.host} as {db_conn.user}:\n"
              f"  {message}", file=sys.stderr)

        lowered = message.lower()
        if 'no password supplied' in lowered or 'password authentication failed' in lowered:
            print("\n"
                  "  A password has to reach the server. Any one of these does it:\n"
                  "    --password=... on the command line, or -p to be asked for it\n"
                  "    PGPASSWORD in the environment\n"
                  "    \"password\" in the config's database section\n"
                  "    \"password_command\" in the config, for a credential that is fetched\n"
                  "\n"
                  "  Azure PostgreSQL with Microsoft Entra: signing in with 'az login' does not authenticate\n"
                  "  PostgreSQL, which knows nothing about Entra. It wants an access token as the password:\n"
                  "    \"password_command\": \"az account get-access-token --resource-type oss-rdbms"
                  " --query accessToken -o tsv\"\n"
                  "  The principal also has to exist as a role on the server, which the Entra admin grants.",
                  file=sys.stderr)
        elif 'server does not support ssl' in lowered:
            print("\n  The server is not offering SSL. Remove \"sslmode\" from the config, or set it to"
                  " 'prefer'.", file=sys.stderr)
        elif 'no pg_hba.conf entry' in lowered or 'ssl off' in lowered:
            print("\n  The server is refusing the connection as configured. A managed PostgreSQL usually"
                  " requires SSL:\n    add \"sslmode\": \"require\" to the config's database section.",
                  file=sys.stderr)
        sys.exit(1)


def main():
    # Parse command line arguments
    args = parse_args()

    # Handle --show-config flag
    if args.show_config:
        show_config_docs()
        return

    # Load configuration. A config that cannot be used is the user's to fix, so say what is wrong and stop -
    # a traceback out of a bundled binary tells them nothing they can act on
    try:
        config_vals: ConfigVals = load_config(args.config)
    except ConfigError as e:
        print(f"error: {e}", file=sys.stderr)
        sys.exit(1)

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

    # Handle password: command line > env var > password_command > config file > interactive prompt
    if args.password == 'PROMPT':
        # --password flag given without value, prompt for it
        config_vals.db_conn.password = getpass.getpass('Password: ')
    elif args.password is not None:
        # --password=value given, use it
        config_vals.db_conn.password = args.password
    elif os.environ.get('PGPASSWORD'):
        # Environment variable set, use it
        config_vals.db_conn.password = os.environ['PGPASSWORD']
    elif config_vals.db_conn.password_command:
        config_vals.db_conn.password = run_password_command(config_vals.db_conn.password_command)
    elif not config_vals.db_conn.password:
        # Nothing anywhere. Not an error: trust authentication and ~/.pgpass both want no password sent
        config_vals.db_conn.password = getpass.getpass('Password: ')

    # One connection now, so a server that cannot be reached is one clear message. Each loader catches its own
    # errors and carries on, which for a failed connection meant the same line twenty times over and then a
    # complaint about db_ents_to_load, before anything had even been read
    check_connection(config_vals.db_conn)

    # Before reading the source, which takes a while: a target file that is not there yet is written from
    # the source's own connection, so the shape is obvious and only the host and database need changing
    target_db_conn = None
    if args.report_on:
        target_db_conn = resolve_target_config(args.report_on, config_vals.db_conn)

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

     # Determine which entities to load. tables and schemas both narrow: with both, an entity has to be in the
     # list AND in one of the schemas. Empty lists mean no restriction
    if len(config_vals.db_ents_to_load.tables) >= 1 or len(config_vals.db_ents_to_load.schemas) >= 1:
        tbl_ents = load_all_db_ents(config_vals.db_conn,
                                    entity_filter=config_vals.db_ents_to_load.tables or None,
                                    schema_filter=config_vals.db_ents_to_load.schemas or None)
    else:
        # Default: load all entities
        tbl_ents = load_all_db_ents(config_vals.db_conn)

    if tbl_ents.empty:
        # Empty either because nothing matched, or because loading failed (a connection error is reported above).
        # Either way no script is written, so this has to leave a failing exit code behind: a run that could not
        # reach the database used to report success, which anything scripted around it would have believed
        print("ERROR: no entities to script. Check the messages above for a connection or query error, "
              "and check db_ents_to_load's 'tables' and 'schemas'", file=sys.stderr)
        sys.exit(1)

    # Which tables' data to script: the filters above, applied to the entities loaded above
    config_vals.tables_data.tables, script_all_data = resolve_data_tables(config_vals.tables_data, tbl_ents)

    if script_all_data:  # no filter configured: every table's data, as before
        table_rows = tbl_ents[tbl_ents['enttype'] == 'Table']
        config_vals.tables_data.tables = (table_rows['entschema'] + '.' + table_rows['entname']).tolist()

    if len(config_vals.tables_data.tables) >= 1:
        tables_to_script = config_vals.tables_data.tables

        # Mark scriptdata=True for the tables whose data is scripted
        table_filter = tbl_ents['entschema'] + '.' + tbl_ents['entname']
        tbl_ents.loc[table_filter.isin(tables_to_script), 'scriptdata'] = True

        load_all_tables_data(config_vals.db_conn, db_all=schema, table_names=tables_to_script, max_rows_per_table=config_vals.tables_data.max_rows_per_table)
        retain_fk_integrity(config_vals, schema, tbl_ents)

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

    script = generate_all_script(schema, db_type= DBType.PostgreSQL, tbl_ents=tbl_ents, scrpt_ops= config_vals.script_ops, input_output=config_vals.input_output, got_specific_tables = (len(config_vals.db_ents_to_load.tables) >= 1 or len(config_vals.db_ents_to_load.schemas) >= 1), tables_data=config_vals.tables_data, sql_script_params=config_vals.sql_script_params, source_db_label=f"{config_vals.db_conn.host}.{config_vals.db_conn.db_name}", entity_filter=config_vals.db_ents_to_load.tables or None, schema_filter=config_vals.db_ents_to_load.schemas or None)

    # newline='\n': on Windows, text mode would turn \n into \r\n inside the script's string literals,
    # making script-side code differ from the DB's (code comparison, diff pages)
    # encoding='utf-8': Windows defaults to cp1252, which can't write characters found in data (e.g. U+2011)
    with open(config_vals.input_output.output_sql, 'w', newline='\n', encoding='utf-8') as f:
       f.write(script)

    print(f"Script written to: {config_vals.input_output.output_sql}")

    # --report-on: run that script against the target and write the report here. The script itself is
    # untouched - it keeps the flags the config asked for, and the run uses its own copy with execCode off
    if target_db_conn is not None:
        try:
            summary = run_and_write_report(
                script=script,
                target_conn_settings=target_db_conn,
                template_path=config_vals.input_output.html_template_path,
                output_path=config_vals.input_output.html_output_path,
                source_label=f"{config_vals.db_conn.host}.{config_vals.db_conn.db_name}",
                diff_template_path=config_vals.input_output.diff_template_path,
                diff_output_dir=config_vals.input_output.diff_output_dir,
            )
        except Exception as e:
            print(f"error: the comparison against the target failed: {e}", file=sys.stderr)
            sys.exit(1)

        print(f"\n{summary['statements']} statement(s) would be needed to make"
              f" {target_db_conn.db_name} match.")
        for path in summary['written']:
            print(f"Report written to: {path}")


if __name__ == "__main__":
    main()

