"""
Round-trip Integration Test for ContextFreeSQL

This test verifies that ContextFreeSQL can:
1. Capture a database's complete schema and data state
2. Generate a SQL script that can restore any modified database back to that state
3. Successfully execute that script to restore the original state

Test flow:
1. Create fresh test database
2. Run setup_test_db.sql (baseline)
3. Capture baseline schema snapshot (for verification)
4. Run ContextFreeSQL to generate script capturing baseline state
5. Run modify_test_db.sql (make various changes)
6. Execute the generated script on the modified database
7. Capture final schema snapshot
8. Compare final snapshot to baseline - they should be identical
"""

import os
import sys
import json
import pytest
import psycopg2
from psycopg2 import sql
from pathlib import Path
from typing import Dict, List, Any
from dataclasses import dataclass, field

# Add the src directory to the path so we can import the main module
sys.path.insert(0, str(Path(__file__).parent.parent))


@dataclass
class SchemaSnapshot:
    """Captures a snapshot of the database schema for comparison."""
    tables: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    columns: Dict[str, List[Dict[str, Any]]] = field(default_factory=dict)
    indexes: Dict[str, List[Dict[str, Any]]] = field(default_factory=dict)
    foreign_keys: Dict[str, List[Dict[str, Any]]] = field(default_factory=dict)
    check_constraints: Dict[str, List[Dict[str, Any]]] = field(default_factory=dict)
    functions: List[Dict[str, Any]] = field(default_factory=list)
    views: List[Dict[str, Any]] = field(default_factory=list)
    table_data: Dict[str, List[Dict[str, Any]]] = field(default_factory=dict)


