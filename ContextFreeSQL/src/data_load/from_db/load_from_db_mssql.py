import os
from infra.database import Database



def load_tables():   
"SELECT  o.object_id , o.name as EntName,o.name as table_name, o.type, o.create_date as crdate, SCHEMA_NAME(o.schema_id) as EntSchema,SCHEMA_NAME(o.schema_id) as table_schema, 0 as schema_ver, IDENT_SEED('['+SCHEMA_NAME(o.schema_id)+'].['+o.name+']') as [ident_seed], IDENT_INCR('['+SCHEMA_NAME(o.schema_id)+'].['+o.name+']') as [ident_incr] FROM sys.objects o (nolock)  
                        WHERE o.type IN ('U') AND  OBJECTPROPERTY(o.object_id, 'IsMSShipped')=0 "


def load_tables_columns():   
        "SELECT c.name as col_name, c.*,  COALESCE(TYPE_NAME(c.user_type_id), TYPE_NAME(c.user_type_id)) as user_type_name,cc.definition as computed_definition, ic.seed_value, ic.increment_value  FROM sys.all_columns c inner join sys.objects o on c.object_id=o.object_id LEFT JOIN sys.computed_columns cc ON c.object_id=cc.object_id and c.column_id=cc.column_id LEFT JOIN sys.identity_columns ic on c.object_id=ic.object_id  WHERE o.is_ms_shipped=0"


def load_tables_indexes():
         "SELECT i.*,ds.*,st.*, schema_name(o.schema_id) as table_schema, object_name(o.object_id) as table_name FROM sys.indexes i INNER JOIN sys.objects o on i.object_id=o.object_id INNER JOIN sys.data_spaces ds on i.data_space_id = ds.data_space_id LEFT JOIN sys.stats st ON i.object_id=st.object_id AND i.name=o.name " &
                                "WHERE o.is_ms_shipped=0 and i.is_hypothetical=0 AND i.type IN (1,2)/*,3)*/ and o.type in ('U')"
         


def load_tables_indexes_columns():
         "SELECT i.name as index_name, o.name as EntName, SCHEMA_NAME(o.schema_id) as EntSchema, o.name as table_name, SCHEMA_NAME(o.schema_id) as table_schema, ic.*,c.name AS col_name, COALESCE(TYPE_NAME(c.user_type_id), TYPE_NAME(c.system_type_id)) as user_type_name  " &
            "FROM sys.objects o  " &
             "INNER JOIN sys.indexes i on o.object_id=i.object_id " &
             "INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id " &
             "INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id " &
                "WHERE  o.is_ms_shipped=0 AND i.is_hypothetical=0 AND i.index_id>0 and ic.key_ordinal>0 AND o.type in ('U')"
         

def load_tables_foreign_keys():
    "select fk.*,fk.name as fk_name, SCHEMA_NAME(o.schema_id) as fkey_table_schema, OBJECT_NAME(fk.parent_object_id)  as fkey_table_name,SCHEMA_NAME(o2.schema_id) as rkey_table_schema, OBJECT_NAME(referenced_object_id)  as rkey_table_name FROM sys.foreign_keys fk INNER JOIN sys.objects o on fk.parent_object_id=o.object_id INNER JOIN sys.objects o2 on fk.referenced_object_id=o2.object_id" 
         

def load_tables_foreign_columns():
    "select ic.*,object_name(constraint_object_id) as fk_name, schema_name(o.schema_id) as fkey_table_schema, object_name(c1.object_id) as fkey_table_name,c1.name as fkey_col_name,schema_name(o2.schema_id) as rkey_table_schema,object_name(c2.object_id) as rkey_table_name, c2.name as rkey_col_name from sys.foreign_key_columns ic left join sys.objects o on ic.parent_object_id = o.object_id left join sys.objects o2 on ic.referenced_object_id = o2.object_id	left join sys.all_columns c1 on ic.parent_object_id=c1.object_id and ic.parent_column_id=c1.column_id 	left join sys.all_columns c2 on ic.referenced_object_id=c2.object_id and ic.referenced_column_id=c2.column_id " 


def load_tables_defaults():
    "SELECT SCHEMA_NAME(o.schema_id) AS table_schema, OBJECT_NAME(o.object_id) AS table_name, d.name as default_name, d.definition as default_definition, c.name as col_name FROM sys.default_constraints d INNER JOIN sys.objects o ON d.parent_object_id=o.object_id INNER jOIN sys.columns c on d.parent_object_id=c.object_id AND d.parent_column_id = c.column_id" + sNotInRndphFilterWHERE


