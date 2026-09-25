"""
Extensions.

What an extension brings - types, functions, whole schemas - cannot be scripted object by object. A table
with a pgvector column fails on a target without the extension, with

    type "public.vector" does not exist

and there is no CREATE TYPE the script could write that would fix it, because the type belongs to the
extension. So the extensions go out first, after the schemas and before the types and tables, and the
objects they own are left out of everything else (see the loaders in load_from_db_pg.py).

An extension that is already installed is left alone, whatever version it is: upgrading one is ALTER
EXTENSION ... UPDATE, which can rewrite data and is not something a schema script should decide to do.
Extensions on the target that the source does not have are not dropped either - dropping one takes
everything that depends on it.
"""
from io import StringIO

import pandas as pd

from src.defs.script_defs import DBType
from src.utils import funcs as utils


def create_extensions(db_type: DBType, extensions: pd.DataFrame) -> StringIO:
    """CREATE EXTENSION for each one the source has, guarded so a second run says nothing."""
    buffer = StringIO()

    if db_type != DBType.PostgreSQL or extensions is None or extensions.empty:
        return buffer

    buffer.write("--Creating Extensions-----------------------------------------------------------\n")
    buffer.write("BEGIN --extensions\n")

    for _, row in extensions.iterrows():
        name = row['extension_name']
        create_sql = f"CREATE EXTENSION IF NOT EXISTS {utils.pg_quote_ident(name)}"

        # A relocatable extension is pinned to the schema the source keeps it in, so a column typed
        # public.vector resolves. One that made its own schema is left to make it again
        if not row.get('schema_is_its_own') and not utils.is_null_value(row.get('schema_name')):
            create_sql += f" WITH SCHEMA {utils.pg_quote_ident(row['schema_name'])}"

        # The IF NOT EXISTS would keep the statement harmless on its own, but the guard is what keeps a
        # second run silent - otherwise every run reports creating every extension
        buffer.write(f"\tIF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = {utils.quote_str_or_null(name)}) THEN\n")
        buffer.write(f"\t\tsqlCode = {utils.quote_str_or_null(create_sql)};\n")
        utils.add_print(db_type, 2, buffer, f"'Adding extension {name}'")
        utils.add_exec_sql(db_type, 2, buffer)
        buffer.write("\tEND IF;\n")

    buffer.write("END; --extensions\n\n")
    return buffer
