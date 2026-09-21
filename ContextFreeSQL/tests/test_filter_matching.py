"""
Tests for the filter matching in the data comparison page.

The logic lives in the page template, so the block between the filter-matching markers is lifted out and
run under node. If node isn't on the machine the tests skip; they are not worth a JS toolchain.
"""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

TEMPLATE = Path(__file__).parent.parent / 'src' / 'templates' / 'csv_compare_standalone.html'
START = '// --- filter-matching'
END = '// --- end filter-matching ---'

pytestmark = pytest.mark.skipif(shutil.which('node') is None, reason='node is not installed')


def _filter_matching_js() -> str:
    text = TEMPLATE.read_text(encoding='utf-8')
    start = text.index(START)
    end = text.index(END, start)
    return text[start:end]


def matches(pairs) -> list:
    """Run value/filter pairs through the page's own matcher and return a list of booleans."""
    code = (
        _filter_matching_js()
        + f'\nconst pairs = {json.dumps(pairs)};\n'
        + 'console.log(JSON.stringify(pairs.map(p => valueMatchesFilter(p[0], makeFilterMatcher(p[1])))));\n'
    )
    # Run it from the project rather than a temp folder: node reads the nearest package.json on the way up,
    # and a machine can have an unrelated file by that name sitting in its temp directory
    out = subprocess.run(['node', '-e', code], capture_output=True, text=True,
                         cwd=str(TEMPLATE.parent.parent.parent))
    assert out.returncode == 0, out.stderr
    return json.loads(out.stdout)


# A timestamp as the script writes it, and as PostgreSQL's COPY writes it
SOURCE_TS = '2026-01-05 06:28:00-07:00'
TARGET_TS = '2026-01-05 06:28:00-07'


def test_a_partial_date_matches_the_whole_period():
    """Typing more of the date narrows it: the year, then the month, the day, the hour, the minute."""
    results = matches([
        [SOURCE_TS, '2026'],
        [SOURCE_TS, '2026-01'],
        [SOURCE_TS, '2026-01-05'],
        [SOURCE_TS, '2026-01-05 06'],
        [SOURCE_TS, '2026-01-05 06:28'],
        [SOURCE_TS, '2026-01-05 06:28:00'],
    ])
    assert results == [True] * 6


def test_the_same_date_written_loosely():
    """A month or day typed without its leading zero, or with slashes, means the same period."""
    results = matches([
        [SOURCE_TS, '2026-1'],
        [SOURCE_TS, '2026-1-5'],
        [SOURCE_TS, '2026/1/5'],
        [SOURCE_TS, '2026-1-5 6:28'],
        [TARGET_TS, '2026-1-5'],      # the target's side is written differently, same period
        [SOURCE_TS, '2026-'],         # half typed
    ])
    assert results == [True] * 6


def test_a_date_outside_the_filter_does_not_match():
    """The point of narrowing is that it excludes: a different month, day or hour drops the row."""
    results = matches([
        [SOURCE_TS, '2025'],
        [SOURCE_TS, '2026-02'],
        [SOURCE_TS, '2026-01-06'],
        [SOURCE_TS, '2026-01-05 07'],
        [SOURCE_TS, '2026-01-05 06:29'],
    ])
    assert results == [False] * 5


def test_a_date_only_value():
    """A date column has no time to narrow into, and the day still matches."""
    results = matches([
        ['2026-01-05', '2026'],
        ['2026-01-05', '2026-01-05'],
        ['2026-01-05', '2026-01-05 06'],   # asking for an hour it doesn't have
    ])
    assert results == [True, True, False]


def test_an_ambiguous_day_and_month_matches_both_readings():
    """
    5/1/2026 is the 1st of May or the 5th of January depending on where you are.

    Both are matched rather than guessing: showing a day that wasn't meant is recoverable, hiding the row
    that was meant is not.
    """
    results = matches([
        ['2026-01-05 06:28:00-07', '5/1/2026'],
        ['2026-05-01 06:28:00-07', '5/1/2026'],
        ['2026-01-05 06:28:00-07', '1/5/2026'],
        ['2026-05-01 06:28:00-07', '1/5/2026'],
        ['2026-03-02 06:28:00-07', '5/1/2026'],   # neither reading
        ['2026-05-13 06:28:00-07', '13/5/2026'],  # 13 can only be the day, so this is unambiguous
        ['2026-13-05 06:28:00-07', '13/5/2026'],  # ... and there is no month 13 to match
    ])
    assert results == [True, True, True, True, False, True, False]


def test_text_filters_keep_working():
    """
    Anything the filter found before, it still finds.

    The date reading only adds matches - a filter that quietly stopped matching what it used to would be
    the worst outcome of this.
    """
    results = matches([
        ['FOSTERBK', 'foster'],           # still a plain substring, either case
        ['release v2026.1', '2026'],      # a year inside other text, not at the start
        [SOURCE_TS, '06:28'],             # a time on its own is not a date, so substring as before
        [SOURCE_TS, '-07'],               # the offset, mid value
        ['', '2026'],
        [None, '2026'],
    ])
    assert results == [True, True, True, True, False, False]


def test_nonsense_dates_fall_back_to_text():
    """Out of range pieces aren't a period, so they are matched as the text they are."""
    results = matches([
        ['2026-13-05', '2026-13'],        # no month 13: matched as text, and this value has it
        ['2026-01-05', '2026-13'],        # ... and this one doesn't
        ['2026-01-32', '2026-01-32'],
        ['2026-01-05 25:00:00', '2026-01-05 25'],
    ])
    assert results == [True, False, True, True]
