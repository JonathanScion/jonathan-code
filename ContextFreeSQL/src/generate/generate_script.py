from data_load.from_db.load_from_db_pg import TableSchema

def generate_all_script(schema: TableSchema):
    build_script_header('theSome.sql')
    return



def build_script_header(filename):
    # Using list of strings for better performance when building large strings
    header_lines = []
    header_lines.append("------------------------Context Free Script------------------------------------------")
    header_lines.append("--Parameters: @print: PRINT english description of what the script is doing")
    header_lines.append("--            @printExec: PRINT the SQL statements the script generates")
    header_lines.append("--            @execCode: EXECUTE the script on the database")
    header_lines.append("")
    header_lines.append("--feel free to change these flags")
    
    # Assuming these are your variable prefix and other parameters
    var_prefix = "@"  # adjust based on your needs
    boolean_type = "BIT"  # adjust based on your needs
    set_operator = "="   # adjust based on your needs
    declare_separator = ","  # adjust based on your needs
    
    header_lines.append(f"DECLARE {var_prefix}print {boolean_type} {set_operator} 1{declare_separator} ")
    header_lines.append(f"\t{var_prefix}printExec {boolean_type} {set_operator} 1{declare_separator} ")
    header_lines.append(f"\t{var_prefix}execCode {boolean_type} {set_operator} 1;")
    header_lines.append("-------------------------------------------------------------------------------------")
    header_lines.append("")
    
    # Join all lines with newline character
    header_content = "\n".join(header_lines)

    # Write content to file
    with open(filename, 'w') as f:
        f.write(header_content)
    
    return header_content