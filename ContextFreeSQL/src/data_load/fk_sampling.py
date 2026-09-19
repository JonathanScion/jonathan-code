"""Keep foreign key references intact when only a sample of each table's rows is scripted.

Only runs when tables_data.max_rows_per_table_retain_fk_integrity is on, which needs max_rows_per_table set.
Without it, a sampled child row can point at a parent row that wasn't sampled, and the script fails when it adds
the foreign key.

The sampled rows are the seeds. For every foreign key, any parent row a selected row references and that isn't
selected yet is fetched and added, and that repeats until a pass adds nothing: rows pulled in for one foreign key
have parents of their own. Parent tables therefore end up with more rows than the limit, which is the point.

The generated script adds foreign keys after all the data is inserted, so only completeness matters here, not the
order rows are inserted in - circular references between tables are not a problem.
"""
from typing import Dict, List, Optional, Set, Tuple

import pandas as pd

from src.defs.script_defs import DBConnSettings
from src.infra.database import Database

# A self reference (a parent_id chain) can walk a whole table one row at a time, so stop somewhere and say so
MAX_ROUNDS = 100


def _fk_pairs(fk_cols: pd.DataFrame) -> List[Tuple[str, str, List[str], List[str]]]:
    """Foreign keys as (child table, parent table, child columns, parent columns), columns in key order."""
    if fk_cols is None or fk_cols.empty:
        return []

    pairs = []
    for (child_schema, child_table, parent_schema, parent_table, fk_name), rows in fk_cols.groupby(
            ['fkey_table_schema', 'fkey_table_name', 'rkey_table_schema', 'rkey_table_name', 'fk_name'], sort=False):
        rows = rows.sort_values('keyno')
        pairs.append((f'{child_schema}.{child_table}', f'{parent_schema}.{parent_table}',
                      rows['fkey_col_name'].tolist(), rows['rkey_col_name'].tolist()))
    return pairs


def _key_values(df: pd.DataFrame, cols: List[str]) -> Set[tuple]:
    """The distinct key tuples in df, skipping any with a NULL (a NULL foreign key references nothing)."""
    missing = [c for c in cols if c not in df.columns]
    if df.empty or missing:
        return set()

    values = set()
    for row in df[cols].itertuples(index=False, name=None):
        if any(pd.isna(v) for v in row):
            continue
        values.add(tuple(row))
    return values


def _fetch_rows(cur, table: str, cols: List[str], keys: Set[tuple]) -> pd.DataFrame:
    """The rows of table whose cols match one of keys."""
    key_list = sorted(keys)
    col_list = ', '.join(f'"{c}"' for c in cols)
    if len(cols) == 1:
        cur.execute(f'SELECT * FROM {table} WHERE {col_list} = ANY(%s)', ([k[0] for k in key_list],))
    else:  # multi-column key: match the tuples
        placeholders = ', '.join(['%s'] * len(key_list))
        cur.execute(f'SELECT * FROM {table} WHERE ({col_list}) IN ({placeholders})', key_list)

    rows = cur.fetchall()
    return pd.DataFrame(rows) if rows else pd.DataFrame()


def expand_for_fk_integrity(conn_settings: DBConnSettings, tables_data: Dict[str, pd.DataFrame],
                            fk_cols: pd.DataFrame, scriptable_tables: Optional[Set[str]] = None) -> List[str]:
    """Add every parent row the sampled rows reference, in place, in tables_data.

    scriptable_tables: tables the script covers. A parent outside it cannot be helped - its table won't exist in a
    blank target - so it is reported instead of loaded.

    Returns the tables that were added to tables_data (they were not sampled but hold referenced rows).
    """
    pairs = _fk_pairs(fk_cols)
    if not pairs:
        print("FK integrity: no foreign keys to follow")
        return []

    conn = None
    cur = None
    added_tables: List[str] = []
    seeded_counts = {t: len(df) for t, df in tables_data.items()}
    try:
        conn = Database.connect_to_database(conn_settings)
        from psycopg2.extras import RealDictCursor
        cur = conn.cursor(cursor_factory=RealDictCursor)

        skipped_out_of_scope: Set[str] = set()
        for round_no in range(1, MAX_ROUNDS + 1):
            added_this_round = 0
            for child, parent, child_cols, parent_cols in pairs:
                child_df = tables_data.get(child)
                if child_df is None or child_df.empty:
                    continue
                if scriptable_tables is not None and parent not in scriptable_tables:
                    if parent not in skipped_out_of_scope:
                        skipped_out_of_scope.add(parent)
                        print(f"FK integrity: {child} references {parent}, which this script does not cover - "
                              f"that foreign key will fail unless {parent} is added to db_ents_to_load")
                    continue

                wanted = _key_values(child_df, child_cols)
                if not wanted:
                    continue

                parent_df = tables_data.get(parent)
                have = _key_values(parent_df, parent_cols) if parent_df is not None else set()
                missing = wanted - have
                if not missing:
                    continue

                fetched = _fetch_rows(cur, parent, parent_cols, missing)
                if fetched.empty:
                    # The row a child points at isn't there: the source itself is inconsistent (no such constraint)
                    continue

                if parent_df is None or parent_df.empty:
                    tables_data[parent] = fetched
                    if parent not in seeded_counts:
                        added_tables.append(parent)
                        seeded_counts[parent] = 0
                else:
                    tables_data[parent] = pd.concat([parent_df, fetched], ignore_index=True)
                added_this_round += len(fetched)

            if added_this_round == 0:
                break
            print(f"FK integrity: round {round_no} added {added_this_round} referenced row(s)")
        else:
            print(f"FK integrity: stopped after {MAX_ROUNDS} rounds - a chain of self references is longer than "
                  f"that. Some foreign keys may still fail; raise max_rows_per_table or script the table in full")

        for table, df in sorted(tables_data.items()):
            seeded = seeded_counts.get(table, 0)
            if len(df) != seeded:
                print(f"FK integrity: {table}: {seeded} sampled, {len(df)} after references")
    except Exception as e:
        print(f"FK integrity: could not complete ({e}). The sampled data is unchanged, so foreign keys may fail")
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

    return added_tables
