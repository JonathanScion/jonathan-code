import sqlparse
import sqlglot
from sqlglot import parse, parse_one, transpile, exp


def process_sql_file_sqlglot(file_path, dialect='tsql'):
    with open(file_path, 'r') as sql_file:
        sql_content = sql_file.read()

    # First use sqlparse to split statements
    sql_statements = sqlparse.split(sql_content)
    
    for sql_statement in sql_statements:
        try:
            # Parse each statement individually with sqlglot
            statement = parse_one(sql_statement, read=dialect)
            
            print("\nAnalyzing statement:", statement.sql())
            print("Statement type:", statement.key)
            
            # Find all table references
            tables = statement.find_all(exp.Table)
            print("Tables:", [t.name for t in tables])
            
            # Find all columns
            columns = statement.find_all(exp.Column)
            print("Columns:", [c.name for c in columns])
            
            # Find all conditions (WHERE clause components)
            conditions = statement.find_all(exp.Where)
            for condition in conditions:
                print("Where clause:", condition.sql())
            
            # Find all joins
            joins = statement.find_all(exp.Join)
            for join in joins:
                print("Join:", join.sql())
                
            # Find all functions
            functions = statement.find_all(exp.Anonymous)
            print("Functions:", [f.sql() for f in functions])
            
            # Optional: Convert to a different dialect
            if dialect != 'postgres':
                postgres_sql = statement.sql(dialect='postgres', pretty=True)
                print("\nConverted to PostgreSQL:")
                print(postgres_sql)

        except Exception as e:
            print(f"Error processing statement: {sql_statement}")
            print(f"Error details: {str(e)}")
            # Continue processing other statements instead of raising
            continue

def main():
    """Main entry point for the application."""
    file_path = '../tests/basic-test.sql'
    process_sql_file_sqlglot(file_path)


if __name__ == "__main__":
    main()