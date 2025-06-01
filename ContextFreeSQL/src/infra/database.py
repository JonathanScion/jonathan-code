import os
import psycopg2
from psycopg2.extras import RealDictCursor
from src.defs.script_defs import ConfigVals, DBConnSettings

class Database:        
    @staticmethod
    def connect_to_database(conn_settings: DBConnSettings):
        conn = psycopg2.connect(
            host=conn_settings.host,
            database=conn_settings.db_name,
            user=conn_settings.user,
            password=conn_settings.password,
            port=conn_settings.port
        )
        return conn

