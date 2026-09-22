"""
Enum types.

A column of an enum type can't be created before the type exists, so these go out after the schemas and
before the tables. A type that is already there is left alone - dropping and recreating one would mean
dropping every column using it - but if its values differ from the source's, the run says so.
"""
from io import StringIO

import pandas as pd

from src.defs.script_defs import DBType
from src.utils import funcs as utils


def create_user_types(db_type: DBType, udts: pd.DataFrame, columns: pd.DataFrame,
                      got_specific_tables: bool) -> StringIO:
    """
    Script the enum types the tables being scripted need.

    Scripting the whole database takes every type; a filtered run takes only the types its own columns use,
    which may live in a schema it isn't otherwise touching.
    """
    buffer = StringIO()

    if db_type != DBType.PostgreSQL or udts is None or udts.empty:
        return buffer

    needed = udts
    if got_specific_tables:
        # The columns being scripted carry their type as schema.name, which is the key the types are keyed by
        used = set()
        if columns is not None and not columns.empty and 'user_type_name' in columns.columns:
            used = {str(name).lower() for name in columns['user_type_name'].dropna().tolist()}
        needed = udts[udts['type_key'].str.lower().isin(used)]

    if needed.empty:
        return buffer

    buffer.write("--Creating Types----------------------------------------------------------------\n")
    buffer.write("BEGIN --types\n")

    for _, row in needed.iterrows():
        type_key = f"{row['type_schema']}.{row['type_name']}"
        labels_sql = row['labels_sql'] if not utils.is_null_value(row['labels_sql']) else ''
        labels = row['labels'] if not utils.is_null_value(row['labels']) else ''

        buffer.write("\tIF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace\n")
        buffer.write(f"\t\t\tWHERE n.nspname = {utils.quote_str_or_null(row['type_schema'])}"
                     f" AND t.typname = {utils.quote_str_or_null(row['type_name'])}) THEN\n")
        create_sql = f"CREATE TYPE {utils.pg_quote_ident(row['type_schema'])}.{utils.pg_quote_ident(row['type_name'])} AS ENUM ({labels_sql})"
        buffer.write(f"\t\tsqlCode = {utils.quote_str_or_null(create_sql)};\n")
        utils.add_print(db_type, 2, buffer, f"'Adding type {type_key}'")
        utils.add_exec_sql(db_type, 2, buffer)
        buffer.write("\tELSE\n")
        # Changing a type in place is a separate job - dropping it would take every column using it with it -
        # so a type whose values differ is reported and left as it is
        buffer.write("\t\tIF (SELECT string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) FROM pg_enum e\n")
        buffer.write("\t\t\t\tJOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace\n")
        buffer.write(f"\t\t\t\tWHERE n.nspname = {utils.quote_str_or_null(row['type_schema'])}"
                     f" AND t.typname = {utils.quote_str_or_null(row['type_name'])})\n")
        buffer.write(f"\t\t\tIS DISTINCT FROM {utils.quote_str_or_null(labels)} THEN\n")
        buffer.write("\t\t\tINSERT INTO scriptoutput (SQLText)\n")
        buffer.write(f"\t\t\tVALUES ('--Type {type_key} exists with different values. Script has: {labels}');\n")
        buffer.write("\t\tEND IF;\n")
        buffer.write("\tEND IF;\n")

    buffer.write("END; --types\n\n")
    return buffer
