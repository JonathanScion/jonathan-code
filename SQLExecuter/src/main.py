import os
import sys
import re
import logging
import argparse
from datetime import datetime
import psycopg2


def setup_logging():
    """Set up logging configuration"""
    log_dir = "logs"
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file = os.path.join(log_dir, f"sql_execution_{timestamp}.log")
    
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s",
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler()
        ]
    )
    return logging.getLogger()

def get_version_number(filename):
    """Extract version number from filename for sorting"""
    # Extract all numbers from the filename
    numbers = re.findall(r'V(\d+\.\d+(?:\.\d+)*)', filename)
    if numbers:
        # Convert version string to tuple of integers for proper sorting
        version_parts = numbers[0].split('.')
        return tuple(map(int, version_parts))
    return (0,)  # Return a default value for files without version numbers

def execute_sql_files(path, connection_string, logger):
    """Execute all SQL files in the given path in version order"""
    # Get all SQL files in the directory
    sql_files = [f for f in os.listdir(path) if f.lower().endswith('.sql')]
    
    # Sort files by version number
    sql_files.sort(key=get_version_number)
    
    logger.info(f"Found {len(sql_files)} SQL files to execute")
    
    try:
        # Connect to the database
        conn = psycopg2.connect(connection_string)
        cursor = conn.cursor()
        logger.info("Connected to database successfully")
        
        for sql_file in sql_files:
            full_path = os.path.join(path, sql_file)
            logger.info(f"Executing {sql_file}...")
            
            try:
                # Read SQL file content
                with open(full_path, 'r') as f:
                    sql_content = f.read()
                
                # Execute SQL
                cursor.execute(sql_content)
                conn.commit()
                logger.info(f"Successfully executed {sql_file}")
                
            except Exception as e:
                logger.error(f"Error executing {sql_file}: {str(e)}")
                conn.rollback()
        
        cursor.close()
        conn.close()
        logger.info("Database connection closed")
        
    except Exception as e:
        logger.error(f"Error connecting to database: {str(e)}")

def main():
    parser = argparse.ArgumentParser(description='Execute SQL files in order against a database')
    parser.add_argument('path', help='Path to directory containing SQL files')
    parser.add_argument('connection_string', help='Database connection string')
    
    args = parser.parse_args()
    
    logger = setup_logging()
    logger.info("Starting SQL execution script")
    
    execute_sql_files(args.path, args.connection_string, logger)
    
    logger.info("SQL execution completed")

if __name__ == "__main__":
    main()