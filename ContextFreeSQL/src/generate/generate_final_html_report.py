from src.defs.script_defs import DBType, DBSyntax, ScriptingOptions
from src.utils import funcs as utils


def generate_html_report(db_type: DBType, sql_buffer):
    """Generate HTML report code for database schema comparison"""
    
    sql_buffer.write("\n")
    
    if db_type == DBType.PostgreSQL:
        sql_buffer.write("IF (htmlReport = True) THEN\n")
        sql_buffer.write("\tDECLARE \n")
        sql_buffer.write("\t\tresult_string text;\n")
        sql_buffer.write("\tBEGIN\n")
        sql_buffer.write("\t\tSELECT 'const reportData = [' || \n")
        sql_buffer.write("\t\t\t   string_agg(\n")
        sql_buffer.write("\t\t\t\t   '{\n")
        sql_buffer.write("\t\t\t\t\t\tschema: ''' || ST.table_schema || ''',\n")
        sql_buffer.write("\t\t\t\t\t\tname: ''' || ST.table_name || ''',\n")
        sql_buffer.write("\t\t\t\t\t\ttype: ''Table'',\n")
        sql_buffer.write("\t\t\t\t\t\tstatus: ''' || \n")
        sql_buffer.write("\t\t\t\t\t\t\tCASE ST.tablestat\n")
        sql_buffer.write("\t\t\t\t\t\t\t\tWHEN 0 THEN 'equal'\n")
        sql_buffer.write("\t\t\t\t\t\t\t\tWHEN 1 THEN 'left-only'\n")
        sql_buffer.write("\t\t\t\t\t\t\t\tWHEN 2 THEN 'right-only'\n")
        sql_buffer.write("\t\t\t\t\t\t\t\tWHEN 3 THEN 'different'\n")
        sql_buffer.write("\t\t\t\t\t\t\t\tELSE 'equal'\n")
        sql_buffer.write("\t\t\t\t\t\t\tEND || '''\n")
        sql_buffer.write("\t\t\t\t\t}', ',\n")
        sql_buffer.write("\t\t\t\t') || \n")
        sql_buffer.write("\t\t\t   '];'\n")
        sql_buffer.write("\t\tINTO result_string\n")
        sql_buffer.write("\t\tFROM ScriptTables ST;\n")
        sql_buffer.write("\t\tRAISE NOTICE '%', result_string; --replace this with replacing code in html file\n")
        sql_buffer.write("\tEND;\n")
        sql_buffer.write("END IF; --htmlReport\n")

    
    sql_buffer.write("\n")