import os
from pydantic import BaseModel
from src.infra.database import Database
from psycopg2.extras import RealDictCursor #!see if we need this
import pandas as pd
import numpy as np
from src.utils import funcs as utils
from typing import Optional
import networkx as nx

class DBSchema(BaseModel):
    schemas: pd.DataFrame 
    tables: pd.DataFrame
    columns: pd.DataFrame
    defaults: pd.DataFrame
    indexes: pd.DataFrame
    index_cols: pd.DataFrame
    fks: pd.DataFrame
    fk_cols: pd.DataFrame
    #check_constraints: Optional[pd.DataFrame] = None #!TBD
    

    class Config:
        arbitrary_types_allowed = True  # Needed for pd.DataFrame


def load_all_schema() -> DBSchema:
    
    schemas = _load_schemas()
    tables = _load_tables()
    columns = _load_tables_columns()
    defaults = _load_tables_columns_defaults()
    indexes = _load_tables_indexes()
    index_cols = _process_index_cols_pg(columns, indexes)
    fks = _load_tables_foreign_keys()
    fk_cols = _process_fk_cols_pg(columns, fks)
    
    #defaults = #in MSSQL there was a separate query for defaults. in PG, seems to me that loading columns has defaults in it. so verify, and then if i implement MSSQL, see if need separate query or can go by PG format. 
    #MSSQL was: SELECT SCHEMA_NAME(o.schema_id) AS table_schema, OBJECT_NAME(o.object_id) AS table_name, d.name as default_name, d.definition as default_definition, c.name as col_name FROM sys.default_constraints d INNER JOIN sys.objects o ON d.parent_object_id=o.object_id INNER jOIN sys.columns c on d.parent_object_id=c.object_id AND d.parent_column_id = c.column_id

    return DBSchema(
        schemas = schemas,
        tables = tables,
        columns = columns,
        defaults = defaults,
        indexes = indexes,
        index_cols = index_cols,
        fks = fks,
        fk_cols = fk_cols
    )

def _load_schemas() -> pd.DataFrame:
    conn = None
    cur = None
    try:
        conn = Database.connect_to_aurora()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        sql =  """select schema_name, schema_owner as principal_name from information_schema.schemata 
                    WHERE schema_name NOT IN ('pg_catalog','information_schema', 'pg_toast') and schema_name NOT LIKE 'pg_temp%' and schema_name NOT LIKE 'pg_toast%'"""
        cur.execute(sql)
         
        results = cur.fetchall()
        
        return pd.DataFrame(results)
        
    except Exception as e:
        print(f"Error: {e}")
        
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


def _load_tables() -> pd.DataFrame:   
    conn = None
    cur = None
    try:
        conn = Database.connect_to_aurora()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        sql =  """SELECT  table_schema || '.' || table_name as object_id, table_name as entname, 'U' as type,  null as crdate, table_schema as entschema, table_schema, table_name,
                            null as schema_ver, 
                            NULL as ident_seed, 
                            NULL as ident_incr, Now() as db_now, null as table_sql  
                            FROM information_schema.TABLES E where TABLE_TYPE LIKE '%TABLE%'
                            and TABLE_SCHEMA not in ('information_schema', 'pg_catalog')""" 
        cur.execute(sql)
         
        results = cur.fetchall()
        
        return pd.DataFrame(results)
        
    except Exception as e:
        print(f"Error: {e}")
        
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

def _load_tables_columns() -> pd.DataFrame:
    conn = None
    cur = None
    try:
        conn = Database.connect_to_aurora()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        sql = """select table_schema || '.' || table_name as object_id,  COLUMN_NAME as col_name, ORDINAL_POSITION as column_id, table_schema, table_name, COLLATION_NAME as col_collation, COLLATION_NAME, DATA_TYPE AS user_type_name, 
                            CHARACTER_MAXIMUM_LENGTH as max_length ,NULL as col_xtype, NUMERIC_PRECISION as precision, NUMERIC_SCALE as scale, case WHEN IS_NULLABLE = 'YES' then 1 WHEN IS_NULLABLE = 'NO' then 0 END AS is_nullable,
                             null as IsRowGuidCol, null as col_default_name, COLUMN_DEFAULT as col_Default_Text, position(c.data_type in 'unsigned')>0 AS col_unsigned, 
                            NULL AS extra, 
                            0 AS is_computed, null AS computed_definition ,
                            case WHEN is_identity  = 'YES' then 1 WHEN is_identity  = 'NO' then 0 END AS is_identity, 
                            identity_generation, identity_start as indent_seed, identity_increment as indent_incr, identity_maximum, identity_minimum, identity_cycle
                            FROM information_schema.COLUMNS C
                             where C.TABLE_SCHEMA not in ('information_schema', 'pg_catalog') """
        cur.execute(sql)
        results = cur.fetchall()
        
        return pd.DataFrame(results)
        
    except Exception as e:
        print(f"Error: {e}")
        
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

