import os
from pydantic import BaseModel
from src.infra.database import Database
from src.defs.script_defs import ConfigVals, DBConnSettings
from psycopg2.extras import RealDictCursor #!see if we need this
import pandas as pd
import numpy as np
from src.utils import funcs as utils
from typing import Optional, Dict, List
from pydantic import Field
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
    tables_data: Dict[str, pd.DataFrame] = Field(default_factory=dict)
    coded_ents: pd.DataFrame
    # Security-related DataFrames
    roles: pd.DataFrame = Field(default_factory=pd.DataFrame)
    role_memberships: pd.DataFrame = Field(default_factory=pd.DataFrame)
    schema_permissions: pd.DataFrame = Field(default_factory=pd.DataFrame)
    table_permissions: pd.DataFrame = Field(default_factory=pd.DataFrame)
    column_permissions: pd.DataFrame = Field(default_factory=pd.DataFrame)
    function_permissions: pd.DataFrame = Field(default_factory=pd.DataFrame)
    default_privileges: pd.DataFrame = Field(default_factory=pd.DataFrame)
    rls_policies: pd.DataFrame = Field(default_factory=pd.DataFrame)


    class Config:
        arbitrary_types_allowed = True  # Needed for pd.DataFrame


def load_all_schema(conn_settings: DBConnSettings, load_security: bool = True) -> DBSchema:

    schemas = _load_schemas(conn_settings)
    tables = _load_tables(conn_settings)
    columns = _load_tables_columns(conn_settings)
    defaults = _load_tables_columns_defaults(conn_settings)
    indexes = _load_tables_indexes(conn_settings)
    index_cols = _process_index_cols_pg(columns, indexes)
    fks = _load_tables_foreign_keys(conn_settings)
    fk_cols = _process_fk_cols_pg(columns, fks)
    coded_ents = _load_coded_ents(conn_settings)
    #defaults = #in MSSQL there was a separate query for defaults. in PG, seems to me that loading columns has defaults in it. so verify, and then if i implement MSSQL, see if need separate query or can go by PG format.
    #MSSQL was: SELECT SCHEMA_NAME(o.schema_id) AS table_schema, OBJECT_NAME(o.object_id) AS table_name, d.name as default_name, d.definition as default_definition, c.name as col_name FROM sys.default_constraints d INNER JOIN sys.objects o ON d.parent_object_id=o.object_id INNER jOIN sys.columns c on d.parent_object_id=c.object_id AND d.parent_column_id = c.column_id

    # Load security if enabled
    if load_security:
        roles = _load_roles(conn_settings)
        role_memberships = _load_role_memberships(conn_settings)
        schema_permissions = _load_schema_permissions(conn_settings)
        table_permissions = _load_table_permissions(conn_settings)
        column_permissions = _load_column_permissions(conn_settings)
        function_permissions = _load_function_permissions(conn_settings)
        default_privileges = _load_default_privileges(conn_settings)
        rls_policies = _load_rls_policies(conn_settings)
    else:
        roles = pd.DataFrame()
        role_memberships = pd.DataFrame()
        schema_permissions = pd.DataFrame()
        table_permissions = pd.DataFrame()
        column_permissions = pd.DataFrame()
        function_permissions = pd.DataFrame()
        default_privileges = pd.DataFrame()
        rls_policies = pd.DataFrame()

    return DBSchema(
        schemas = schemas,
        tables = tables,
        columns = columns,
        defaults = defaults,
        indexes = indexes,
        index_cols = index_cols,
        fks = fks,
        fk_cols = fk_cols,
        coded_ents = coded_ents,
        roles = roles,
        role_memberships = role_memberships,
        schema_permissions = schema_permissions,
        table_permissions = table_permissions,
        column_permissions = column_permissions,
        function_permissions = function_permissions,
        default_privileges = default_privileges,
        rls_policies = rls_policies
    )

def _load_schemas(conn_settings: DBConnSettings) -> pd.DataFrame:
    conn = None
    cur = None
    try:
        conn = Database.connect_to_database(conn_settings)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        sql =  """select schema_name, schema_owner as principal_name from information_schema.schemata 
                    WHERE schema_name NOT IN ('pg_catalog','information_schema', 'pg_toast') and schema_name NOT LIKE 'pg_temp%' and schema_name NOT LIKE 'pg_toast%'"""
        cur.execute(sql)
         
        results = cur.fetchall()
        
        return pd.DataFrame(results)
        
    except Exception as e:
        print(f"Error: {e}")
        return pd.DataFrame()  # Return empty DataFrame on error
        
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


