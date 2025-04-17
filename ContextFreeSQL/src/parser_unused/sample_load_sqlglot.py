import sqlparse
import re
from sqlglot import parse, parse_one, transpile, exp

def extract_column_info_regex(create_table_sql):
    """Extract column information using regex for cases where SQLGlot fails"""
    # Extract the part between parentheses
    table_name_match = re.search(r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)', create_table_sql, re.IGNORECASE)
    table_name = table_name_match.group(1) if table_name_match else "Unknown"
    
    print(f"Table name: {table_name}")
    
    # Extract column definitions
    column_section_match = re.search(r'\(\s*(.*?)\s*\)(?:\s*TABLESPACE|$)', create_table_sql, re.DOTALL)
    if not column_section_match:
        print("Could not extract column definitions")
        return
    
    column_section = column_section_match.group(1)
    
    # Split by commas, but be careful of commas inside parentheses (for type parameters)
    column_defs = []
    current_def = ""
    paren_level = 0
    
    for char in column_section:
        if char == '(':
            paren_level += 1
            current_def += char
        elif char == ')':
            paren_level -= 1
            current_def += char
        elif char == ',' and paren_level == 0:
            column_defs.append(current_def.strip())
            current_def = ""
        else:
            current_def += char
    
    if current_def.strip():
        column_defs.append(current_def.strip())
    
    # Process each column definition
    for col_def in column_defs:
        # Skip if this is a constraint, not a column definition
        if col_def.upper().startswith('CONSTRAINT'):
            print(f"\nConstraint: {col_def}")
            continue
        
        # Extract column name (should be the first word)
        name_match = re.match(r'(\w+)\s+', col_def)
        if not name_match:
            print(f"Could not extract column name from: {col_def}")
            continue
        
        col_name = name_match.group(1)
        
        # Extract data type
        type_match = re.search(r'\s+(\w+(?:\s+\w+)*(?:\(\d+\))?)', col_def)
        col_type = type_match.group(1) if type_match else "Unknown"
        
        # Check for NOT NULL constraint
        is_not_null = "NOT NULL" if "NOT NULL" in col_def.upper() else "NULL"
        
        # Check for DEFAULT value
        default_match = re.search(r'DEFAULT\s+([^,)]+)', col_def, re.IGNORECASE)
        default_value = default_match.group(1) if default_match else None
        
        print(f"\nColumn: {col_name}")
        print(f"  Type: {col_type}")
        print(f"  Nullable: {is_not_null}")
        if default_value:
            print(f"  Default: {default_value}")

def process_sql_file(file_path):
    with open(file_path, 'r') as sql_file:
        sql_content = sql_file.read()

    # First use sqlparse to split statements
    sql_statements = sqlparse.split(sql_content)
    
    for sql_statement in sql_statements:
        if not sql_statement.strip():
            continue
        
        # Format statement for better readability in output
        formatted_stmt = sqlparse.format(sql_statement, reindent=True, keyword_case='upper')
        
        # Determine statement type using sqlparse
        stmt_type = None
        try:
            parsed = sqlparse.parse(sql_statement)
            if parsed and len(parsed) > 0:
                stmt_type = parsed[0].get_type()
        except:
            stmt_type = "Unknown"
        
        print("\n" + "="*50)
        print(f"Statement Type (sqlparse): {stmt_type}")
        
        # Try sqlglot first
        try:
            parsed_statement = parse_one(sql_statement, read='postgres')
            
            if isinstance(parsed_statement, exp.Create) and hasattr(parsed_statement.this, 'key') and parsed_statement.this.key == 'table':
                print(f"SQLGlot successfully parsed CREATE TABLE")
                
                table_name = parsed_statement.this.name if hasattr(parsed_statement.this, 'name') else "Unknown"
                print(f"Table name: {table_name}")
                
                if hasattr(parsed_statement.this, 'expressions'):
                    for column_def in parsed_statement.this.expressions:
                        if isinstance(column_def, exp.Column):
                            name = column_def.this.name if hasattr(column_def.this, 'name') else "Unknown"
                            kind = column_def.args.get("kind")
                            nullable = "NOT NULL" if column_def.args.get("nullable") is False else "NULL"
                            default = column_def.args.get("default")
                            
                            print(f"\nColumn: {name}")
                            print(f"  Type: {kind}")
                            print(f"  Nullable: {nullable}")
                            if default:
                                print(f"  Default: {default}")
            else:
                print(f"Statement type recognized by SQLGlot: {parsed_statement.key}")
                
        except Exception as e:
            print(f"SQLGlot parsing failed: {str(e)}")
            
            # Fallback to regex-based parsing for CREATE TABLE statements
            if stmt_type == 'CREATE' and 'CREATE TABLE' in sql_statement.upper():
                print("Falling back to regex-based parsing for CREATE TABLE")
                extract_column_info_regex(sql_statement)
            elif stmt_type == 'CREATE' and 'CREATE INDEX' in sql_statement.upper():
                print("This is a CREATE INDEX statement")
            elif stmt_type == 'ALTER':
                print("This is an ALTER TABLE statement")
            else:
                print(f"Unhandled statement type: {stmt_type}")
                print(f"First 100 chars: {sql_statement[:100]}...")

def main():
    """Main entry point for the application."""
    file_path = 'tests/basic-test.sql'
    process_sql_file(file_path)

if __name__ == "__main__":
    main()