def _load_tables_columns_defaults() -> pd.DataFrame:
    conn = None
    cur = None
    try:
        conn = Database.connect_to_aurora()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        sql = """select table_schema, table_name, COLUMN_NAME as col_name, 
                        'def_' || table_schema || '_' || table_name || '_' || COLUMN_NAME as default_name, 
                        COLUMN_DEFAULT as default_definition
                FROM information_schema.COLUMNS C
                WHERE C.TABLE_SCHEMA not in ('information_schema', 'pg_catalog') 
                AND column_default is NOT NULL"""
        cur.execute(sql)
        results = cur.fetchall()
        
        return pd.DataFrame(results)
        
    except Exception as e:
        print(f"Error: {e}")
        
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


def _load_tables_indexes() -> pd.DataFrame:
    conn = None
    cur = None
    try:
        conn = Database.connect_to_aurora()
        cur = conn.cursor(cursor_factory=RealDictCursor)
  
        sql= """SELECT
                scm.nspname  || '.' || t.relname as object_id, /*t.oid as object_id,*/ i.oid as index_oid,
                scm.nspname As table_schema,
                t.relname as table_name,
                i.relname as index_name, i.relname as name,
                ix.indisunique as is_unique,
                indisclustered as is_clustered,
                0 as index_id, 0 as type,--not implementing for PG right now, as MSSQL indexes are so different
                0 as is_hypothetical,
                NULL as data_space_name,
                null as ignore_dup_key,
                indisprimary as is_primary_key,
                case cnst.contype when 'u' then 1 else 0 end as is_unique_constraint, --! is there such in pg?
                cnst.contype  as is_unique_constraint1,
                ix.indkey,
                am.amname as index_type,
                NULL as is_padded ,
                0 as is_disabled, --! can index be disabled in postgres?
                null as allow_row_locks,
                null as allow_page_locks,
                null as no_recompute,
                null as has_filter,
                null as filter_definition,
                null as type_desc,
                null as secondary_type_desc,
                null as fill_factor,
                null as type_desc, --for MSSQL comparisons
                substring(indexdef,'\((.*?)\)') /* ix.indkey*/ as index_columns,
                idx.indexdef as index_sql --PG provides full CREATE INDEX actually. could even compare only on this field (and schma)name and table_name)
            from
                pg_index ix 
                inner Join pg_class i  ON i.oid = ix.indexrelid
                inner Join pg_class t on t.oid = ix.indrelid --indrelid Is the oid of the table
                inner Join pg_namespace scm on  t.relnamespace = scm.oid
                inner JOIN pg_class cls ON cls.oid=ix.indexrelid inner JOIN pg_am am ON am.oid=cls.relam
                inner join pg_indexes idx on idx.schemaname=scm.nspname and idx.tablename=t.relname and idx.indexname=i.relname
                Left Join pg_constraint cnst on t.oid = cnst.conrelid And i.oid=cnst.conindid And cnst.contype='u'	
            where scm.nspname not in ('pg_catalog','information_schema', 'pg_toast')"""
            
        cur.execute(sql)
        results = cur.fetchall()

        return pd.DataFrame(results)
        
    except Exception as e:
        print(f"Error: {e}")
        
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

