# ContextFreeSQL

Reads a PostgreSQL database and writes a single, self-contained SQL script that makes any other database look
like it: schema, data and security. The script compares itself against whatever database it is run on, reports
the differences, and applies them (or just prints what it would do). Nothing else needs to be installed on the
target - the script is plain SQL.

The database the script was generated from is the **source**; the database the script runs on is the **target**.

- [Configuration reference](docs/CONFIG.md) - every config file option
- [Building the executable](docs/BUILDING.md) - PyInstaller build

## Install

The released binaries bundle Python, so nothing else has to be installed.

**Linux / macOS:**

```bash
curl -LsSf https://github.com/JonathanScion/jonathan-code/releases/latest/download/install.sh | sh
```

It downloads the binary for your system, checks it against `SHA256SUMS`, and installs it to `~/.local/bin`
(`/usr/local/bin` when run as root). Everything comes from `github.com`, so no other domain needs to be allowed
through a proxy. Useful variables:

| Variable | Use |
|---|---|
| `CFS_VERSION` | Install a specific release, e.g. `CFS_VERSION=v0.4.0` |
| `CFS_INSTALL_DIR` | Install somewhere else, e.g. `CFS_INSTALL_DIR=~/bin` |
| `CFS_BASE_URL` | Download from an internal mirror holding the release files |
| `CFS_DRY_RUN=1` | Print what it would do and stop |

