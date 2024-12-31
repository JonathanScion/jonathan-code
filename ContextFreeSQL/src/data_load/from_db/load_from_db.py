import os
from infra.database import Database
from psycopg2.extras import RealDictCursor #!see if we need this


def load_tables():   
    conn = None
    cur = None
    try:
        conn = Database.connect_to_aurora()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute(f"SELECT * FROM {os.getenv('DB_SCHEMA')}.family")
        results = cur.fetchall()
        
        return results
        
    except Exception as e:
        print(f"Error: {e}")
        
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