def _process_index_cols_pg(tbl_cols, tbl_indexes) -> pd.DataFrame:
    # Convert lists to DataFrames if they aren't already
    tbl_cols = pd.DataFrame(tbl_cols) if not isinstance(tbl_cols, pd.DataFrame) else tbl_cols
    tbl_indexes = pd.DataFrame(tbl_indexes) if not isinstance(tbl_indexes, pd.DataFrame) else tbl_indexes
    
    output = pd.DataFrame(columns=[
        'object_id', 'index_id', 'index_name', 'table_schema', 'table_name',
        'col_name', 'name', 'user_type_name', 'index_column_id', 'is_descending_key',
        'column_id', 'key_ordinal', 'is_included_column', 'partition_ordinal'
    ]).astype({
        'object_id': 'string',
        'index_id': 'int32',
        'index_name': 'string',
        'table_schema': 'string',
        'table_name': 'string',
        'col_name': 'string',
        'name': 'string',
        'user_type_name': 'string',
        'index_column_id': 'int32',
        'is_descending_key': 'bool',
        'column_id': 'int64',
        'key_ordinal': 'int64',
        'is_included_column': 'bool',
        'partition_ordinal': 'uint8'
    })
    
    if tbl_indexes.empty:
        return pd.DataFrame(output)

    # Convert indkey to list of integers and explode
    index_cols = tbl_indexes.copy()
    index_cols['indkey'] = index_cols['indkey'].apply(lambda x: [int(i) for i in str(x).split()])
    index_cols = index_cols.explode('indkey').reset_index()
    
    # Convert indkey to int64 to match column_id type
    index_cols['indkey'] = index_cols['indkey'].astype('int64')
    
    # Ensure column_id is int64
    tbl_cols['column_id'] = pd.to_numeric(tbl_cols['column_id'], errors='coerce').astype('int64')
    
    # Add ordinal position (1-based)
    index_cols['ordinal'] = index_cols.groupby('index')['indkey'].cumcount() + 1
    
    # Merge with columns table
    result = pd.merge(
        index_cols,
        tbl_cols,
        left_on=['table_schema', 'table_name', 'indkey'],
        right_on=['table_schema', 'table_name', 'column_id']
    )
    
    # Format output according to schema
    # Construct the object_id from schema and table name if not present
    if 'object_id' not in result.columns:
        result['object_id'] = result['table_schema'] + '.' + result['table_name']
    
    output = pd.DataFrame({
        'object_id': result['object_id'],
        'index_id': result.get('index_id', 0),  # Default to 0 if not present
        'index_name': result['index_name'],
        'table_schema': result['table_schema'],
        'table_name': result['table_name'],
        'col_name': result['col_name'],
        'name': result['col_name'],
        'user_type_name': result['user_type_name'],
        'index_column_id': result['ordinal'],
        'is_descending_key': False,
        'column_id': result['column_id'],
        'key_ordinal': result['ordinal'],
        'is_included_column': False,
        'partition_ordinal': 0
    })
    
    return output


def _load_tables_foreign_keys() -> pd.DataFrame:
    conn = None
    cur = None
    try:
        conn = Database.connect_to_aurora()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        sql = """SELECT fk.conrelid as fkey_table_id, fk.confrelid as rkey_table_id, fk.oid AS fkey_constid,fk.conname as fk_name, ns.nspname as fkey_table_schema, t.relname as fkey_table_name, ns_f.nspname as rkey_table_schema,t_f.relname as rkey_table_name,
            CASE confdeltype
            WHEN 'c' THEN 1
            ELSE 0
            END AS IsDeleteCascade,
            CASE confupdtype
            WHEN 'c' THEN 1
            ELSE 0
            END AS IsUpdateCascade,
            confupdtype,
            confdeltype,
            fk.conkey as f_cols,confkey as r_cols, 0 as IsDisabled, 0 as IsNotRepl, 0 as IsNotTrusted, 0 as is_system_named
                        FROM pg_catalog.pg_constraint fk 
                            inner join pg_class t on fk.conrelid = t.oid
                            inner join pg_namespace ns on ns.oid = t.relnamespace
                            inner join pg_class t_f on fk.confrelid=t_f.oid
                                inner join pg_namespace ns_f on ns_f.oid = t_f.relnamespace
                        where fk.contype = 'f'"""
        cur.execute(sql)
        results = cur.fetchall()
        
        return pd.DataFrame(results)
        
    except Exception as e:
        print(f"Error: {e}")
        
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

