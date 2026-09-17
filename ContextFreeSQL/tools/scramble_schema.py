"""Scramble all data in one schema, in one transaction. IRREVERSIBLE - back up first (pg_dump -n <schema>).

Text: deterministic (same value -> same output across all tables), so cross-table matches survive.
  len <= 40: position-dependent keyed substitution (bijective per length -> PK/unique safe)
  len  > 40: HMAC-seeded random chars
  Length, case, whitespace and punctuation preserved.
Numbers +-20%, dates/timestamps +-90 days (non-key columns only). jsonb: string leaves only.
Untouched: uuid, boolean, generated/identity columns, tsvector. Key is random and never saved.
Verifies row counts and work_order_nbr/work_order_task cross-table matches; rolls back on mismatch.

Usage: python scramble_schema.py --config ../src/const1.json --db const2 --schema wpc
"""
import argparse, datetime, decimal, hashlib, hmac, json, random, secrets, string, sys
import psycopg2
from psycopg2.extras import execute_values, Json

ap = argparse.ArgumentParser(description='Scramble all data in a PostgreSQL schema (irreversible).')
ap.add_argument('--config', required=True, help='ContextFreeSQL config JSON with a "database" section (host, user, password, port)')
ap.add_argument('--db', help='database name (default: db_name from the config)')
ap.add_argument('--schema', required=True)
ap.add_argument('--yes', action='store_true', help='skip the confirmation prompt')
args = ap.parse_args()

SCHEMA = args.schema
cfg = json.load(open(args.config))['database']
db_name = args.db or cfg['db_name']
if not args.yes and input(f"Scramble ALL data in {cfg['host']}/{db_name} schema '{SCHEMA}'? This cannot be undone. Type yes: ") != 'yes':
    sys.exit('Aborted.')
conn = psycopg2.connect(host=cfg['host'], dbname=db_name, user=cfg['user'], password=cfg['password'], port=cfg['port'])
cur = conn.cursor()

KEY = secrets.token_bytes(32)
_krng = random.Random(KEY)
MAXPOS = 40
LETTER_PERMS = [_krng.sample(string.ascii_lowercase, 26) for _ in range(MAXPOS)]
DIGIT_PERMS = [_krng.sample(string.digits, 10) for _ in range(MAXPOS)]
_cache = {}


def scramble_str(s):
    if s is None or s == '':
        return s
    if s in _cache:
        return _cache[s]
    out = []
    if len(s) <= MAXPOS:
        for i, ch in enumerate(s):
            if 'a' <= ch <= 'z':
                out.append(LETTER_PERMS[i][ord(ch) - 97])
            elif 'A' <= ch <= 'Z':
                out.append(LETTER_PERMS[i][ord(ch) - 65].upper())
            elif '0' <= ch <= '9':
                out.append(DIGIT_PERMS[i][ord(ch) - 48])
            else:
                out.append(ch)
    else:
        rng = random.Random(hmac.new(KEY, s.encode('utf-8'), hashlib.sha256).digest())
        for ch in s:
            if ch.isascii() and ch.islower():
                out.append(rng.choice(string.ascii_lowercase))
            elif ch.isascii() and ch.isupper():
                out.append(rng.choice(string.ascii_uppercase))
            elif ch.isdigit():
                out.append(rng.choice(string.digits))
            elif ch.isalpha():  # non-ascii letters
                out.append(rng.choice(string.ascii_lowercase))
            else:
                out.append(ch)
    r = ''.join(out)
    _cache[s] = r
    return r


def scramble_json(v):
    if isinstance(v, str):
        return scramble_str(v)
    if isinstance(v, list):
        return [scramble_json(x) for x in v]
    if isinstance(v, dict):
        return {k: scramble_json(x) for k, x in v.items()}
    if isinstance(v, bool) or v is None:
        return v
    if isinstance(v, int):
        return int(round(v * random.uniform(0.8, 1.2)))
    if isinstance(v, float):
        return v * random.uniform(0.8, 1.2)
    return v


INT_LIMITS = {'smallint': 32767, 'integer': 2**31 - 1, 'bigint': 2**63 - 1}


def scramble_val(v, typ, scale):
    if v is None:
        return None
    if typ in ('character varying', 'text', 'character'):
        return scramble_str(v)
    if typ in INT_LIMITS:
        return max(-INT_LIMITS[typ], min(INT_LIMITS[typ], int(round(v * random.uniform(0.8, 1.2)))))
    if typ == 'numeric':
        r = v * decimal.Decimal(str(round(random.uniform(0.8, 1.2), 6)))
        return r.quantize(decimal.Decimal(1).scaleb(-scale)) if scale is not None else r
    if typ in ('double precision', 'real'):
        return v * random.uniform(0.8, 1.2)
    if typ == 'date':
        return v + datetime.timedelta(days=random.randint(-90, 90))
    if typ.startswith('timestamp'):
        return v + datetime.timedelta(seconds=random.randint(-90 * 86400, 90 * 86400))
    if typ == 'jsonb':
        return Json(scramble_json(v))
    raise ValueError(typ)


