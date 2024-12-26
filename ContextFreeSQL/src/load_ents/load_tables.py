def load_tables():
    sql_get_tables = """SELECT  table_schema || '.' || table_name as object_id, table_name as EntName, 'U' as type,  null as crdate, table_schema as EntSchema, table_schema, table_name,
            null as schema_ver, 
            NULL as ident_seed, 
            NULL as ident_incr, Now() as db_now, null as table_sql  
            FROM information_schema.TABLES E where TABLE_TYPE LIKE '%TABLE%'
            and TABLE_SCHEMA not in ('information_schema', 'pg_catalog')"""
    data = db.execute(sql_get_tables)