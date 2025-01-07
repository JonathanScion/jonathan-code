import os
import psycopg2
from psycopg2.extras import RealDictCursor


class Database:        
    @staticmethod
    def connect_to_aurora():
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST'),
            database=os.getenv('DB_NAME'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            port=os.getenv('DB_PORT')
        )
        return conn