SCRAMBLE_TYPES = {'character varying', 'text', 'character', 'smallint', 'integer', 'bigint', 'numeric',
                  'double precision', 'real', 'date', 'timestamp without time zone',
                  'timestamp with time zone', 'jsonb'}
TEXT_TYPES = {'character varying', 'text', 'character'}

cur.execute("""select c.relname from pg_class c where c.relnamespace=to_regnamespace(%s) and c.relkind in ('r','p') order by 1""", (SCHEMA,))
tables = [t for (t,) in cur.fetchall()]
if not tables:
    sys.exit(f"No tables found in schema {SCHEMA!r} of {db_name}.")


def q(ident):
    return '"' + ident.replace('"', '""') + '"'


def fingerprint():
    """Row counts + cross-table match counts for text columns shared between tables."""
    fp = {}
    for t in tables:
        cur.execute(f'select count(*) from {q(SCHEMA)}.{q(t)}')
        fp[('rows', t)] = cur.fetchone()[0]
    for col in ('work_order_nbr', 'work_order_task'):
        cur.execute("""select table_name from information_schema.columns where table_schema=%s and column_name=%s
                       and data_type in ('character varying','text') order by 1""", (SCHEMA, col))
        ts = [t for (t,) in cur.fetchall()]
        for other in ts[1:]:
            cur.execute(f'select count(*) from {q(SCHEMA)}.{q(ts[0])} a join {q(SCHEMA)}.{q(other)} b on a.{q(col)}=b.{q(col)}')
            fp[('join', col, ts[0], other)] = cur.fetchone()[0]
        for t in ts:
            cur.execute(f'select count(distinct {q(col)}) from {q(SCHEMA)}.{q(t)}')
            fp[('distinct', col, t)] = cur.fetchone()[0]
    return fp


before = fingerprint()
changed_cells = 0
skipped = []
report = []

for t in tables:
    cur.execute("""
        select a.attname, format_type(a.atttypid, null), information_schema._pg_numeric_scale(a.atttypid, a.atttypmod),
               a.attgenerated <> '' or a.attidentity <> '' as gen,
               exists(select 1 from pg_constraint k where k.conrelid=a.attrelid and a.attnum=any(k.conkey) and k.contype in ('p','u')) as is_key
        from pg_attribute a where a.attrelid=%s::regclass and a.attnum>0 and not a.attisdropped order by a.attnum""",
                (f'{q(SCHEMA)}.{q(t)}',))
    cols = []
    for name, typ, scale, gen, is_key in cur.fetchall():
        if gen or typ not in SCRAMBLE_TYPES:
            continue
        if is_key and typ not in TEXT_TYPES:  # numeric/date keys: shifting could collide
            skipped.append(f'{t}.{name} ({typ} key)')
            continue
        cols.append((name, typ, scale))
    if not cols:
        continue
    cur.execute(f'select ctid, {", ".join(q(c[0]) for c in cols)} from {q(SCHEMA)}.{q(t)}')
    rows = cur.fetchall()
    if not rows:
        continue
    new_rows = []
    for r in rows:
        new_rows.append((r[0],) + tuple(scramble_val(v, typ, scale) for v, (_, typ, scale) in zip(r[1:], cols)))
        changed_cells += sum(v is not None for v in r[1:])
    col_defs = ', '.join(f'{q(n)} {("jsonb" if typ == "jsonb" else typ if typ != "numeric" else "numeric")}' for n, typ, _ in cols)
    cur.execute(f'create temp table _scr (ctid_ tid, {col_defs}) on commit drop')
    execute_values(cur, f'insert into _scr values %s', new_rows, page_size=500)
    sets = ', '.join(f'{q(n)} = s.{q(n)}' for n, _, _ in cols)
    cur.execute(f'update {q(SCHEMA)}.{q(t)} x set {sets} from _scr s where x.ctid = s.ctid_')
    if cur.rowcount != len(rows):
        raise RuntimeError(f'{t}: updated {cur.rowcount} of {len(rows)} rows')
    cur.execute('drop table _scr')
    report.append((t, len(rows), len(cols)))

after = fingerprint()
mismatch = {k: (before[k], after.get(k)) for k in before if before[k] != after.get(k)}
if mismatch:
    conn.rollback()
    print('VERIFY FAILED, rolled back:', mismatch)
    sys.exit(1)

conn.commit()
print(f'Committed. {len(report)} tables, {sum(r[1] for r in report)} rows, {changed_cells} non-null cells scrambled')
print('Checks passed:', sum(1 for k in before if k[0] == 'rows'), 'row counts,',
      sum(1 for k in before if k[0] == 'join'), 'cross-table join counts,',
      sum(1 for k in before if k[0] == 'distinct'), 'distinct counts')
print('Skipped non-text key columns:', skipped)
