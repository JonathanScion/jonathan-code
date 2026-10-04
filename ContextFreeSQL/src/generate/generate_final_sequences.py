"""
Put identity and serial sequences back in step with the data that was just loaded.

The script inserts rows with their keys spelled out - INSERT ... OVERRIDING SYSTEM VALUE VALUES ('1', ...) -
and supplying an identity value explicitly does not advance the sequence behind it. So a restored table
holds ids up to 10 while its sequence still sits at 1, and the first insert that lets PostgreSQL choose
the key fails:

    ERROR:  duplicate key value violates unique constraint "staff_pkey"
    Key (id)=(3) already exists.

It keeps failing until the sequence climbs past the highest id. The database looks correct and breaks on
first write, which is the worst shape for a bug to have: nothing the script itself does will ever hit it,
only whatever uses the database afterwards.

The sequence name is resolved on the target with pg_get_serial_sequence rather than guessed here: a
sequence may have been renamed, or attached to a column whose table was renamed, and the name the source
happens to use is not evidence about the target.
"""
from io import StringIO

import pandas as pd

from src.defs.script_defs import DBType
from src.utils import funcs as utils


def _sequence_backed_columns(schema_tables, table_schema: str, table_name: str) -> list:
    """The columns of that table whose values come from a sequence: identity, or a nextval default."""
    columns = schema_tables.columns
    if columns is None or columns.empty:
        return []

    rows = columns[
        (columns['table_schema'].astype(str).str.lower() == table_schema.lower()) &
        (columns['table_name'].astype(str).str.lower() == table_name.lower())
    ]
    found = []
    for _, row in rows.iterrows():
        is_identity = str(row.get('is_identity', 0)) in ('1', '1.0', 'True', 'true')
        default = row.get('col_default_text')
        is_serial = (not utils.is_null_value(default)) and str(default).lower().startswith('nextval(')
        if is_identity or is_serial:
            found.append(str(row['col_name']))
    return found


def generate_sequence_resync(db_type: DBType, schema_tables, tbl_ents: pd.DataFrame,
                             out_buffer: StringIO) -> None:
    """Emit a setval per sequence-backed column of every table whose data the script carries."""
    if db_type != DBType.PostgreSQL or tbl_ents is None or tbl_ents.empty:
        return

    data_tables = tbl_ents[(tbl_ents['enttype'] == 'Table') & (tbl_ents['scriptdata'] == True)]  # noqa: E712
    if data_tables.empty:
        return

    pairs = []
    for _, ent in data_tables.iterrows():
        for column in _sequence_backed_columns(schema_tables, str(ent['entschema']), str(ent['entname'])):
            pairs.append((str(ent['entschema']), str(ent['entname']), column))

    if not pairs:
        return

    out_buffer.write("\n--Putting identity and serial sequences back in step with the data------------\n")
    out_buffer.write("BEGIN --sequences\n")
    for table_schema, table_name, column in pairs:
        qualified = f"{utils.pg_quote_ident(table_schema)}.{utils.pg_quote_ident(table_name)}"
        quoted_column = utils.pg_quote_ident(column)
        name_literal = utils.quote_str_or_null(f"{table_schema}.{table_name}")
        column_literal = utils.quote_str_or_null(column)

        # Two conditions, and the second matters as much as the first.
        #
        # A column may be sequence-backed on the source and not on the target - the script is also what
        # creates it there - so ask the target rather than assume.
        #
        # And only when the sequence is actually behind the data. Setting it unconditionally meant the
        # script reported work to do on a database that already matched it, every run, for ever - which
        # breaks the one promise this tool makes: run it until it says nothing. pg_sequence_last_value is
        # NULL for a sequence that has never been used, so that counts as behind
        last_value = (f"COALESCE(pg_sequence_last_value(pg_get_serial_sequence("
                      f"{name_literal}, {column_literal})::regclass), 0)")
        highest_row = f"COALESCE((SELECT MAX({quoted_column}) FROM {qualified}), 0)"
        out_buffer.write(f"\tIF pg_get_serial_sequence({name_literal}, {column_literal}) IS NOT NULL\n")
        out_buffer.write(f"\t\tAND {last_value} < {highest_row} THEN\n")
        # is_called false when the table is empty, so the next value is 1 rather than 2
        out_buffer.write(f"\t\tsqlCode := 'SELECT setval(' || quote_literal(pg_get_serial_sequence("
                         f"{name_literal}, {column_literal}))\n")
        out_buffer.write(f"\t\t\t|| ', COALESCE((SELECT MAX({quoted_column}) FROM {qualified}), 1)'\n")
        out_buffer.write(f"\t\t\t|| ', (SELECT MAX({quoted_column}) FROM {qualified}) IS NOT NULL)';\n")
        utils.add_print(db_type, 2, out_buffer,
                        f"'Setting the sequence behind {table_schema}.{table_name}.{column}'")
        utils.add_exec_sql(db_type, 2, out_buffer)
        out_buffer.write("\tEND IF;\n")
    out_buffer.write("END; --sequences\n\n")