def _process_fk_cols_pg(tbl_cols, tbl_fks) -> pd.DataFrame:
    tbl_cols = pd.DataFrame(tbl_cols) if not isinstance(tbl_cols, pd.DataFrame) else tbl_cols
    tbl_fks = pd.DataFrame(tbl_fks) if not isinstance(tbl_fks, pd.DataFrame) else tbl_fks

    # Create empty output DataFrame with correct schema
    output = pd.DataFrame(columns=[
        'fkey_table_id', 'fkey_constid', 'fk_name', 'keyno',
        'fkey_table_schema', 'fkey_table_name',
        'rkey_table_schema', 'rkey_table_name',
        'fkey_col_name', 'rkey_col_name'
    ]).astype({
        'fkey_table_id': 'string',
        'fkey_constid': 'string',
        'fk_name': 'string',
        'keyno': 'int32',
        'fkey_table_schema': 'string',
        'fkey_table_name': 'string',
        'rkey_table_schema': 'string',
        'rkey_table_name': 'string',
        'fkey_col_name': 'string',
        'rkey_col_name': 'string'
    })
    
    if tbl_fks.empty:
        return output

    # Ensure column_id is int64
    tbl_cols['column_id'] = pd.to_numeric(tbl_cols['column_id'], errors='coerce').astype('int64')
    
    # Convert f_cols and r_cols to lists of integers
    tbl_fks['f_cols'] = tbl_fks['f_cols'].apply(utils.parse_pg_array)
    tbl_fks['r_cols'] = tbl_fks['r_cols'].apply(utils.parse_pg_array)
    
    # Create rows list to store results
    rows = []
    
    # Process each FK row
    for _, fk_row in tbl_fks.iterrows():
        f_cols = fk_row['f_cols']  # foreign key columns (now list of integers)
        r_cols = fk_row['r_cols']  # referenced columns (now list of integers)
        
        # Process each pair of columns
        for idx, (f_col_id, r_col_id) in enumerate(zip(f_cols, r_cols)):
            # Get foreign key column info
            f_mask = (
                (tbl_cols['table_schema'] == str(fk_row['fkey_table_schema'])) &
                (tbl_cols['table_name'] == str(fk_row['fkey_table_name'])) &
                (tbl_cols['column_id'] == f_col_id)  # Now comparing integers
            )
            
            # Handle potential missing matches
            f_col_match = tbl_cols[f_mask]
            if f_col_match.empty:
                print(f"Warning: No match found for foreign key column {f_col_id} in table {fk_row['fkey_table_schema']}.{fk_row['fkey_table_name']}")
                continue
            f_col = f_col_match.iloc[0]
            
            # Get referenced column info
            r_mask = (
                (tbl_cols['table_schema'] == str(fk_row['rkey_table_schema'])) &
                (tbl_cols['table_name'] == str(fk_row['rkey_table_name'])) &
                (tbl_cols['column_id'] == r_col_id)  # Now comparing integers
            )
            
            # Handle potential missing matches
            r_col_match = tbl_cols[r_mask]
            if r_col_match.empty:
                print(f"Warning: No match found for referenced column {r_col_id} in table {fk_row['rkey_table_schema']}.{fk_row['rkey_table_name']}")
                continue
            r_col = r_col_match.iloc[0]
            
            # Construct fkey_table_id and fkey_constid if they're not present
            fkey_table_id = fk_row.get('fkey_table_id', f"{fk_row['fkey_table_schema']}.{fk_row['fkey_table_name']}")
            fkey_constid = fk_row.get('fkey_constid', str(idx))
            
            # Create new row
            new_row = {
                'fkey_table_id': fkey_table_id,
                'fkey_constid': fkey_constid,
                'fk_name': fk_row['fk_name'],
                'keyno': idx,
                'fkey_table_schema': fk_row['fkey_table_schema'],
                'fkey_table_name': fk_row['fkey_table_name'],
                'rkey_table_schema': fk_row['rkey_table_schema'],
                'rkey_table_name': fk_row['rkey_table_name'],
                'fkey_col_name': f_col['col_name'],
                'rkey_col_name': r_col['col_name']
            }
            rows.append(new_row)
    
    # Convert rows to DataFrame
    if rows:
        output = pd.DataFrame(rows)
    
    return output

#def load_tables_defaults():
     #!implement (did not have it in .net... does PG needs it? where are its defaults? we didn't query already at this point?)



