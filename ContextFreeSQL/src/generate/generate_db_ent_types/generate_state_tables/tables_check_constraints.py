from enum import Enum
from typing import Optional, Dict, List
from dataclasses import dataclass
import pandas as pd
from io import StringIO
from src.defs.script_defs import DBType, DBSyntax, ScriptingOptions, ScriptTableOptions, DBEntScriptState
from src.data_load.from_db.load_from_db_pg import DBSchema
from src.utils.funcs import quote_str_or_null, quote_str_or_null_bool, numeric_or_null, bool_to_sql_bit_boolean_val


def create_db_state_check_constraints(
    schema_tables: DBSchema,
    tbl_ents_to_script: pd.DataFrame,
    db_type: DBType,
    overall_table_schema_name_in_scripting: Optional[str],
) -> StringIO:
    """
    Create state table for check constraints.

    This follows the same pattern as indexes and foreign keys:
    1. Create temp table ScriptCheckConstraints
    2. Insert desired state from script
    3. Mark constraints as: 1=add (missing in DB), 2=drop (extra in DB), 3=different
    """

    db_syntax = DBSyntax.get_syntax(db_type)
    script_db_state_tables = StringIO()
    align = "\t" * 2

    script_db_state_tables.write(f"\n\n")
    script_db_state_tables.write(f"{align}--Check Constraints\n")

    temp_table_name = "ScriptCheckConstraints"

    # Drop table if exists
    if db_type == DBType.MSSQL:
        script_db_state_tables.write(f"{align}IF (OBJECT_ID('tempdb..#{temp_table_name}') IS NOT NULL)\n")
        script_db_state_tables.write(f"{align}BEGIN\n")
        script_db_state_tables.write(f"{align}\tDROP TABLE {db_syntax.temp_table_prefix}{temp_table_name};\n")
        script_db_state_tables.write(f"{align}END;\n")
    elif db_type == DBType.PostgreSQL:
        script_db_state_tables.write(f"{align}perform n.nspname, c.relname\n")
        script_db_state_tables.write(f"{align}FROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace\n")
        script_db_state_tables.write(f"{align}WHERE n.nspname like 'pg_temp_%' AND c.relname='{temp_table_name.lower()}' AND pg_catalog.pg_table_is_visible(c.oid);\n")
        script_db_state_tables.write(f"{align}IF FOUND THEN\n")
        script_db_state_tables.write(f"{align}\tDROP TABLE {temp_table_name};\n")
        script_db_state_tables.write(f"{align}END IF;\n")

    # Create temporary table
    script_db_state_tables.write(f"{align}{db_syntax.temp_table_create}ScriptCheckConstraints\n")
    script_db_state_tables.write(f"{align}(\n")
    script_db_state_tables.write(f"{align}\ttable_schema {db_syntax.nvarchar_type}(128) not null,\n")
    script_db_state_tables.write(f"{align}\ttable_name {db_syntax.nvarchar_type}(128) not null,\n")
    script_db_state_tables.write(f"{align}\tconstraint_name {db_syntax.nvarchar_type}(128) not null,\n")
    script_db_state_tables.write(f"{align}\tconstraint_definition {db_syntax.nvarchar_type}{db_syntax.max_length_str} null,\n")
    script_db_state_tables.write(f"{align}\tconstraint_definition_diff {db_syntax.boolean_type} null,\n")
    script_db_state_tables.write(f"{align}\tccStat smallint null\n")  # ccStat: check constraint status
    script_db_state_tables.write(f"{align});\n")
    script_db_state_tables.write(f"{align}\n")

    # Filter tables to script
    tables_to_script_set = set()
    filtered_ents = tbl_ents_to_script[
        (tbl_ents_to_script['scriptschema'] == True) &
        (tbl_ents_to_script['enttype'] == 'Table')
    ]

    for _, ent_row in filtered_ents.iterrows():
        tables_to_script_set.add((ent_row['entschema'], ent_row['entname']))

    # Insert check constraints from schema_tables
    if not schema_tables.check_constraints.empty:
        script_db_state_tables.write(f"{align}--Fill it with check constraints\n")

        for _, cc_row in schema_tables.check_constraints.iterrows():
            # Only process if this table is in our tbl_ents_to_script with scriptschema=True
            if (cc_row['table_schema'], cc_row['table_name']) not in tables_to_script_set:
                continue

            script_db_state_tables.write(f"{align}INSERT INTO {db_syntax.temp_table_prefix}ScriptCheckConstraints ")
            script_db_state_tables.write(f"(table_schema, table_name, constraint_name, constraint_definition)\n")

            if db_type == DBType.PostgreSQL:
                script_db_state_tables.write(f"{align}VALUES ({quote_str_or_null(cc_row['table_schema'].lower())}, ")
                script_db_state_tables.write(f"{quote_str_or_null(cc_row['table_name'].lower())}, ")
                script_db_state_tables.write(f"{quote_str_or_null(cc_row['constraint_name'].lower())}, ")
            else:
                script_db_state_tables.write(f"{align}VALUES ({quote_str_or_null(cc_row['table_schema'])}, ")
                script_db_state_tables.write(f"{quote_str_or_null(cc_row['table_name'])}, ")
                script_db_state_tables.write(f"{quote_str_or_null(cc_row['constraint_name'])}, ")

            script_db_state_tables.write(f"{quote_str_or_null(cc_row['constraint_definition'])});\n")
            script_db_state_tables.write(f"{align}\n")

    # Update state against existing entities
    if overall_table_schema_name_in_scripting and len(overall_table_schema_name_in_scripting) > 0:
        # Mark constraints that need to be added (in script but not in DB)
        script_db_state_tables.write(f"{align}--Check constraints only in script (need to add)\n")

        if db_type == DBType.MSSQL:
            script_db_state_tables.write(f"{align}UPDATE #{temp_table_name} SET ccStat = 1\n")
            script_db_state_tables.write(f"{align}FROM #{temp_table_name} J\n")
            script_db_state_tables.write(f"{align}LEFT JOIN (\n")
            script_db_state_tables.write(f"{align}\tSELECT SCHEMA_NAME(t.schema_id) AS table_schema,\n")
            script_db_state_tables.write(f"{align}\t\tt.name AS table_name,\n")
            script_db_state_tables.write(f"{align}\t\tcc.name AS constraint_name\n")
            script_db_state_tables.write(f"{align}\tFROM sys.check_constraints cc\n")
            script_db_state_tables.write(f"{align}\tINNER JOIN sys.tables t ON cc.parent_object_id = t.object_id\n")
            script_db_state_tables.write(f"{align}\tWHERE SCHEMA_NAME(t.schema_id) + t.name IN ({overall_table_schema_name_in_scripting})\n")
            script_db_state_tables.write(f"{align}) DB ON J.table_schema = DB.table_schema\n")
            script_db_state_tables.write(f"{align}\tAND J.table_name = DB.table_name\n")
            script_db_state_tables.write(f"{align}\tAND J.constraint_name = DB.constraint_name\n")
            script_db_state_tables.write(f"{align}WHERE DB.constraint_name IS NULL;\n")

        elif db_type == DBType.PostgreSQL:
            script_db_state_tables.write(f"""{align}UPDATE ScriptCheckConstraints SET ccStat = 1
{align}WHERE NOT EXISTS (
{align}\tSELECT 1
{align}\tFROM pg_constraint con
{align}\tINNER JOIN pg_class t ON con.conrelid = t.oid
{align}\tINNER JOIN pg_namespace ns ON t.relnamespace = ns.oid
{align}\tWHERE con.contype = 'c'
{align}\t\tAND ns.nspname || t.relname IN ({overall_table_schema_name_in_scripting})
{align}\t\tAND LOWER(ns.nspname) = LOWER(ScriptCheckConstraints.table_schema)
{align}\t\tAND LOWER(t.relname) = LOWER(ScriptCheckConstraints.table_name)
{align}\t\tAND LOWER(con.conname) = LOWER(ScriptCheckConstraints.constraint_name)
{align});
""")

        script_db_state_tables.write(f"{align}\n")

        # Mark constraints that need to be dropped (in DB but not in script)
        script_db_state_tables.write(f"{align}--Check constraints only in DB (need to drop)\n")

        if db_type == DBType.MSSQL:
            script_db_state_tables.write(f"{align}INSERT INTO #{temp_table_name} (table_schema, table_name, constraint_name, ccStat)\n")
            script_db_state_tables.write(f"{align}SELECT DB.table_schema, DB.table_name, DB.constraint_name, 2\n")
            script_db_state_tables.write(f"{align}FROM #{temp_table_name} J\n")
            script_db_state_tables.write(f"{align}RIGHT JOIN (\n")
            script_db_state_tables.write(f"{align}\tSELECT SCHEMA_NAME(t.schema_id) AS table_schema,\n")
            script_db_state_tables.write(f"{align}\t\tt.name AS table_name,\n")
            script_db_state_tables.write(f"{align}\t\tcc.name AS constraint_name\n")
            script_db_state_tables.write(f"{align}\tFROM sys.check_constraints cc\n")
            script_db_state_tables.write(f"{align}\tINNER JOIN sys.tables t ON cc.parent_object_id = t.object_id\n")
            script_db_state_tables.write(f"{align}\tWHERE SCHEMA_NAME(t.schema_id) + t.name IN ({overall_table_schema_name_in_scripting})\n")
            script_db_state_tables.write(f"{align}) DB ON J.table_schema = DB.table_schema\n")
            script_db_state_tables.write(f"{align}\tAND J.table_name = DB.table_name\n")
            script_db_state_tables.write(f"{align}\tAND J.constraint_name = DB.constraint_name\n")
            script_db_state_tables.write(f"{align}WHERE J.constraint_name IS NULL;\n")

        elif db_type == DBType.PostgreSQL:
            script_db_state_tables.write(f"""{align}INSERT INTO ScriptCheckConstraints (table_schema, table_name, constraint_name, constraint_definition, ccStat)
{align}SELECT DB.table_schema, DB.table_name, DB.constraint_name, DB.constraint_definition, 2
{align}FROM ScriptCheckConstraints J
{align}RIGHT JOIN (
{align}\tSELECT ns.nspname AS table_schema,
{align}\t\tt.relname AS table_name,
{align}\t\tcon.conname AS constraint_name,
{align}\t\tpg_get_constraintdef(con.oid) AS constraint_definition
{align}\tFROM pg_constraint con
{align}\tINNER JOIN pg_class t ON con.conrelid = t.oid
{align}\tINNER JOIN pg_namespace ns ON t.relnamespace = ns.oid
{align}\tWHERE con.contype = 'c'
{align}\t\tAND ns.nspname || t.relname IN ({overall_table_schema_name_in_scripting})
{align}) DB ON LOWER(J.table_schema) = LOWER(DB.table_schema)
{align}\tAND LOWER(J.table_name) = LOWER(DB.table_name)
{align}\tAND LOWER(J.constraint_name) = LOWER(DB.constraint_name)
{align}WHERE J.constraint_name IS NULL;
""")

        script_db_state_tables.write(f"{align}\n")

        # Mark constraints that are different
        script_db_state_tables.write(f"{align}--Check constraints that are different\n")

        if db_type == DBType.MSSQL:
            script_db_state_tables.write(f"{align}UPDATE #{temp_table_name} SET constraint_definition_diff = 1, ccStat = 3\n")
            script_db_state_tables.write(f"{align}FROM #{temp_table_name} J\n")
            script_db_state_tables.write(f"{align}INNER JOIN (\n")
            script_db_state_tables.write(f"{align}\tSELECT SCHEMA_NAME(t.schema_id) AS table_schema,\n")
            script_db_state_tables.write(f"{align}\t\tt.name AS table_name,\n")
            script_db_state_tables.write(f"{align}\t\tcc.name AS constraint_name,\n")
            script_db_state_tables.write(f"{align}\t\tcc.definition AS constraint_definition\n")
            script_db_state_tables.write(f"{align}\tFROM sys.check_constraints cc\n")
            script_db_state_tables.write(f"{align}\tINNER JOIN sys.tables t ON cc.parent_object_id = t.object_id\n")
            script_db_state_tables.write(f"{align}) DB ON J.table_schema = DB.table_schema\n")
            script_db_state_tables.write(f"{align}\tAND J.table_name = DB.table_name\n")
            script_db_state_tables.write(f"{align}\tAND J.constraint_name = DB.constraint_name\n")
            script_db_state_tables.write(f"{align}WHERE J.constraint_definition <> DB.constraint_definition\n")
            script_db_state_tables.write(f"{align}\tAND J.ccStat IS NULL;\n")

        elif db_type == DBType.PostgreSQL:
            script_db_state_tables.write(f"""{align}UPDATE ScriptCheckConstraints SET constraint_definition_diff = True, ccStat = 3
{align}FROM ScriptCheckConstraints J
{align}INNER JOIN (
{align}\tSELECT ns.nspname AS table_schema,
{align}\t\tt.relname AS table_name,
{align}\t\tcon.conname AS constraint_name,
{align}\t\tpg_get_constraintdef(con.oid) AS constraint_definition
{align}\tFROM pg_constraint con
{align}\tINNER JOIN pg_class t ON con.conrelid = t.oid
{align}\tINNER JOIN pg_namespace ns ON t.relnamespace = ns.oid
{align}\tWHERE con.contype = 'c'
{align}) DB ON LOWER(J.table_schema) = LOWER(DB.table_schema)
{align}\tAND LOWER(J.table_name) = LOWER(DB.table_name)
{align}\tAND LOWER(J.constraint_name) = LOWER(DB.constraint_name)
{align}WHERE J.constraint_definition <> DB.constraint_definition
{align}\tAND J.ccStat IS NULL
{align}\tAND (ScriptCheckConstraints.table_schema = J.table_schema
{align}\t\tAND ScriptCheckConstraints.table_name = J.table_name
{align}\t\tAND ScriptCheckConstraints.constraint_name = J.constraint_name);
""")

    script_db_state_tables.write(f"{align}--End of check constraints state table\n")

    return script_db_state_tables
