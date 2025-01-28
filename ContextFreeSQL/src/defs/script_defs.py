from enum import Enum
from dataclasses import dataclass

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

   # Data scripting options
   data_scripting_leave_report_fields_updated: bool = False
   data_scripting_leave_report_fields_updated_save_old_value: bool = False
   data_scripting_generate_dml_statements: bool = False
   data_window_only: bool = False  # 3/31/15
   data_window_got_specific_cells: bool = False  # in case the user wants specific cells not to be included

   # Randolph options
   rndph_conn_str: str = None  # in case we got Rndph Overrides

   # Instance related options 
   instance_id: int = 0
   instance_id_at: str = ""  # for presentation purposes
   rndph_db_id: int = 0


@dataclass
class ScriptTableOptions:
    table_name: str = None
    column_identity: bool = True
    indexes: bool = True
    foreign_keys: bool = True
    defaults: bool = True
    check_constraints: bool = True
    extended_props: bool = True