def _load_tables(conn_settings: DBConnSettings) -> pd.DataFrame:   
    conn = None
    cur = None
    try:
        conn = Database.connect_to_database(conn_settings)
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
        return pd.DataFrame()  # Return empty DataFrame on error
        
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

def _load_tables_columns(conn_settings: DBConnSettings) -> pd.DataFrame:
    conn = None
    cur = None
    try:
        conn = Database.connect_to_database(conn_settings)
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
        return pd.DataFrame()  # Return empty DataFrame on error
        
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

def _load_tables_columns_defaults(conn_settings: DBConnSettings) -> pd.DataFrame:
    conn = None
    cur = None
    try:
        conn = Database.connect_to_database(conn_settings)
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
        return pd.DataFrame()  # Return empty DataFrame on error
        
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

def _load_tables_indexes(conn_settings: DBConnSettings) -> pd.DataFrame:
    conn = None
    cur = None
    try:
        conn = Database.connect_to_database(conn_settings)
        cur = conn.cursor(cursor_factory=RealDictCursor)
  
        #small note: i had below '0 as index_id' but it made no sense when its time to select the index
        sql= """SELECT
                scm.nspname  || '.' || t.relname as object_id, /*t.oid as object_id,*/ i.oid as index_oid,
                scm.nspname As table_schema,
                t.relname as table_name,
                i.relname as index_name, i.relname as name,
                ix.indisunique as is_unique,
                indisclustered as is_clustered,
                i.oid as index_id, 0 as type,--not implementing for PG right now, as MSSQL indexes are so different
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
        return pd.DataFrame()  # Return empty DataFrame on error

        
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

def _load_tables_foreign_keys(conn_settings: DBConnSettings) -> pd.DataFrame:
    conn = None
    cur = None
    try:
        conn = Database.connect_to_database(conn_settings)
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
        return pd.DataFrame()  # Return empty DataFrame on error
        
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

def _load_coded_ents(conn_settings: DBConnSettings) -> pd.DataFrame:
    conn = None
    cur = None
    try:
        conn = Database.connect_to_database(conn_settings)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        #had this code here that claude converted, essentially to select only coded ents taht are in tbl_ents. but i dont pass tbl_ents as param and all other load funcs in this module load the whole thing
        #so for now, i just load the whole thing
        """coded_script_rows = schema_entities[
            (schema_entities['ScriptSchema'] == True) & 
            (schema_entities['EntType'] != 'Table')
        ]

        coded_schema_name_in = []
        for _, row in coded_script_rows.iterrows():
            # Add schema.name with quotes for SQL IN clause
            coded_schema_name_in.append(f"'{row['EntSchema']}.{row['EntName']}'")

        # Join the names with commas to create a complete IN clause string
        coded_schema_name_in_str = ','.join(coded_schema_name_in)

        if coded_schema_name_in:"""
        #real code returns here:
        sql = f"""
        Select table_schema || '.' || table_name AS EntKey, table_schema as code_schema, table_name as code_name, 
                'V' as EntType, 'View' as enttype_pg, 
                'CREATE OR REPLACE VIEW ' || table_schema || '.' || table_name || E'\\nAS\\n' || view_definition AS definition, 
                NULL as param_type_list 
        From information_schema.views
        Where table_schema Not In ('information_schema', 'pg_catalog')
        UNION
        Select n.nspname || '.' || p.proname  AS EntKey, n.nspname as code_schema,
            p.proname as code_name,    
            CAST(p.prokind AS char)  AS EntType,
            CASE 
                WHEN p.prokind ='p' THEN 'Procedure'
                ELSE 'Function'
            END enttype_pg,
            case when l.lanname = 'internal' then p.prosrc
                else pg_get_functiondef(p.oid)
                end as definition,
            pg_get_function_arguments(p.oid) as param_type_list 
        From pg_proc p
        Left Join pg_namespace n on p.pronamespace = n.oid
        Left Join pg_language l on p.prolang = l.oid
        Left Join pg_type t on t.oid = p.prorettype 
        where n.nspname Not in ('pg_catalog', 'information_schema')            
        UNION
        Select trigger_schema || '.' || trigger_name AS EntKey, trigger_schema As code_schema,
            trigger_name As code_name,
            'TR' as EntType, 'Trigger' as enttype_pg, action_statement As definition, NULL as param_type_list 
        From information_schema.triggers
        Group By 1, 2, 3, 4, 5, 6
        """
        #AND ( (n.nspname || '.' || p.proname) IN ({','.join(coded_schema_name_in)}) ) NOTE: reactivate this if you wnat specific loading. right above the last UNION
        # In implementation, this would be queried using an appropriate DB adapter
        cur.execute(sql)
        results = cur.fetchall()
        
        return pd.DataFrame(results)
    
    except Exception as e:
        print(f"Error: {e}")
        return pd.DataFrame()  # Return empty DataFrame on error
        
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

    
def load_all_db_ents(conn_settings: DBConnSettings, entity_filter: Optional[List[str]] = None) -> pd.DataFrame:
    conn = None
    cur = None
    try:
        conn = Database.connect_to_database(conn_settings)
        
        # First, fetch the database entities
        cur = conn.cursor(cursor_factory=RealDictCursor)
        entities_sql = """SELECT CAST(1 as boolean) AS ScriptSchema, CAST(0 as boolean) as ScriptData, CAST(0 as bit) as ScriptSortOrder, table_schema || '.' || table_name AS EntKey,
                    table_schema as EntSchema, table_name as EntName, 'U' as EntBaseType, 'Table' AS EntType , NULL as EntParamList
                FROM information_schema.tables
                where table_schema not in ('information_schema', 'pg_catalog') and TABLE_TYPE<>'VIEW'
                UNION
                select CAST(1 as boolean) AS ScriptSchema, CAST(0 as boolean) as ScriptData, CAST(0 as bit) as ScriptSortOrder, table_schema || '.' || table_name AS EntKey,table_schema as EntSchema, table_name as EntName, 'V' as EntBaseType, 'View' as EntType, NULL as EntParamList
                from information_schema.views
                where table_schema not in ('information_schema', 'pg_catalog')
                UNION 
                select CAST(1 as boolean) AS ScriptSchema, CAST(0 as boolean) as ScriptData, CAST(0 as bit) as ScriptSortOrder, n.nspname || '.' || p.proname  AS EntKey, n.nspname as EntSchema,
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
                Select CAST(1 as boolean) AS ScriptSchema, CAST(0 as boolean) as ScriptData, CAST(0 as bit) as ScriptSortOrder, trigger_schema || '.' || trigger_name AS EntKey, trigger_schema As EntSchema,
                                        trigger_name As EntName,
                                        'TR' as EntBaseType,
                                        'Trigger' as EntType,                                         
                                        NULL as EntParamList
                FROM information_schema.triggers
                Group By 1, 2, 3, 4,5, 6,7"""
        cur.execute(entities_sql)
        entities_results = cur.fetchall()
        tbl_ents = pd.DataFrame(entities_results)
        
        # Apply filter if provided
        if entity_filter:
            tbl_ents = tbl_ents[tbl_ents['entkey'].isin(entity_filter)]
        
        # Rest of the function remains the same...
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


def load_all_tables_data(conn_settings: DBConnSettings,db_all: DBSchema, table_names: List[str]) -> None:    
    conn = None
    cur = None
    try:
        conn = Database.connect_to_database(conn_settings)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        for table_name in table_names:
            # Handle table names with or without schema
            if '.' in table_name:
                schema_name, table_only = table_name.split('.')
                query = f'SELECT * FROM {schema_name}.{table_only}'
            else:
                # Default to public schema if not specified
                query = f'SELECT * FROM {table_name}'
            
            try:
                print(f"Loading data for table: {table_name}")
                cur.execute(query)
                results = cur.fetchall()
                
                # Create DataFrame from results
                df = pd.DataFrame(results)
                
                # Store in the DBSchema object
                db_all.tables_data[table_name] = df
                
                print(f"Loaded {len(df)} rows for table: {table_name}")
            except Exception as table_error:
                print(f"Error loading table {table_name}: {table_error}")
                # Continue with other tables even if one fails
                continue

    except Exception as e:
        print(f"Database connection error: {e}")

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


# ============================================
# SECURITY LOADING FUNCTIONS
# ============================================

def _load_roles(conn_settings: DBConnSettings) -> pd.DataFrame:
    """Load all database roles (users and groups) from pg_authid.
    Note: Requires superuser to read password hashes from pg_authid.
    Falls back to pg_roles if not superuser (without passwords).
    """
    conn = None
    cur = None
    try:
        conn = Database.connect_to_database(conn_settings)
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # Try pg_authid first (requires superuser for password hashes)
        # If that fails, fall back to pg_roles (no passwords)
        try:
            sql = """SELECT
                        rolname,
                        rolsuper,
                        rolinherit,
                        rolcreaterole,
                        rolcreatedb,
                        rolcanlogin,
                        rolreplication,
                        rolconnlimit,
                        rolpassword,
                        rolvaliduntil,
                        rolbypassrls
                    FROM pg_authid
                    WHERE rolname NOT LIKE 'pg_%'
                      AND rolname NOT IN ('postgres')
                    ORDER BY rolname"""
            cur.execute(sql)
        except Exception:
            # Fall back to pg_roles (accessible to all, but no password hashes)
            sql = """SELECT
                        rolname,
                        rolsuper,
                        rolinherit,
                        rolcreaterole,
                        rolcreatedb,
                        rolcanlogin,
                        rolreplication,
                        rolconnlimit,
                        NULL as rolpassword,
                        rolvaliduntil,
                        rolbypassrls
                    FROM pg_roles
                    WHERE rolname NOT LIKE 'pg_%'
                      AND rolname NOT IN ('postgres')
                    ORDER BY rolname"""
            cur.execute(sql)

        results = cur.fetchall()
        return pd.DataFrame(results)

    except Exception as e:
        print(f"Error loading roles: {e}")
        return pd.DataFrame()

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


def _load_role_memberships(conn_settings: DBConnSettings) -> pd.DataFrame:
    """Load role memberships (GRANT role TO role)."""
    conn = None
    cur = None
    try:
        conn = Database.connect_to_database(conn_settings)
        cur = conn.cursor(cursor_factory=RealDictCursor)

        sql = """SELECT
                    r.rolname as role_name,
                    m.rolname as member_name,
                    am.admin_option,
                    g.rolname as grantor_name
                FROM pg_auth_members am
                JOIN pg_roles r ON am.roleid = r.oid
                JOIN pg_roles m ON am.member = m.oid
                LEFT JOIN pg_roles g ON am.grantor = g.oid
                WHERE r.rolname NOT LIKE 'pg_%'
                  AND m.rolname NOT LIKE 'pg_%'
                ORDER BY r.rolname, m.rolname"""
        cur.execute(sql)
        results = cur.fetchall()
        return pd.DataFrame(results)

    except Exception as e:
        print(f"Error loading role memberships: {e}")
        return pd.DataFrame()

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


def _load_schema_permissions(conn_settings: DBConnSettings) -> pd.DataFrame:
    """Load schema-level permissions (USAGE, CREATE on schemas)."""
    conn = None
    cur = None
    try:
        conn = Database.connect_to_database(conn_settings)
        cur = conn.cursor(cursor_factory=RealDictCursor)

        sql = """SELECT
                    grantor,
                    grantee,
                    object_schema as schema_name,
                    privilege_type,
                    is_grantable
                FROM information_schema.usage_privileges
                WHERE object_type = 'SCHEMA'
                  AND grantee NOT IN ('PUBLIC', 'postgres')
                  AND grantee NOT LIKE 'pg_%'
                  AND object_schema NOT IN ('pg_catalog', 'information_schema')
                  AND object_schema NOT LIKE 'pg_temp%'
                  AND object_schema NOT LIKE 'pg_toast%'
                ORDER BY object_schema, grantee, privilege_type"""
        cur.execute(sql)
        results = cur.fetchall()
        return pd.DataFrame(results)

    except Exception as e:
        print(f"Error loading schema permissions: {e}")
        return pd.DataFrame()

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


def _load_table_permissions(conn_settings: DBConnSettings) -> pd.DataFrame:
    """Load table-level permissions (SELECT, INSERT, UPDATE, DELETE, etc.)."""
    conn = None
    cur = None
    try:
        conn = Database.connect_to_database(conn_settings)
        cur = conn.cursor(cursor_factory=RealDictCursor)

        sql = """SELECT
                    grantor,
                    grantee,
                    table_schema,
                    table_name,
                    privilege_type,
                    is_grantable,
                    with_hierarchy
                FROM information_schema.table_privileges
                WHERE grantee NOT IN ('PUBLIC', 'postgres')
                  AND grantee NOT LIKE 'pg_%'
                  AND table_schema NOT IN ('pg_catalog', 'information_schema')
                  AND table_schema NOT LIKE 'pg_temp%'
                  AND table_schema NOT LIKE 'pg_toast%'
                ORDER BY table_schema, table_name, grantee, privilege_type"""
        cur.execute(sql)
        results = cur.fetchall()
        return pd.DataFrame(results)

    except Exception as e:
        print(f"Error loading table permissions: {e}")
        return pd.DataFrame()

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


def _load_column_permissions(conn_settings: DBConnSettings) -> pd.DataFrame:
    """Load column-level permissions."""
    conn = None
    cur = None
    try:
        conn = Database.connect_to_database(conn_settings)
        cur = conn.cursor(cursor_factory=RealDictCursor)

        sql = """SELECT
                    cp.grantor,
                    cp.grantee,
                    cp.table_schema,
                    cp.table_name,
                    cp.column_name,
                    cp.privilege_type,
                    cp.is_grantable
                FROM information_schema.column_privileges cp
                WHERE cp.grantee NOT IN ('PUBLIC', 'postgres')
                  AND cp.grantee NOT LIKE 'pg_%'
                  AND cp.table_schema NOT IN ('pg_catalog', 'information_schema')
                  AND cp.table_schema NOT LIKE 'pg_temp%'
                  AND cp.table_schema NOT LIKE 'pg_toast%'
                  -- Exclude column permissions that are already covered by table-level permissions
                  AND NOT EXISTS (
                      SELECT 1 FROM information_schema.table_privileges tp
                      WHERE tp.grantee = cp.grantee
                        AND tp.table_schema = cp.table_schema
                        AND tp.table_name = cp.table_name
                        AND tp.privilege_type = cp.privilege_type
                  )
                ORDER BY cp.table_schema, cp.table_name, cp.column_name, cp.grantee, cp.privilege_type"""
        cur.execute(sql)
        results = cur.fetchall()
        return pd.DataFrame(results)

    except Exception as e:
        print(f"Error loading column permissions: {e}")
        return pd.DataFrame()

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


def _load_function_permissions(conn_settings: DBConnSettings) -> pd.DataFrame:
    """Load function/procedure permissions (EXECUTE)."""
    conn = None
    cur = None
    try:
        conn = Database.connect_to_database(conn_settings)
        cur = conn.cursor(cursor_factory=RealDictCursor)

        sql = """SELECT
                    grantor,
                    grantee,
                    specific_schema,
                    specific_name,
                    routine_schema,
                    routine_name,
                    privilege_type,
                    is_grantable
                FROM information_schema.routine_privileges
                WHERE grantee NOT IN ('PUBLIC', 'postgres')
                  AND grantee NOT LIKE 'pg_%'
                  AND specific_schema NOT IN ('pg_catalog', 'information_schema')
                ORDER BY routine_schema, routine_name, grantee, privilege_type"""
        cur.execute(sql)
        results = cur.fetchall()
        return pd.DataFrame(results)

    except Exception as e:
        print(f"Error loading function permissions: {e}")
        return pd.DataFrame()

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


def _load_default_privileges(conn_settings: DBConnSettings) -> pd.DataFrame:
    """Load default privileges (ALTER DEFAULT PRIVILEGES)."""
    conn = None
    cur = None
    try:
        conn = Database.connect_to_database(conn_settings)
        cur = conn.cursor(cursor_factory=RealDictCursor)

        sql = """SELECT
                    pg_get_userbyid(d.defaclrole) as role_name,
                    CASE WHEN d.defaclnamespace = 0 THEN NULL
                         ELSE n.nspname
                    END as schema_name,
                    d.defaclobjtype as object_type,
                    pg_catalog.array_to_string(d.defaclacl, ',') as acl_string
                FROM pg_default_acl d
                LEFT JOIN pg_namespace n ON d.defaclnamespace = n.oid
                WHERE pg_get_userbyid(d.defaclrole) NOT LIKE 'pg_%'
                  AND pg_get_userbyid(d.defaclrole) NOT IN ('postgres')
                ORDER BY role_name, schema_name, object_type"""
        cur.execute(sql)
        results = cur.fetchall()
        return pd.DataFrame(results)

    except Exception as e:
        print(f"Error loading default privileges: {e}")
        return pd.DataFrame()

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


def _load_rls_policies(conn_settings: DBConnSettings) -> pd.DataFrame:
    """Load Row Level Security (RLS) policies."""
    conn = None
    cur = None
    try:
        conn = Database.connect_to_database(conn_settings)
        cur = conn.cursor(cursor_factory=RealDictCursor)

        sql = """SELECT
                    schemaname as table_schema,
                    tablename as table_name,
                    policyname as policy_name,
                    permissive,
                    roles,
                    cmd as command,
                    qual as using_expression,
                    with_check as with_check_expression
                FROM pg_policies
                WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
                  AND schemaname NOT LIKE 'pg_temp%'
                  AND schemaname NOT LIKE 'pg_toast%'
                ORDER BY schemaname, tablename, policyname"""
        cur.execute(sql)
        results = cur.fetchall()
        return pd.DataFrame(results)

    except Exception as e:
        print(f"Error loading RLS policies: {e}")
        return pd.DataFrame()

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()
