"""
Unit tests for the CSV the script writes for the data comparison pages.

It is read next to a CSV of the target's own rows, written by PostgreSQL's COPY, and the page compares the
two as text - so the two sides have to spell values the same way.
"""
import pandas as pd

from src.generate.generate_final_data import _write_data_csv


def test_booleans_are_written_the_way_copy_writes_them(tmp_path):
    """
    pandas writes True/False, COPY writes t/f, and a text comparison of those is never equal.

    Both sides now write true/false: COPY of a boolean cast to text produces exactly that, and COPY accepts
    it on the way back in. Without this, every boolean column differed on every row and a table whose data
    matched was reported as different.
    """
    df = pd.DataFrame({
        'id': [1, 2, 3],
        'flag': [True, False, None],
        'name': ['a', 'b', 'c'],
    })
    out = tmp_path / 'data.csv'

    _write_data_csv(df, ['id', 'flag', 'name'], {'flag'}, str(out))

    lines = out.read_text(encoding='utf-8').strip().splitlines()
    assert lines[0] == 'id,flag,name'
    assert lines[1] == '1,true,a'
    assert lines[2] == '2,false,b'
    assert lines[3] == '3,,c'      # NULL stays empty, as COPY writes it


def test_other_columns_are_untouched(tmp_path):
    """Only the columns named as boolean are rewritten, and the column selection is respected."""
    df = pd.DataFrame({'id': [1], 'flag': [True], 'dropped': ['x']})
    out = tmp_path / 'data.csv'

    _write_data_csv(df, ['id', 'flag'], set(), str(out))

    lines = out.read_text(encoding='utf-8').strip().splitlines()
    assert lines[0] == 'id,flag'
    assert lines[1] == '1,True'    # not named as boolean, so left as pandas writes it