class TestRoundtripIntegration:
    """Integration tests for the complete round-trip workflow."""

    # Test database settings - uses a separate test database
    TEST_DB_NAME = "contextfree_roundtrip_test"
    POSTGRES_HOST = "localhost"
    POSTGRES_PORT = "5432"
    POSTGRES_USER = "postgres"
    POSTGRES_PASSWORD = "yonision"  # Should match your local setup

    @pytest.fixture(autouse=True)
    def setup_and_teardown(self):
        """Setup test database before each test and cleanup after."""
        self._create_test_database()
        yield
        self._drop_test_database()

    def _get_admin_connection(self):
        """Get connection to postgres database for admin operations."""
        return psycopg2.connect(
            host=self.POSTGRES_HOST,
            port=self.POSTGRES_PORT,
            user=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD,
            database="postgres"
        )

    def _get_test_connection(self):
        """Get connection to the test database."""
        return psycopg2.connect(
            host=self.POSTGRES_HOST,
            port=self.POSTGRES_PORT,
            user=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD,
            database=self.TEST_DB_NAME
        )

    def _create_test_database(self):
        """Create a fresh test database."""
        conn = self._get_admin_connection()
        conn.autocommit = True
        cursor = conn.cursor()

        # Terminate existing connections
        cursor.execute(sql.SQL("""
            SELECT pg_terminate_backend(pg_stat_activity.pid)
            FROM pg_stat_activity
            WHERE pg_stat_activity.datname = %s
            AND pid <> pg_backend_pid()
        """), [self.TEST_DB_NAME])

        cursor.execute(sql.SQL("DROP DATABASE IF EXISTS {}").format(
            sql.Identifier(self.TEST_DB_NAME)
        ))
        cursor.execute(sql.SQL("CREATE DATABASE {}").format(
            sql.Identifier(self.TEST_DB_NAME)
        ))

        cursor.close()
        conn.close()

    def _drop_test_database(self):
        """Drop the test database."""
        conn = self._get_admin_connection()
        conn.autocommit = True
        cursor = conn.cursor()

        cursor.execute(sql.SQL("""
            SELECT pg_terminate_backend(pg_stat_activity.pid)
            FROM pg_stat_activity
            WHERE pg_stat_activity.datname = %s
            AND pid <> pg_backend_pid()
        """), [self.TEST_DB_NAME])

        cursor.execute(sql.SQL("DROP DATABASE IF EXISTS {}").format(
            sql.Identifier(self.TEST_DB_NAME)
        ))

        cursor.close()
        conn.close()

    def _run_sql_file(self, filepath: str):
        """Execute a SQL file against the test database."""
        conn = self._get_test_connection()
        conn.autocommit = True
        cursor = conn.cursor()

        with open(filepath, 'r', encoding='utf-8') as f:
            sql_content = f.read()

        cursor.execute(sql_content)
        cursor.close()
        conn.close()

    def _execute_sql(self, sql_content: str):
        """Execute SQL content against the test database."""
        conn = self._get_test_connection()
        cursor = conn.cursor()

        try:
            cursor.execute(sql_content)
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise RuntimeError(f"Failed to execute SQL: {e}")
        finally:
            cursor.close()
            conn.close()

    def _capture_schema_snapshot(self) -> SchemaSnapshot:
        """Capture a complete snapshot of the database schema and data."""
        conn = self._get_test_connection()
        cursor = conn.cursor()
        snapshot = SchemaSnapshot()

        # Capture tables
        cursor.execute("""
            SELECT table_schema, table_name, table_type
            FROM information_schema.tables
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            AND table_type = 'BASE TABLE'
            ORDER BY table_schema, table_name
        """)
        for row in cursor.fetchall():
            key = f"{row[0]}.{row[1]}"
            snapshot.tables[key] = {
                'schema': row[0],
                'name': row[1],
                'type': row[2]
            }

        # Capture columns
        cursor.execute("""
            SELECT table_schema, table_name, column_name, data_type,
                   udt_name, is_nullable, column_default, character_maximum_length,
                   numeric_precision, numeric_scale, ordinal_position
            FROM information_schema.columns
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY table_schema, table_name, ordinal_position
        """)
        for row in cursor.fetchall():
            key = f"{row[0]}.{row[1]}"
            if key not in snapshot.columns:
                snapshot.columns[key] = []
            snapshot.columns[key].append({
                'name': row[2],
                'data_type': row[3],
                'udt_name': row[4],
                'is_nullable': row[5],
                'column_default': row[6],
                'max_length': row[7],
                'precision': row[8],
                'scale': row[9],
                'ordinal': row[10]
            })

        # Capture indexes
        cursor.execute("""
            SELECT schemaname, tablename, indexname, indexdef
            FROM pg_indexes
            WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
            ORDER BY schemaname, tablename, indexname
        """)
        for row in cursor.fetchall():
            key = f"{row[0]}.{row[1]}"
            if key not in snapshot.indexes:
                snapshot.indexes[key] = []
            snapshot.indexes[key].append({
                'name': row[2],
                'definition': row[3]
            })

        # Capture foreign keys
        cursor.execute("""
            SELECT
                tc.table_schema,
                tc.table_name,
                tc.constraint_name,
                kcu.column_name,
                ccu.table_schema AS foreign_table_schema,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name,
                rc.update_rule,
                rc.delete_rule
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            JOIN information_schema.referential_constraints AS rc
                ON rc.constraint_name = tc.constraint_name
                AND rc.constraint_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
            ORDER BY tc.table_schema, tc.table_name, tc.constraint_name
        """)
        for row in cursor.fetchall():
            key = f"{row[0]}.{row[1]}"
            if key not in snapshot.foreign_keys:
                snapshot.foreign_keys[key] = []
            snapshot.foreign_keys[key].append({
                'name': row[2],
                'column': row[3],
                'ref_schema': row[4],
                'ref_table': row[5],
                'ref_column': row[6],
                'update_rule': row[7],
                'delete_rule': row[8]
            })

        # Capture check constraints
        cursor.execute("""
            SELECT
                n.nspname AS table_schema,
                t.relname AS table_name,
                con.conname AS constraint_name,
                pg_get_constraintdef(con.oid) AS constraint_definition
            FROM pg_constraint con
            INNER JOIN pg_class t ON con.conrelid = t.oid
            INNER JOIN pg_namespace n ON t.relnamespace = n.oid
            WHERE con.contype = 'c'
            AND n.nspname NOT IN ('pg_catalog', 'information_schema')
            ORDER BY n.nspname, t.relname, con.conname
        """)
        for row in cursor.fetchall():
            key = f"{row[0]}.{row[1]}"
            if key not in snapshot.check_constraints:
                snapshot.check_constraints[key] = []
            snapshot.check_constraints[key].append({
                'name': row[2],
                'definition': row[3]
            })

        # Capture functions (exclude internal pg functions)
        cursor.execute("""
            SELECT
                n.nspname AS schema_name,
                p.proname AS function_name,
                pg_get_function_arguments(p.oid) AS arguments,
                pg_get_functiondef(p.oid) AS definition
            FROM pg_proc p
            INNER JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
            AND p.prokind IN ('f', 'p')
            ORDER BY n.nspname, p.proname
        """)
        for row in cursor.fetchall():
            snapshot.functions.append({
                'schema': row[0],
                'name': row[1],
                'arguments': row[2],
                'definition': row[3]
            })

        # Capture views
        cursor.execute("""
            SELECT table_schema, table_name, view_definition
            FROM information_schema.views
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY table_schema, table_name
        """)
        for row in cursor.fetchall():
            snapshot.views.append({
                'schema': row[0],
                'name': row[1],
                'definition': row[2]
            })

        # Capture table data
        for table_key in snapshot.tables.keys():
            schema, table = table_key.split('.')
            try:
                cursor.execute(sql.SQL("""
                    SELECT column_name FROM information_schema.columns
                    WHERE table_schema = %s AND table_name = %s
                    ORDER BY ordinal_position
                """), [schema, table])
                columns = [row[0] for row in cursor.fetchall()]

                if columns:
                    cursor.execute(sql.SQL("SELECT * FROM {}.{} ORDER BY 1").format(
                        sql.Identifier(schema),
                        sql.Identifier(table)
                    ))
                    rows = cursor.fetchall()
                    snapshot.table_data[table_key] = [
                        dict(zip(columns, row)) for row in rows
                    ]
            except Exception as e:
                print(f"Warning: Could not capture data for {table_key}: {e}")
                snapshot.table_data[table_key] = []

        cursor.close()
        conn.close()
        return snapshot

    def _compare_snapshots(self, baseline: SchemaSnapshot, final: SchemaSnapshot) -> List[str]:
        """Compare two schema snapshots and return list of differences."""
        differences = []

        # Compare tables
        baseline_tables = set(baseline.tables.keys())
        final_tables = set(final.tables.keys())

        missing_tables = baseline_tables - final_tables
        extra_tables = final_tables - baseline_tables

        if missing_tables:
            differences.append(f"Missing tables: {missing_tables}")
        if extra_tables:
            differences.append(f"Extra tables: {extra_tables}")

        # Compare columns for each common table
        for table_key in baseline_tables & final_tables:
            baseline_cols = {c['name']: c for c in baseline.columns.get(table_key, [])}
            final_cols = {c['name']: c for c in final.columns.get(table_key, [])}

            missing_cols = set(baseline_cols.keys()) - set(final_cols.keys())
            extra_cols = set(final_cols.keys()) - set(baseline_cols.keys())

            if missing_cols:
                differences.append(f"Table {table_key} missing columns: {missing_cols}")
            if extra_cols:
                differences.append(f"Table {table_key} extra columns: {extra_cols}")

            for col_name in set(baseline_cols.keys()) & set(final_cols.keys()):
                bc = baseline_cols[col_name]
                fc = final_cols[col_name]

                for prop in ['udt_name', 'is_nullable']:
                    if bc.get(prop) != fc.get(prop):
                        differences.append(
                            f"Table {table_key} column {col_name} {prop} differs: "
                            f"baseline={bc.get(prop)}, final={fc.get(prop)}"
                        )

        # Compare indexes
        for table_key in baseline_tables & final_tables:
            baseline_idx = {i['name']: i for i in baseline.indexes.get(table_key, [])}
            final_idx = {i['name']: i for i in final.indexes.get(table_key, [])}

            missing_idx = set(baseline_idx.keys()) - set(final_idx.keys())
            extra_idx = set(final_idx.keys()) - set(baseline_idx.keys())

            if missing_idx:
                differences.append(f"Table {table_key} missing indexes: {missing_idx}")
            if extra_idx:
                differences.append(f"Table {table_key} extra indexes: {extra_idx}")

        # Compare foreign keys
        for table_key in baseline_tables & final_tables:
            baseline_fks = {fk['name']: fk for fk in baseline.foreign_keys.get(table_key, [])}
            final_fks = {fk['name']: fk for fk in final.foreign_keys.get(table_key, [])}

            missing_fks = set(baseline_fks.keys()) - set(final_fks.keys())
            extra_fks = set(final_fks.keys()) - set(baseline_fks.keys())

            if missing_fks:
                differences.append(f"Table {table_key} missing foreign keys: {missing_fks}")
            if extra_fks:
                differences.append(f"Table {table_key} extra foreign keys: {extra_fks}")

        # Compare check constraints
        for table_key in baseline_tables & final_tables:
            baseline_ccs = {cc['name']: cc for cc in baseline.check_constraints.get(table_key, [])}
            final_ccs = {cc['name']: cc for cc in final.check_constraints.get(table_key, [])}

            missing_ccs = set(baseline_ccs.keys()) - set(final_ccs.keys())
            extra_ccs = set(final_ccs.keys()) - set(baseline_ccs.keys())

            if missing_ccs:
                differences.append(f"Table {table_key} missing check constraints: {missing_ccs}")
            if extra_ccs:
                differences.append(f"Table {table_key} extra check constraints: {extra_ccs}")

        # Compare functions
        baseline_funcs = {(f['schema'], f['name'], f['arguments']): f for f in baseline.functions}
        final_funcs = {(f['schema'], f['name'], f['arguments']): f for f in final.functions}

        missing_funcs = set(baseline_funcs.keys()) - set(final_funcs.keys())
        extra_funcs = set(final_funcs.keys()) - set(baseline_funcs.keys())

        if missing_funcs:
            differences.append(f"Missing functions: {missing_funcs}")
        if extra_funcs:
            differences.append(f"Extra functions: {extra_funcs}")

        # Compare views
        baseline_views = {(v['schema'], v['name']): v for v in baseline.views}
        final_views = {(v['schema'], v['name']): v for v in final.views}

        missing_views = set(baseline_views.keys()) - set(final_views.keys())
        extra_views = set(final_views.keys()) - set(baseline_views.keys())

        if missing_views:
            differences.append(f"Missing views: {missing_views}")
        if extra_views:
            differences.append(f"Extra views: {extra_views}")

        # Compare table data (row counts)
        for table_key in baseline_tables & final_tables:
            baseline_data = baseline.table_data.get(table_key, [])
            final_data = final.table_data.get(table_key, [])

            if len(baseline_data) != len(final_data):
                differences.append(
                    f"Table {table_key} row count differs: "
                    f"baseline={len(baseline_data)}, final={len(final_data)}"
                )

        return differences

    def _create_test_config(self, output_path: str) -> str:
        """Create a config file for ContextFreeSQL."""
        config = {
            "database": {
                "host": self.POSTGRES_HOST,
                "db_name": self.TEST_DB_NAME,
                "user": self.POSTGRES_USER,
                "password": self.POSTGRES_PASSWORD,
                "port": self.POSTGRES_PORT
            },
            "scripting_options": {
                "remove_all_extra_ents": True,
                "column_collation": True,
                "code_compare_no_white_space": True,
                "pre_add_constraints_data_checks": False,
                "script_schemas": True,
                "all_schemas": True,
                "script_security": False,
                "data_scripting_leave_report_fields_updated": False,
                "data_scripting_leave_report_fields_updated_save_old_value": False,
                "data_scripting_generate_dml_statements": True,
                "data_comparison_include_equal_rows": False
            },
            "table_script_ops": {
                "column_identity": True,
                "indexes": True,
                "foreign_keys": True,
                "defaults": True,
                "check_constraints": True
            },
            "db_ents_to_load": {
                "tables": []
            },
            "tables_data": {
                "tables": [],
                "from_file": False
            },
            "input_output": {
                "html_template_path": "",
                "html_output_path": "",
                "diff_template_path": "",
                "diff_output_dir": "",
                "output_sql": output_path
            },
            "sql_script_params": {
                "print": True,
                "print_exec": True,
                "exec_code": False,
                "html_report": False,
                "export_csv": False
            }
        }

        config_path = os.path.join(os.path.dirname(__file__), "test_config_roundtrip.json")
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)

        return config_path

    def _run_context_free_sql(self, config_path: str):
        """Run ContextFreeSQL to generate the migration script."""
        from src.main import main as run_main

        original_argv = sys.argv
        try:
            sys.argv = ['main.py', config_path]
            run_main()
        finally:
            sys.argv = original_argv

    def test_roundtrip_schema_and_data_restoration(self):
        """
        Test that ContextFreeSQL can detect all changes and restore the database
        to its original state.

        Flow:
        1. Run setup_test_db.sql to create baseline
        2. Capture baseline schema snapshot
        3. Run ContextFreeSQL to generate script capturing baseline state
        4. Run modify_test_db.sql to make changes
        5. Execute the generated script on the modified database
        6. Capture final schema snapshot
        7. Compare final to baseline - should be identical
        """
        tests_dir = Path(__file__).parent
        setup_sql = tests_dir / "setup_test_db.sql"
        modify_sql = tests_dir / "modify_test_db.sql"
        output_sql = tests_dir / "roundtrip_test_output.sql"

        # Step 1: Create baseline database
        print("\n=== Step 1: Creating baseline database ===")
        self._run_sql_file(str(setup_sql))

        # Step 2: Capture baseline snapshot
        print("=== Step 2: Capturing baseline snapshot ===")
        baseline_snapshot = self._capture_schema_snapshot()
        print(f"  Tables: {list(baseline_snapshot.tables.keys())}")
        print(f"  Functions: {[(f['schema'], f['name']) for f in baseline_snapshot.functions]}")
        print(f"  Check constraints: {sum(len(v) for v in baseline_snapshot.check_constraints.values())}")

        # Step 3: Run ContextFreeSQL to capture baseline state in a script
        print("=== Step 3: Running ContextFreeSQL to capture baseline ===")
        config_path = self._create_test_config(str(output_sql))
        self._run_context_free_sql(config_path)
        print(f"  Generated script: {output_sql}")

        # Step 4: Modify the database
        print("=== Step 4: Modifying database ===")
        self._run_sql_file(str(modify_sql))

        modified_snapshot = self._capture_schema_snapshot()
        print(f"  Tables after modify: {list(modified_snapshot.tables.keys())}")
        print(f"  Functions after modify: {[(f['schema'], f['name']) for f in modified_snapshot.functions]}")

        # Step 5: Execute the generated script to restore baseline
        print("=== Step 5: Executing generated script ===")
        with open(output_sql, 'r', encoding='utf-8') as f:
            script_content = f.read()

        # Modify script to actually execute (change execCode to true)
        script_content = script_content.replace('execCode boolean := false;', 'execCode boolean := true;')
        # Also enable printing for debugging
        script_content = script_content.replace('print boolean := true;', 'print boolean := true;')
        script_content = script_content.replace('printExec boolean := true;', 'printExec boolean := true;')

        self._execute_sql(script_content)
        print("  Script executed successfully")

        # Step 6: Capture final snapshot
        print("=== Step 6: Capturing final snapshot ===")
        final_snapshot = self._capture_schema_snapshot()

        # Step 7: Compare
        print("=== Step 7: Comparing snapshots ===")
        differences = self._compare_snapshots(baseline_snapshot, final_snapshot)

        # Cleanup
        if os.path.exists(config_path):
            os.remove(config_path)
        if os.path.exists(output_sql):
            os.remove(output_sql)

        if differences:
            print("\nDIFFERENCES FOUND:")
            for diff in differences:
                print(f"  - {diff}")

        assert len(differences) == 0, f"Schema differences found after roundtrip:\n" + "\n".join(differences)
        print("\n=== SUCCESS: Database restored to baseline state! ===")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
