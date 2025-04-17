import re
import sqlparse

def parse_postgres_create_table_regex(file_path):
    """Parse PostgreSQL CREATE TABLE statements using regex."""
    with open(file_path, 'r') as sql_file:
        sql_content = sql_file.read()
    
    # Use sqlparse to split statements
    sql_statements = sqlparse.split(sql_content)
    
    for sql_statement in sql_statements:
        if not sql_statement.strip():
            continue
        
        # Format for better readability
        formatted_stmt = sqlparse.format(sql_statement, reindent=True, keyword_case='upper')
        
        # Check if it's a CREATE TABLE statement
        if 'CREATE TABLE' in formatted_stmt.upper():
            print("\n" + "="*50)
            print("CREATE TABLE statement found")
            
            # Extract table name
            table_match = re.search(r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)', formatted_stmt, re.IGNORECASE)
            if table_match:
                table_name = table_match.group(1)
                print(f"Table name: {table_name}")
            
            # Extract column definitions
            # Find the content between the first ( and the last )
            column_section_match = re.search(r'\(\s*(.*?)\s*\)(?:\s*TABLESPACE|$)', formatted_stmt, re.DOTALL)
            if not column_section_match:
                print("Could not extract column definitions")
                continue
            
            column_section = column_section_match.group(1)
            
            # Split column definitions - this is tricky because of nested parentheses
            # and commas inside type definitions
            columns = []
            constraints = []
            
            # Custom split that respects parentheses
            def split_by_top_level_comma(text):
                items = []
                current = ""
                paren_level = 0
                quote_char = None
                
                for char in text:
                    if char in ('"', "'") and (quote_char is None or char == quote_char):
                        quote_char = None if quote_char else char
                        current += char
                    elif char == '(' and quote_char is None:
                        paren_level += 1
                        current += char
                    elif char == ')' and quote_char is None:
                        paren_level -= 1
                        current += char
                    elif char == ',' and paren_level == 0 and quote_char is None:
                        items.append(current.strip())
                        current = ""
                    else:
                        current += char
                
                if current.strip():
                    items.append(current.strip())
                    
                return items
            
            column_defs = split_by_top_level_comma(column_section)
            
            print("\nColumn definitions:")
            for i, col_def in enumerate(column_defs):
                # Check if this is a constraint rather than a column
                if re.match(r'\s*CONSTRAINT\s+', col_def, re.IGNORECASE):
                    constraint_name_match = re.search(r'CONSTRAINT\s+(\w+)\s+', col_def, re.IGNORECASE)
                    constraint_name = constraint_name_match.group(1) if constraint_name_match else "unnamed"
                    
                    constraint_type = "unknown"
                    if "PRIMARY KEY" in col_def.upper():
                        constraint_type = "PRIMARY KEY"
                    elif "UNIQUE" in col_def.upper():
                        constraint_type = "UNIQUE"
                    elif "FOREIGN KEY" in col_def.upper():
                        constraint_type = "FOREIGN KEY"
                    elif "CHECK" in col_def.upper():
                        constraint_type = "CHECK"
                    
                    print(f"  Table constraint: {constraint_name} ({constraint_type})")
                    continue
                
                # This is a regular column definition
                # Extract column name (first word)
                col_name_match = re.match(r'(\w+)\s+', col_def)
                if not col_name_match:
                    print(f"  Could not parse column definition: {col_def}")
                    continue
                
                col_name = col_name_match.group(1)
                
                # Extract data type - this is complex because types can have parameters
                # First get everything up to NOT NULL, NULL, DEFAULT, or end of definition
                type_part = col_def[len(col_name):].strip()
                type_end = min(x for x in [
                    type_part.upper().find(" NOT NULL"),
                    type_part.upper().find(" NULL"),
                    type_part.upper().find(" DEFAULT"),
                    len(type_part)
                ] if x >= 0)
                
                data_type = type_part[:type_end].strip()
                
                # Check for constraints
                constraints = []
                if "NOT NULL" in col_def.upper():
                    constraints.append("NOT NULL")
                
                # Check for DEFAULT
                default_match = re.search(r'DEFAULT\s+([^,)]+)', col_def, re.IGNORECASE)
                if default_match:
                    default_value = default_match.group(1).strip()
                    constraints.append(f"DEFAULT {default_value}")
                
                print(f"  {i+1}. {col_name}: {data_type} {' '.join(constraints)}")
        
        elif 'CREATE INDEX' in formatted_stmt.upper():
            print("\n" + "="*50)
            print("CREATE INDEX statement found")
            
            # Extract index name
            index_match = re.search(r'CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)', formatted_stmt, re.IGNORECASE)
            if index_match:
                index_name = index_match.group(1)
                print(f"Index name: {index_name}")
            
            # Extract table name
            table_match = re.search(r'ON\s+([^\s(]+)', formatted_stmt, re.IGNORECASE)
            if table_match:
                table_name = table_match.group(1)
                print(f"On table: {table_name}")
        
        elif 'ALTER TABLE' in formatted_stmt.upper():
            print("\n" + "="*50)
            print("ALTER TABLE statement found")
            
            # Extract table name
            table_match = re.search(r'ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([^\s]+)', formatted_stmt, re.IGNORECASE)
            if table_match:
                table_name = table_match.group(1)
                print(f"Table being altered: {table_name}")

def main():
    """Main entry point for the application."""
    file_path = 'tests/basic-test.sql'
    parse_postgres_create_table_regex(file_path)

if __name__ == "__main__":
    main()