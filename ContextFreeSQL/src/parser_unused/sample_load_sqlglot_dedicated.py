import sqlparse
import sqlglot
from sqlglot import parse, parse_one, transpile, exp
from sqlglot.dialects.postgres import PostgresParser, PostgresGenerator, Postgres

def process_sql_file_postgres(file_path):
    with open(file_path, 'r') as sql_file:
        sql_content = sql_file.read()

    # First use sqlparse to split statements
    sql_statements = sqlparse.split(sql_content)
    
    for sql_statement in sql_statements:
        if not sql_statement.strip():
            continue
            
        print("\n" + "="*50)
        print(f"Statement: {sql_statement[:100]}..." if len(sql_statement) > 100 else sql_statement)
        
        # Try to parse with the dedicated PostgreSQL parser
        try:
            # Use the specific PostgreSQL dialect parser
            parsed_statement = parse_one(sql_statement, read='postgres')
            
            print(f"Statement type: {parsed_statement.key}")
            
            # Additional debugging information
            print(f"Expression type: {type(parsed_statement).__name__}")
            
            # If it's a Create statement, inspect it more closely
            if isinstance(parsed_statement, exp.Create):
                print("Found Create statement")
                
                # Check what's being created
                if hasattr(parsed_statement, 'this') and parsed_statement.this:
                    print(f"Creating: {parsed_statement.this.key if hasattr(parsed_statement.this, 'key') else parsed_statement.this}")
                    
                    # If it's a table, extract column information
                    if hasattr(parsed_statement.this, 'key') and parsed_statement.this.key == 'table':
                        table_name = parsed_statement.this.name if hasattr(parsed_statement.this, 'name') else "Unknown"
                        print(f"\nTable name: {table_name}")
                        
                        if hasattr(parsed_statement.this, 'expressions'):
                            print("\nColumns:")
                            for column_def in parsed_statement.this.expressions:
                                if isinstance(column_def, exp.Column):
                                    name = column_def.this.name if hasattr(column_def.this, 'name') else "Unknown"
                                    kind = column_def.args.get("kind")
                                    nullable = "NOT NULL" if column_def.args.get("nullable") is False else "NULL"
                                    default = column_def.args.get("default")
                                    
                                    print(f"- {name}: {kind} {nullable}")
                                    if default:
                                        print(f"  Default: {default}")
                    else:
                        print("Not a table creation")
            
            # If it's not recognized as a Create statement but looks like one
            elif 'CREATE TABLE' in sql_statement.upper() and not isinstance(parsed_statement, exp.Create):
                print("Warning: This looks like a CREATE TABLE statement but SQLGlot parsed it as something else")
                
                # Try a different approach - parse via explicit SQL generation first
                try:
                    # Try to use the PostgreSQL dialect explicitly
                    print("\nAttempting more explicit PostgreSQL parsing...")
                    
                    # Print dialect information
                    print(f"Available dialects: {', '.join(sqlglot.dialects.keys())}")
                    
                    # Try a minimal example first
                    test_sql = "CREATE TABLE test (id integer)"
                    test_parsed = parse_one(test_sql, read=Postgres)
                    print(f"Test parse succeeded with type: {test_parsed.key}")
                    
                    # Try with different parsing options
                    parsed_with_options = parse_one(
                        sql_statement, 
                        read=Postgres,
                        error_level=sqlglot.ErrorLevel.IGNORE
                    )
                    print(f"Parse with options: {parsed_with_options.key}")
                    
                except Exception as inner_e:
                    print(f"Alternative parsing also failed: {str(inner_e)}")
                    
        except Exception as e:
            print(f"PostgreSQL parsing failed: {str(e)}")
            print("Falling back to regex-based parsing...")
            
            # Implement your regex-based parsing here (you already have this code)

def main():
    """Main entry point for the application."""
    file_path = 'tests/basic-test.sql'
    process_sql_file_postgres(file_path)

if __name__ == "__main__":
    main()