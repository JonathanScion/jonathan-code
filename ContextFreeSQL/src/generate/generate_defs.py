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
                    temp_table_create="CREATE TEMP #",
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
    