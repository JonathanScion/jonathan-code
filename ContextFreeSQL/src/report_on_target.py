"""
Run a generated script against a target and write the report here, rather than on the server.

The HTML report was written by the database server: pg_read_file to read the template, COPY TO to write
the page. That only works when the server shares your filesystem, so against any managed PostgreSQL -
Azure, RDS - it cannot work at all, and the failure was a NOTICE most clients never show.

The split this module makes is the honest one. Only the server can see the target database, so it does
the comparing; only this machine can see this filesystem, so it does the writing. The script hands back
a few KB of JSON describing what it found, and the template is filled in here.

Nothing is changed on the target: the script runs with execCode off.
"""
import json
import re
from datetime import datetime
from pathlib import Path

import psycopg2

from src.infra.database import Database
from src.version import __version__


def set_script_flags(script: str, **flags) -> str:
    """Set the boolean flags in a generated script's header.

    The header is written by build_script_header in a fixed shape, so this matches that shape rather than
    guessing: '<name> boolean := true;'. A flag that is not found is an error rather than a silent no-op,
    which is what would happen if the header were ever reworded.
    """
    for name, value in flags.items():
        pattern = re.compile(rf'(\b{re.escape(name)}\s+boolean\s*:=\s*)(true|false)', re.IGNORECASE)
        script, count = pattern.subn(lambda m: m.group(1) + ('true' if value else 'false'), script, count=1)
        if count != 1:
            raise ValueError(f"could not set the script flag '{name}' - the generated header has changed shape")
    return script


def _render(template: str, report_json: str, source_label: str, target_label: str) -> str:
    """Fill the report template, the same substitutions the server used to make."""
    # The JSON lands inside a <script> block: escape '</' so a value holding '</script>' cannot close it
    page = template.replace('[[reportInfo]]', (report_json or '[]').replace('</', '<\\/'))
    page = page.replace('[[leftPanelTitle]]', f'Script ({source_label})')
    page = page.replace('[[rightPanelTitle]]', f'Database ({target_label})')
    page = page.replace('[[generatedAt]]', datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
    page = page.replace('[[version]]', __version__)
    return page


def _js_string(text: str) -> str:
    """A PL/pgSQL-free version of the escaping the script used to do, for code going into a JS literal."""
    escaped = (text or '').replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n').replace('\r', '\\r')
    # The literal sits inside a <script> block, so '</' must not be able to close it
    return "'" + escaped.replace('</', '<\\/') + "'"


def _render_diff(template: str, payload: dict, source_label: str, target_label: str) -> str:
    """Fill the per-entity diff template - the same substitutions, done here instead of on the server."""
    page = template.replace('[[ENTITY_NAME]]', payload.get('entity_name', ''))
    page = page.replace('[[ENTITY_SCHEMA]]', payload.get('entity_schema', ''))
    page = page.replace('[[ENTITY_TYPE]]', payload.get('entity_type', '') or '')
    page = page.replace('[[SCRIPT_CODE]]', _js_string(payload.get('script_code', '')))
    page = page.replace('[[DB_CODE]]', _js_string(payload.get('db_code', '')))
    for placeholder, key in (('[[SOURCE_SQL]]', 'source_sql'), ('[[TARGET_SQL]]', 'target_sql')):
        statements = payload.get(key) or []
        page = page.replace(placeholder, json.dumps(statements).replace('</', '<\\/'))
    page = page.replace('[[leftPanelTitle]]', f'Script ({source_label})')
    page = page.replace('[[rightPanelTitle]]', f'Database ({target_label})')
    page = page.replace('[[generatedAt]]', datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
    page = page.replace('[[version]]', __version__)
    return page


def warn_about_what_the_role_cannot_see(conn, user: str) -> int:
    """Say so when the connecting role cannot see everything on the target.

    information_schema shows only what the role holds some privilege on, so a role without rights on a
    table sees no table - and the comparison then reports it as missing from the target when it is
    sitting right there. Running that conclusion with execCode on would try to create what already
    exists. pg_class is readable by everyone, so the two counts together give the answer.

    Returns how many objects are hidden. A warning only: a partial comparison is still worth having,
    as long as nobody mistakes it for a complete one.
    """
    with conn.cursor() as cur:
        cur.execute("""
            SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE c.relkind IN ('r', 'p', 'v', 'm')
                      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
                      AND n.nspname NOT LIKE 'pg\\_temp%' AND n.nspname NOT LIKE 'pg\\_toast%'),
                   (SELECT count(*) FROM information_schema.tables
                    WHERE table_schema NOT IN ('pg_catalog', 'information_schema'))""")
        in_catalog, visible = cur.fetchone()

    hidden = max(0, in_catalog - visible)
    if hidden:
        print(f"  WARNING: {user} can see {visible} of the {in_catalog} tables and views on the target.")
        print(f"  The other {hidden} will be reported as missing from it, because a role sees nothing of a")
        print("  table it holds no privilege on. Grant it rights on them (pg_read_all_data is enough) or")
        print("  connect as a role that has them - otherwise the report claims things are absent that are not.")
    return hidden


def run_and_write_report(script: str, target_conn_settings, template_path: str, output_path: str,
                         source_label: str, diff_template_path: str = '', diff_output_dir: str = '') -> dict:
    """Run the script against the target, then write the report from what it hands back.

    Returns a summary: how many statements the target would need, and which files were written.
    """
    script = set_script_flags(script, execCode=False, htmlReport=True, reportToCaller=True)

    target_label = f"{target_conn_settings.host}/{target_conn_settings.db_name}"
    print(f"Running the comparison against {target_label} (nothing is changed there) ...")

    written = []
    conn = Database.connect_to_database(target_conn_settings)
    try:
        conn.autocommit = True
        warn_about_what_the_role_cannot_see(conn, target_conn_settings.user)
        with conn.cursor() as cur:
            cur.execute(script)
            statements = [row[0] for row in cur.fetchall() if row and row[0]]

            # The temp tables outlive the DO block for as long as this connection does
            cur.execute("SELECT kind, name, content FROM scriptreport ORDER BY id")
            payloads = cur.fetchall()

        notices = [n.strip() for n in conn.notices]
    finally:
        conn.close()

    template = Path(template_path).read_text(encoding='utf-8')
    diff_template = (Path(diff_template_path).read_text(encoding='utf-8')
                     if diff_template_path and Path(diff_template_path).exists() else None)
    diffs_written = 0

    for kind, name, content in payloads:
        if kind == 'report':
            page = _render(template, content, source_label, target_label)
            destination = Path(output_path)
        elif kind == 'diff' and diff_template is not None:
            page = _render_diff(diff_template, json.loads(content), source_label, target_label)
            # Beside the report, which is where its links point
            destination = Path(diff_output_dir or Path(output_path).parent) / name
            diffs_written += 1
        else:
            continue
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(page, encoding='utf-8')
        if kind == 'report':
            written.append(str(destination))

    if diffs_written:
        written.append(f"{diffs_written} diff page(s) in {diff_output_dir or Path(output_path).parent}")

    if not payloads:
        print("  The script returned no report data. Its htmlReport flag may have been off when it was"
              " generated (sql_script_params.html_report).")
        for notice in notices:
            if 'WARNING' in notice.upper() or 'ERROR' in notice.upper():
                print(f"  the target said: {notice}")

    return {'statements': len(statements), 'written': written}