def load_all_db_ents() -> pd.DataFrame:
    conn = None
    cur = None
    try:
        conn = Database.connect_to_aurora()
        
        # First, fetch the database entities
        cur = conn.cursor(cursor_factory=RealDictCursor)
        entities_sql = """SELECT CAST(1 as bit) AS ScriptSchema, CAST(0 as bit) as ScriptData, CAST(0 as bit) as ScriptSortOrder, table_schema || '.' || table_name AS EntKey,
                    table_schema as EntSchema, table_name as EntName, 'U' as EntBaseType, 'Table' AS EntType , NULL as EntParamList
                FROM information_schema.tables
                where table_schema not in ('information_schema', 'pg_catalog') and TABLE_TYPE<>'VIEW'
                UNION
                select CAST(1 as bit) AS ScriptSchema, CAST(0 as bit) as ScriptData, CAST(0 as bit) as ScriptSortOrder, table_schema || '.' || table_name AS EntKey,table_schema as EntSchema, table_name as EntName, 'V' as EntBaseType, 'View' as EntType, NULL as EntParamList
                from information_schema.views
                where table_schema not in ('information_schema', 'pg_catalog')
                UNION 
                select CAST(1 as bit) AS ScriptSchema, CAST(0 as bit) as ScriptData, CAST(0 as bit) as ScriptSortOrder, n.nspname || '.' || p.proname  AS EntKey, n.nspname as EntSchema,
                    p.proname as EntName,
                    cast(p.prokind as character varying)  as EntBaseType,
                    case p.prokind WHEN 'p' THEN 'Procedure' WHEN 'f' THEN 'Function' END as EntType,
                    pg_get_function_arguments(p.oid) as EntParamList 
                FROM pg_proc p
                left join pg_namespace n on p.pronamespace = n.oid
                left join pg_language l on p.prolang = l.oid
                left join pg_type t on t.oid = p.prorettype 
                where n.nspname not in ('pg_catalog', 'information_schema')
                UNION 
                Select CAST(1 as bit) AS ScriptSchema, CAST(0 as bit) as ScriptData, CAST(0 as bit) as ScriptSortOrder, trigger_schema || '.' || trigger_name AS EntKey, trigger_schema As EntSchema,
                                        trigger_name As EntName,
                                        'TR' as EntBaseType,
                                        'Trigger' as EntType,                                         
                                        NULL as EntParamList
                FROM information_schema.triggers
                Group By 1, 2, 3, 4,5, 6,7"""
        cur.execute(entities_sql)
        entities_results = cur.fetchall()
        tbl_ents = pd.DataFrame(entities_results)
        
        # Now, fetch the foreign key dependencies
        fk_sql = """SELECT ns.nspname as child_schema, t.relname as child_table, ns_f.nspname as parent_schema,t_f.relname as parent_table 
        FROM pg_catalog.pg_constraint fk 
            inner join pg_class t on fk.conrelid = t.oid
            inner join pg_namespace ns on ns.oid = t.relnamespace
            inner join pg_class t_f on fk.confrelid=t_f.oid
            inner join pg_namespace ns_f on ns_f.oid = t_f.relnamespace
        where fk.contype = 'f';
        """
        cur.execute(fk_sql)
        fk_results = cur.fetchall()
        
        # Create a directed graph for dependencies
        G = nx.DiGraph()
        
        # Add all tables as nodes
        tables_df = tbl_ents[tbl_ents['enttype'] == 'Table']
        for _, row in tables_df.iterrows():
            schema = row['entschema']
            table = row['entname']
            G.add_node(f"{schema}.{table}")  # Add qualified name as node
        
        # Add edges for dependencies (from child to parent)
        for fk in fk_results:
            child_node = f"{fk['child_schema']}.{fk['child_table']}"
            parent_node = f"{fk['parent_schema']}.{fk['parent_table']}"
            
            if child_node in G.nodes() and parent_node in G.nodes():
                G.add_edge(child_node, parent_node)  # Child depends on parent
        
        # If there are nodes in the graph, perform topological sort
        if G.nodes():
            try:
                # Get sorted list and create mapping
                sorted_tables = list(nx.topological_sort(G))
                sort_order = {table: i+1 for i, table in enumerate(reversed(sorted_tables))}
                
                # Create a mapping from EntKey to sort order
                tbl_ents['scriptsortorder'] = tbl_ents['entkey'].map(sort_order)
                
                # For entities without a sort order, use a higher number
                max_order = len(sort_order) + 1 if sort_order else 1
                tbl_ents['scriptsortorder'] = tbl_ents['scriptsortorder'].fillna(max_order)
            except nx.NetworkXUnfeasible:
                # If there's a cycle, just use a default order
                print("Warning: Cycle detected in foreign key dependencies.")
                tbl_ents['scriptsortorder'] = tbl_ents.apply(
                    lambda row: 1 if row["enttype"] == "Table" else 2, 
                    axis=1
                )
        else:
            # If no dependencies were found, assign a default order
            tbl_ents['scriptsortorder'] = tbl_ents.apply(
                lambda row: 1 if row["enttype"] == "Table" else 2, 
                axis=1
            )
        
        return tbl_ents
        
    except Exception as e:
        print(f"Error in load_all_db_ents: {e}")
        # Return empty DataFrame or partial result
        return pd.DataFrame() if 'tbl_ents' not in locals() else tbl_ents
        
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()