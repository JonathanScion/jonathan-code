# TODO

Ideas and known gaps, roughly in the order they are worth doing. Not a roadmap - things get added here when
they come up so they aren't lost.

## Follow self references with a recursive CTE

`src/data_load/fk_sampling.py` walks foreign keys one round at a time. For a self reference (a `parent_id` or
`reverts_id` chain) that means one query and one row per round, so a long chain is slow and stops at the
`MAX_ROUNDS = 100` cap with its foreign keys possibly still broken. A 300-row chain reached 105 rows and stopped.

A self referencing key can instead be followed in a single query:

```sql
WITH RECURSIVE needed AS (
    SELECT * FROM move WHERE id = ANY(%s)          -- the rows already selected
    UNION
    SELECT m.* FROM move m JOIN needed n ON m.id = n.reverts_id
)
SELECT * FROM needed;
```

That removes the round-per-row behaviour for the common tree/chain case. Keep the cap for everything else.

## A generated column can't have its type changed

`get_col_sql` builds one `SQL_ALTER` per column ahead of time, so a generated column gets
`ALTER TABLE t ALTER COLUMN c TYPE x GENERATED ALWAYS AS (...) STORED`, which isn't valid SQL. It only runs if
a type difference is detected on that column, and PostgreSQL can't change a generated column's type in place
anyway - it would have to drop the expression, change the type and add it back. Nothing detects the case today:
whether a column is generated, and its expression, are not compared against the target at all (the comparison
queries for `is_computed` and `computed_definition` are MSSQL-only), so a plain column in the target where the
source has a generated one is neither reported nor fixed.

## A schema-only script still takes 34 seconds to run

Measured on const1 (165 tables, 5196 columns): the full script takes 1m22s to run, schema-only 34s, so the data
section is roughly half. The HTML report costs nothing measurable. Generating the script is not the problem
either - 8.7s full, 1.8s schema-only.

Nobody has looked at where those 34s go. Likely suspects: the state tables are filled one INSERT per column
(5196 of them, the same repetition that multi-row INSERTs fixed for data), and the comparison queries read
information_schema views, which are expensive. Worth a look before claiming the tool is fast on a big database.

## No "data only" mode

`scripting_options.script_schemas` is documented as "Include schema (namespace) DDL" but is never read: only
`tables_data.script_data` (schema only) exists. Data-only would have to keep the state tables the data section
depends on while emitting no DDL.

## Foreign keys are compared without the referenced table's schema

Dropping `scope_creator.equip_group` made the comparison flag foreign keys on `smart_scheduler.work_order` and
`scope_creator_test.pm`, which point at `equip_group` tables in *their own* schemas. The referenced table appears
to be matched by name only, so same-named tables in different schemas collide. It also produced needless drop and
re-add statements for those keys. Found while testing the table pages; not investigated further.

## Column defaults are not compared on PostgreSQL

`ScriptDefaults` is never generated for PostgreSQL (`generate_drop_add_defaults` produces nothing), so a default
that differs between source and target is neither reported nor fixed, in either direction.

## Sampling: give nullable foreign keys an option

With `max_rows_per_table_retain_fk_integrity`, a nullable foreign key pulls its parent in like any other. Blanking
it instead would keep parent tables at the sampled size, at the cost of changing the data. Would have to be opt-in
and clearly labelled, since the rows would no longer match the source.

## Report output CSVs clutter the output folder

With `html_report` on, every scripted table gets a `<schema>_<table>.csv` at generation time and every differing
table an `_indb.csv` at run time - 255 files for const1 vs const2. They are inputs for the `compare_*.html` pages,
which embed the data, so they are disposable afterwards. Writing them to a subfolder (and updating the paths the
script reads them from) would keep the output folder readable.