**Windows:** download `contextfreesql.exe` from the
[latest release](https://github.com/JonathanScion/jonathan-code/releases/latest).

**Behind a strict proxy, or for a security review:** download the file for your system from the release page in a
browser, along with `SHA256SUMS`, and check it before use (`sha256sum -c SHA256SUMS`). The same files can be put in
an internal artifact store and installed with `CFS_BASE_URL`.

Prebuilt binaries are x86_64 Linux, macOS (Apple silicon), and Windows. The Linux binary is built on
`ubuntu-latest`, so a much older distribution may not be able to run it; use the source install below.

## Run from source

```bash
py -m venv venv
venv\Scripts\activate           # Linux/Mac: source venv/bin/activate
pip install -r requirements.txt

python -m src.main src/const1.json
```

Run it from the `ContextFreeSQL` folder: `python -m src.main` needs the `src` package, and relative paths in the
config (such as `./output/...`) are resolved from where you run it. With a released binary the command is
`contextfreesql` instead of `python -m src.main`.

## Command line

| Option | Short | Description |
|---|---|---|
| `config` | | Path to the config file (default: `src/config.json`) |
| `--help` | `-h` | Show help |
| `--version` | `-v` | Show the version, e.g. `contextfreesql 0.4.0` |
| `--show-config` | `-c` | Print the full configuration reference and exit |
| `--password VALUE` | `-p` | Use this password instead of the one in the config |
| `--password` | `-p` | Prompt for the password (no value given) |

```bash
python -m src.main config.json                   # run with a config file
python -m src.main config.json --password=secret # override the config's password
python -m src.main config.json -p                # prompt for the password
python -m src.main --show-config                 # configuration reference
python -m src.main --version
```

**Environment variables** override the config's `database` section: `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`,
`PGDATABASE`. A password is taken from `--password`, then `PGPASSWORD`, then the config; if all are empty it prompts.

## Configuration

The config file is JSON with seven sections. [docs/CONFIG.md](docs/CONFIG.md) documents every option; this is what
each section is for:

| Section | What it controls |
|---|---|
| `database` | Which database to read: `host`, `db_name`, `user`, `password`, `port` |
| `scripting_options` | What goes into the script: dropping entities that only exist in the target, schemas, security, and the data comparison options |
| `table_script_ops` | Which parts of a table are scripted: identity, indexes, foreign keys, defaults, check constraints |
| `db_ents_to_load` | Which entities to script (`"schema.name"`). Empty means all. Filters every entity type, not just tables |
| `tables_data` | Which tables to script data for, how many rows at most (`max_rows_per_table`), and whether to write that data to CSV files instead of INSERT statements (`from_file`, see below) |
| `input_output` | Where the script, HTML report and diff files are written, and which templates to use |
| `sql_script_params` | The default values of the flags at the top of the generated script (see below) |

`config.sample.json` is a starting point. Paths in `input_output` may be relative (`./output/report.html`).

## The generated script

The script is one PostgreSQL `DO $$ ... $$` block, so it is all or nothing: any error rolls the whole run back.
It starts with flags you can edit before running it:

| Flag | Effect |
|---|---|
| `print` | Print a description of each step |
| `printExec` | Print the SQL statements the script generates |
| `execCode` | Actually run them. `false` is a dry run: it reports and prints, but changes nothing |
| `htmlReport` | Write the HTML report and comparison pages |
| `exportCsv` | Write both sides' data as CSV |
| `basePath` | Folder for the HTML and CSV output. **Change this if you move the script** |

Run it with any PostgreSQL client, for example:

```bash
psql -h localhost -U postgres -d target_db -f output/localhost_const1_20260917_131233.sql
```

The statements it would run (or ran) come back as a result set, and the header comment records the version and
the source database:

```sql
--Generated by ContextFreeSQL 0.4.0 on 2026-09-17 13:12:34 from localhost.const1
```

### Scripting only a sample of the rows

`tables_data.max_rows_per_table` (default `0`, meaning all rows) caps how many rows each table contributes, in
primary key order so reruns match. It is meant for filling a blank database.

On its own a sample breaks foreign keys, because a sampled child row can reference a parent row that wasn't
sampled. Add `max_rows_per_table_retain_fk_integrity: true` (default false, and it does nothing without the limit)
and every referenced row is scripted as well, repeatedly, until the sample is self-contained - parent tables then
hold more rows than the limit, and the run reports what each table ended up with. Foreign keys are created normally
and fully validated; nothing is loosened to make the data fit.

A sampled script run against a database that holds data still deletes every row it doesn't carry, so it carries a
warning at the top.

### How data rows are written

Rows are grouped into multi-row `INSERT`s (`scripting_options.data_insert_batch_rows`, default 200, one row per
line), so the column list isn't repeated on every row: 40% off the script for a data-heavy table, still plain SQL
in any client. Set it to `1` for one statement per row.

### Data as CSV instead of INSERT statements

Data is always read from the source database. With `tables_data.from_file: true` it is *written* to
`<basePath>/<schema>_<table>.csv` and the script loads it with one `COPY` per table instead of one INSERT per row -
for a 1,000 row table, a 130 KB script plus a 193 KB CSV instead of a 968 KB script. The statements that change the
target are unaffected; they scale with the number of differences.

In exchange the script is no longer self-contained: the CSVs must be at `basePath` when it runs, and because `COPY`
runs on the server, they must be on the database server's filesystem with `pg_read_server_files` (or superuser)
rights. For a remote database, keep `from_file: false`.

## What it produces

All of these land in `basePath` (from `input_output`) when `htmlReport` is on:

| File | Contents |
|---|---|
| `<host>_<db>_<timestamp>.sql` | The script itself |
| `database_report.html` | Every table, view, function, trigger and data set, marked equal / only on the left / only on the right / different. Names link to their own page. Has filters per column and a dark mode toggle |
| `diff_table_<schema>_<table>.html` | One table: its CREATE TABLE on both sides side by side, and below that, the statements that make each side match the other, as copyable cards |
| `diff_<schema>_<name>.html` | One view, function, procedure or trigger: its code on both sides. Overloaded functions get a hash of their parameter list appended |
| `compare_<schema>_<table>.html` | One table's data: rows only on one side, and differing rows highlighted per cell |
| `<schema>_<table>.csv`, `..._indb.csv` | The source and target rows behind a data comparison page |

The pages are self-contained HTML; open them straight from disk.

## Version and building

The version is set in `src/version.py` and nowhere else. Bump it before building a release: it is reported by
`--version`, read by `pyproject.toml`, and stamped into the generated script's header and every report page's
footer, so you can always tell which build produced a given file. `build.bat` prints it and builds
`dist/contextfreesql.exe`; see [docs/BUILDING.md](docs/BUILDING.md).

Releasing: bump `src/version.py`, commit, then push a matching tag. `.github/workflows/build-release.yml` builds
the three binaries, writes `SHA256SUMS`, and attaches them plus `install.sh` and `config.sample.json` to a GitHub
release.

```bash
git tag v0.4.0 && git push origin v0.4.0
```

## Tests

```bash
pytest tests/                                        # all tests
pytest tests/ --ignore=tests/test_roundtrip_integration.py   # without the round-trip test
```

The tests need a live PostgreSQL server. Connection settings come from `tests/test_config.json`, which points at an
existing database (`Jonathan1` by default); the tests create and drop their own schemas inside it.
`test_roundtrip_integration.py` is the slow one - it builds a database, changes it, and checks that the generated
script restores it exactly. 7 tests skip by design (coded entities are only processed when scripting a whole
database, not a filtered list).

## Limits worth knowing

- **PostgreSQL is the supported target.** MSSQL support exists in the code but is not maintained; MySQL is defined
  only as an enum value.
- **Data needs a key.** A table with no primary key or unique index can't have its data compared or scripted; the
  script says so in its output. Unique indexes that are partial or on an expression can't serve as the key either.
- **Column defaults are not compared** on PostgreSQL, in either direction.
- **`xml` columns** are compared only for NULL differences.
- **Foreign keys are matched by referenced table name without the schema**, so two same-named tables in different
  schemas can produce spurious differences. Not fixed yet.
- **Type changes** are generated as a plain `ALTER COLUMN ... TYPE`, with no `USING` clause, so a conversion
  PostgreSQL can't do implicitly will fail when executed.
