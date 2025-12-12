from enum import Enum
from dataclasses import dataclass, field
from typing import List

class DBType(Enum):
    MSSQL = 1
    MySQL = 2
    PostgreSQL = 3


@dataclass
class DBSyntax:
    set_operator: str
    declare_separator: str
    var_prefix: str
    nvarchar_type: str
    boolean_type: str
    max_length_str: str
    var_set_value: str
    temp_table_prefix: str
    temp_table_create: str
    boolean_true_value: str

    @classmethod
    def get_syntax(cls, dbtype: DBType) -> 'DBSyntax':
        match dbtype:
            case DBType.MSSQL:
                return cls(
                    set_operator="=",
                    declare_separator=",",
                    var_prefix="@",
                    nvarchar_type="nvarchar",
                    boolean_type="BIT",
                    max_length_str="(max)",
                    var_set_value="=",
                    temp_table_prefix="#",
                    temp_table_create="CREATE TABLE #",
                    boolean_true_value="1"
                )
            case DBType.PostgreSQL:            
                return cls(
                    set_operator=":=",
                    declare_separator=";",
                    var_prefix="",
                    nvarchar_type="character varying",
                    boolean_type="boolean",
                    max_length_str="",
                    var_set_value=":=",
                    temp_table_prefix="",
                    temp_table_create="CREATE TEMP TABLE ",
                    boolean_true_value="true"
                )
            case _:  # Default case
                # Default to PostgreSQL for any other value
                return cls(
                    set_operator=":=",
                    declare_separator=";",
                    var_prefix="",
                    nvarchar_type="character varying",
                    boolean_type="boolean",
                    max_length_str="",
                    var_set_value=":=",
                    temp_table_prefix="",
                    temp_table_create="CREATE TEMP TABLE ",
                    boolean_true_value="true"
                )
                

    
    
@dataclass
class InputOutput:
   html_template_path: str = "C:/Users/yonis/source/repos/veteran-developer/ContextFreeSQL/src/templates/db_compare.html"
   html_output_path: str = "C:/temp/database_report.html"
   output_sql: str = "C:/Users/yonis/source/repos/veteran-developer/ContextFreeSQL/tests/sample_out.sql"

@dataclass
class ScriptingOptions:
   # General scripting options
   remove_all_extra_ents: bool = True
   column_collation: bool = True
   code_compare_no_white_space: bool = True
   as_transaction: bool = False
   pre_add_constraints_data_checks: bool = False
   script_schemas: bool = True  # turning it off from MA, when doing only data. for now, its always on other wise 07-17-14
   all_schemas: bool = True  # if off, will only script schemas that we are using in entities we chose to script
   script_security: bool = False
   #code comparison
   code_compare_no_whitespace : bool = False

   # Data scripting options
   data_scripting_leave_report_fields_updated: bool = False
   data_scripting_leave_report_fields_updated_save_old_value: bool = False
   data_scripting_generate_dml_statements: bool = False
   data_comparison_include_equal_rows: bool = True  # if false, equal rows excluded from CSV/HTML comparison reports
   data_window_only: bool = False  # 3/31/15
   data_window_got_specific_cells: bool = False  # in case the user wants specific cells not to be included

   


@dataclass
class ScriptTableOptions:
    column_identity: bool = True
    indexes: bool = True
    foreign_keys: bool = True
    defaults: bool = True
    check_constraints: bool = True
    extended_props: bool = True
    table_name: str = ""
    
    
class DBEntScriptState(Enum):
    Add = 1
    Alter = 2
    Drop = 3
    InLine = 4

@dataclass
class DBConnSettings:
    host: str
    db_name: str
    user: str
    password: str
    port: str
  
    
    
#everything that's gonna be in 

@dataclass
class ListTables:
    tables: List[str] = field(default_factory=list)
    from_file: bool = False

@dataclass
class ConfigVals:
    db_conn: DBConnSettings
    script_ops: ScriptingOptions
    table_script_ops: ScriptTableOptions
    db_ents_to_load: ListTables
    tables_data: ListTables
    input_output: InputOutput

