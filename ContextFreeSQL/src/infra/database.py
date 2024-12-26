import psycopg2
from psycopg2.extras import RealDictCursor

class Database:
   def __init__(self, connection_string: str):
       self._conn_str = connection_string
       self._connection = None
       
   def connect_to_aurora():
       conn = psycopg2.connect(
           host="database-2-instance-1.cfmmucqa2fq2.us-east-1.rds.amazonaws.com",
           database="postgres",
           user="postgres",
           password="postgres",
           port="5432"
        )
       return conn

def example_query():   
   conn = None
   cur = None
   try:
       conn = connect_to_aurora()
       cur = conn.cursor(cursor_factory=RealDictCursor)  # Returns dict-like results
       
       cur.execute("SELECT * FROM jon.family")
       results = cur.fetchall()
       
       return results
       
   except Exception as e:
       print(f"Error: {e}")
       
   finally:
       if cur:
           cur.close()
       if conn:
           conn.close()

# Usage
results = example_query()
if results:
    for row in results:
        print(row)