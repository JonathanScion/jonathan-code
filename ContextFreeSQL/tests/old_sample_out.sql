DO $$
------------------------Context Free Script------------------------------------------
--Parameters: @print: PRINT english description of what the script is doing
--            @printExec: PRINT the SQL statements the script generates
--            @execCode: EXECUTE the script on the database

--feel free to change these flags
DECLARE print boolean := 1; 
	printExec boolean := 1; 
	execCode boolean := 1;
-------------------------------------------------------------------------------------

DECLARE table_schema character varying (128);
DECLARE table_name character varying (128);
DECLARE index_name character varying (128);
DECLARE fk_name character varying (128);
DECLARE col_name character varying (128);
DECLARE user_type_name character varying (128);
DECLARE max_length smallint;  
DECLARE precision smallint;  
DECLARE scale smallint;  
DECLARE is_nullable bit;  
DECLARE is_identity bit;  
DECLARE is_computed bit;  
DECLARE collation_name character varying (128);  
DECLARE computed_definition character varying ;  
DECLARE SQL_CREATE character varying ; 
DECLARE SQL_ALTER character varying ; 
DECLARE SQL_DROP character varying ; 
DECLARE diff_descr character varying ; 
DECLARE ent_type character varying (25); 
----anything below here is old Johannes
DECLARE sqlCode character varying  ; schemaChanged boolean := 0;
BEGIN --overall code
perform  n.nspname, c.relname
From pg_catalog.pg_class c LEFT Join pg_catalog.pg_namespace n ON n.oid = c.relnamespace
Where n.nspname Like 'pg_temp_%' AND c.relname='scriptoutput' AND pg_catalog.pg_table_is_visible(c.oid);
If FOUND THEN
DROP TABLE scriptoutput;
End If;
CREATE TEMP TABLE scriptoutput
(
	SQLText character varying
);
--Creating Schemas----------------------------------------------------------------
--Schemas
DECLARE schema_name character varying (128);
BEGIN --schmea code
perform  n.nspname ,c.relname
FROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname like 'pg_temp_%' AND c.relname='scriptschemas' AND pg_catalog.pg_table_is_visible(c.oid);
IF FOUND THEN
	DROP TABLE ScriptSchemas;
END IF;
CREATE TEMP TABLE ScriptSchemas
(
	schema_name character varying (128) not null,
	principal_name character varying  null,
	SQL_CREATE character varying  null,
	SQL_DROP character varying  null,
	schemaStat smallint null
);


INSERT INTO ScriptSchemas (schema_name,principal_name, SQL_CREATE)
VALUES ('public','pg_database_owner','CREATE SCHEMA public  AUTHORIZATION pg_database_owner;');
INSERT INTO ScriptSchemas (schema_name,principal_name, SQL_CREATE)
VALUES ('jon','postgres','CREATE SCHEMA jon  AUTHORIZATION postgres;');
--Schemas only on Johannes database (need to add)
update ScriptSchemas set schemaStat = 1
FROM ScriptSchemas S
where LOWER(S.schema_name) not in 
( 
select LOWER(J.schema_name) from information_schema.schemata J 
WHERE J.schema_name NOT IN ('pg_catalog','information_schema') and J.schema_name NOT LIKE 'pg_temp%' and J.schema_name NOT LIKE 'pg_toast%' 
)  
AND (S.schema_name=ScriptSchemas.schema_name);

--Schemas only on DB (need to drop)
INSERT  INTO ScriptSchemas ( schema_name, SQL_DROP, schemaStat)
SELECT  J.schema_name,'DROP SCHEMA ' || J.schema_name || ';', 2 
FROM    information_schema.schemata J 
Where J.schema_name Not In ('pg_catalog','information_schema') AND J.schema_name NOT LIKE 'pg_temp%' AND J.schema_name NOT LIKE 'pg_toast%' 
AND LOWER(J.schema_name) Not IN (select LOWER(J1.schema_name) from scriptschemas J1);

--Adding new entities and ones that were modified
	declare temprow record;
	BEGIN
		FOR temprow IN
			SELECT  s.schema_name ,  
			s.SQL_CREATE 
			FROM    ScriptSchemas s
			WHERE SchemaStat IN (1,3) --right now there aren't any 3 here but whatever. need to think about what to do when got a schema with a different authorization (principal_name in the table) 
		LOOP
	IF (print=True) THEN
		INSERT INTO scriptoutput (SQLText)
		VALUES ('--Adding Schema ' || temprow.schema_name || ':');
	END IF;
	IF (printExec = True) THEN 
		INSERT INTO scriptoutput (SQLText)
		VALUES (temprow.SQL_CREATE);
	END IF;
	IF (execCode = True) THEN
		EXECUTE temprow.SQL_CREATE;
	END IF;
	schemaChanged = True;


		END LOOP;
	END; --off 
END; --schema code

--DB State Temp Tables for Tables
--tables
perform  n.nspname ,c.relname
FROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname like 'pg_temp_%' AND c.relname='scripttables' AND pg_catalog.pg_table_is_visible(c.oid);
IF FOUND THEN
	DROP TABLE ScriptTables;
END IF;
CREATE TEMP TABLE ScriptTables
(
	table_schema character varying (128) not null,
	table_name character varying (128) not null,
	SQL_CREATE character varying  null,
	SQL_DROP character varying  null,
	col_diff boolean NULL,
	index_diff boolean NULL,
	fk_diff boolean NULL,
	tableStat smallint null
);

INSERT INTO ScriptTables (table_schema,table_name, SQL_CREATE, SQL_DROP)
VALUES ('jon','family','CREATE TABLE jon.family
(
family_id  integer  NOT NULL,
family_first_name  character varying  (20)  NOT NULL,
family_last_name  character varying  (20)  NOT NULL
);
ALTER TABLE jon.family ADD 
PRIMARY KEY 
(
family_id
)
;','DROP TABLE jon.family;');

--tables only on Johannes database (need to add)
update ScriptTables set tableStat = 1
FROM ScriptTables J left join (select t.table_schema, t.table_name FROM information_schema.tables t WHERE t.table_schema not in ('information_schema', 'pg_catalog') AND t.table_schema NOT LIKE 'pg_temp%' ) DB 
on LOWER(J.table_schema) = LOWER(DB.table_schema) AND LOWER(J.table_name) = LOWER(DB.table_name) 
where DB.table_name Is null; 
--table only on DB (need to drop)
INSERT  INTO ScriptTables ( table_schema ,table_name,tableStat)
SELECT  DB.table_schema ,DB.table_name,2 
FROM    ScriptTables J 
RIGHT JOIN ( SELECT t.table_schema , 
t.table_name 
FROM   information_schema.tables t  where t.table_schema not in ('information_schema', 'pg_catalog') AND t.table_schema NOT LIKE 'pg_temp%'  AND table_type like '%TABLE%' 
) DB ON LOWER(J.table_schema) = LOWER(DB.table_schema) 
AND LOWER(J.table_name) = LOWER(DB.table_name) 
WHERE J.table_name Is NULL; 

--columns
perform  n.nspname ,c.relname
FROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname like 'pg_temp_%' AND c.relname='scriptcols' AND pg_catalog.pg_table_is_visible(c.oid);
IF FOUND THEN
	DROP TABLE ScriptCols;
END IF;
CREATE TEMP TABLE ScriptCols
(
	table_schema character varying (128) not null,
	table_name character varying (128) not null,
	col_name character varying (128) not null,
	user_type_name character varying (128) null,
	user_type_name_diff boolean null, 
	user_type_name_db  character varying (128) null, 
	max_length smallint null,
	max_length_diff boolean null,
	max_length_db smallint null,
	precision smallint null,
	precision_diff bit null,
	precision_db smallint null,
	scale smallint null,
	scale_diff bit null,
	scale_db smallint null,
	is_nullable boolean null,
	is_nullable_diff bit null,
	is_nullable_db boolean null,
	is_identity boolean null,
	is_identity_diff bit null,
	is_identity_db boolean null,
	is_computed bit null,
	is_computed_diff bit null,
	collation_name character varying (128) null,
	collation_name_diff bit null,
	collation_name_db character varying (128) null,
	computed_definition character varying  null,
	computed_definition_diff bit null,
	computed_definition_db character varying  null,
	colStat smallint null,
	diff_descr character varying  null,
	SQL_CREATE character varying  null,
	SQL_ALTER character varying  null,
	SQL_DROP character varying  null
);

INSERT INTO ScriptCols (table_schema,table_name,col_name,user_type_name,max_length,precision,scale,is_nullable,is_identity,is_computed,collation_name,computed_definition, SQL_CREATE, SQL_ALTER, SQL_DROP)
VALUES ('jon','family','family_id','integer',NULL,'32','0','0','1',NULL,NULL,NULL,'ALTER TABLE jon.family ADD family_id  integer  NOT NULL ','ALTER TABLE jon.family ALTER COLUMN family_id  TYPE  integer ,
	ALTER COLUMN family_id SET  NOT NULL ','ALTER TABLE jon.family DROP COLUMN family_id');
INSERT INTO ScriptCols (table_schema,table_name,col_name,user_type_name,max_length,precision,scale,is_nullable,is_identity,is_computed,collation_name,computed_definition, SQL_CREATE, SQL_ALTER, SQL_DROP)
VALUES ('jon','family','family_first_name','character varying','20',NULL,NULL,'0','0',NULL,NULL,NULL,'ALTER TABLE jon.family ADD family_first_name  character varying  (20)  NOT NULL ','ALTER TABLE jon.family ALTER COLUMN family_first_name  TYPE  character varying  (20) ,
	ALTER COLUMN family_first_name SET  NOT NULL ','ALTER TABLE jon.family DROP COLUMN family_first_name');
INSERT INTO ScriptCols (table_schema,table_name,col_name,user_type_name,max_length,precision,scale,is_nullable,is_identity,is_computed,collation_name,computed_definition, SQL_CREATE, SQL_ALTER, SQL_DROP)
VALUES ('jon','family','family_last_name','character varying','20',NULL,NULL,'0','0',NULL,NULL,NULL,'ALTER TABLE jon.family ADD family_last_name  character varying  (20)  NOT NULL ','ALTER TABLE jon.family ALTER COLUMN family_last_name  TYPE  character varying  (20) ,
	ALTER COLUMN family_last_name SET  NOT NULL ','ALTER TABLE jon.family DROP COLUMN family_last_name');

--columns only on Johannes database (need to add)
update ScriptCols set colStat = 1
FROM ScriptCols J left join (select t.table_schema, t.table_name, c.column_name FROM information_schema.tables t INNER JOIN information_schema.columns c on t.table_schema=c.table_schema and t.table_name=c.table_name WHERE t.table_schema not in ('information_schema', 'pg_catalog') AND t.table_schema NOT LIKE 'pg_temp%'  and t.table_type LIKE '%TABLE%' ) DB 
on LOWER(J.table_schema) = LOWER(DB.table_schema) and LOWER(J.table_name) = LOWER(DB.table_name) and LOWER(J.col_name) = LOWER(DB.column_name) 
where DB.column_name Is null 
AND J.table_schema=ScriptCols.table_schema and J.table_name=ScriptCols.table_name and J.col_name=ScriptCols.col_name;

--columns only on DB (need to drop)
INSERT INTO ScriptCols   ( table_schema ,table_name,col_name,colStat,SQL_DROP) 
SELECT  DB.table_schema ,DB.table_name, DB.column_name,2,'ALTER TABLE ' || DB.table_schema || '.' || DB.table_name || ' DROP COLUMN ' || DB.column_name || ';' 
FROM    ScriptCols J 
RIGHT JOIN ( select t.table_schema, t.table_name, c.column_name FROM information_schema.tables t INNER JOIN information_schema.columns c on t.table_schema=c.table_schema and t.table_name=c.table_name WHERE t.table_schema not in ('information_schema', 'pg_catalog') AND t.table_schema NOT LIKE 'pg_temp%'  and t.table_type LIKE '%TABLE%' 
AND  C.table_schema || C.table_name IN ('jonfamily') 
) DB ON LOWER(J.table_schema) = LOWER(DB.table_schema) 
And LOWER(J.table_name) = LOWER(DB.table_name) 
And LOWER(J.col_name) = LOWER(DB.column_name) 
WHERE  /* DB.table_schema + DB.table_name In ('jonfamily') 
And */( J.col_name Is NULL );  


---updates Of flags--------------------

--system type name 
update ScriptCols Set user_type_name_diff=true, colStat = 3, user_type_name_db=DB.user_type_name, 
	diff_descr = Case When j.diff_descr Is NULL Then '' 
		ELSE j.diff_descr || ', ' 
	END || 'user_type_name is ' 
	 || CAST(DB.user_type_name AS character varying(10)) || ', should be ' 
	 || CAST(J.user_type_name AS character varying(10)) 
from ScriptCols J INNER join (select t.table_schema, t.table_name, c.column_name, c.data_type as user_type_name
from information_schema.columns C INNER JOIN information_schema.tables T on c.table_schema=t.table_schema and c.table_name=t.table_name
where C.TABLE_SCHEMA not in ('information_schema', 'pg_catalog') and t.table_type LIKE '%TABLE%') DB  
on LOWER(J.table_schema) = LOWER(DB.table_schema) and LOWER(J.table_name) = LOWER(DB.table_name) and LOWER(J.col_name) = LOWER(DB.column_name) 
where J.user_type_name <> DB.user_type_name 
AND (ScriptCols.table_schema = j.table_schema AND ScriptCols.table_name = j.table_name AND ScriptCols.col_name = j.col_name);

--max length 
update ScriptCols Set max_length_diff = true,colStat = 3, max_length_db=DB.CHARACTER_MAXIMUM_LENGTH, 
	diff_descr = Case When j.diff_descr Is NULL Then '' 
		ELSE j.diff_descr || ', ' 
	END || 'max_length is ' 
	 || CAST(DB.CHARACTER_MAXIMUM_LENGTH AS character varying(10)) || ', should be ' 
	 || CAST(J.max_length AS character varying(10)) 
from ScriptCols J INNER join (select t.table_schema, t.table_name, c.column_name, c.CHARACTER_MAXIMUM_LENGTH
from information_schema.columns C INNER JOIN information_schema.tables T on c.table_schema=t.table_schema and c.table_name=t.table_name
where C.TABLE_SCHEMA not in ('information_schema', 'pg_catalog') and t.table_type LIKE '%TABLE%') DB  
on LOWER(J.table_schema) = LOWER(DB.table_schema) and LOWER(J.table_name) = LOWER(DB.table_name) and LOWER(J.col_name) = LOWER(DB.column_name) 
where J.max_length <> DB.CHARACTER_MAXIMUM_LENGTH 
AND ( LOWER(ScriptCols.table_schema) = LOWER(j.table_schema) AND LOWER(ScriptCols.table_name) = LOWER(j.table_name) AND LOWER(ScriptCols.col_name) = LOWER(j.col_name) );

--precision 
update ScriptCols Set max_length_diff = true,colStat = 3, precision_db=DB.precision, 
	diff_descr = Case When j.diff_descr Is NULL Then '' 
		ELSE j.diff_descr || ', ' 
	END || 'precision is ' 
	 || CAST(DB.precision AS character varying(10)) || ', should be ' 
	 || CAST(J.precision AS character varying(10)) 
from ScriptCols J INNER join (select t.table_schema, t.table_name, c.column_name, c.numeric_precision AS precision
from information_schema.columns C INNER JOIN information_schema.tables T on c.table_schema=t.table_schema and c.table_name=t.table_name
where C.TABLE_SCHEMA not in ('information_schema', 'pg_catalog') and t.table_type LIKE '%TABLE%') DB  
on LOWER(J.table_schema) = LOWER(DB.table_schema) and LOWER(J.table_name) = LOWER(DB.table_name) and LOWER(J.col_name) = LOWER(DB.column_name) 
where J.precision <> DB.precision 
AND ( LOWER(ScriptCols.table_schema) = LOWER(j.table_schema) AND LOWER(ScriptCols.table_name) = LOWER(j.table_name) AND LOWER(ScriptCols.col_name) = LOWER(j.col_name) );

--scale 
update ScriptCols Set max_length_diff = true,colStat = 3, scale_db=DB.scale, 
	diff_descr = Case When j.diff_descr Is NULL Then '' 
		ELSE j.diff_descr || ', ' 
	END || 'scale is ' 
	 || CAST(DB.scale AS character varying(10)) || ', should be ' 
	 || CAST(J.scale AS character varying(10)) 
from ScriptCols J INNER join (select t.table_schema, t.table_name, c.column_name, c.numeric_scale AS scale
from information_schema.columns C INNER JOIN information_schema.tables T on c.table_schema=t.table_schema and c.table_name=t.table_name
where C.TABLE_SCHEMA not in ('information_schema', 'pg_catalog') and t.table_type LIKE '%TABLE%') DB  
on LOWER(J.table_schema) = LOWER(DB.table_schema) and LOWER(J.table_name) = LOWER(DB.table_name) and LOWER(J.col_name) = LOWER(DB.column_name) 
where J.scale <> DB.scale 
AND ( LOWER(ScriptCols.table_schema) = LOWER(j.table_schema) AND LOWER(ScriptCols.table_name) = LOWER(j.table_name) AND LOWER(ScriptCols.col_name) = LOWER(j.col_name));

--is_nullable 
update ScriptCols Set max_length_diff = true,colStat = 3, is_nullable_db=DB.is_nullable, 
	diff_descr = Case When j.diff_descr Is NULL Then '' 
		ELSE j.diff_descr || ', ' 
	END || 'is_nullable is ' 
	 || CAST(DB.is_nullable AS character varying(10)) || ', should be ' 
	 || CAST(J.is_nullable AS character varying(10)) 
from ScriptCols J INNER join (select t.table_schema, t.table_name, c.column_name, case WHEN c.IS_NULLABLE = 'YES' then CAST(1 AS BOOLEAN) WHEN c.IS_NULLABLE = 'NO' then CAST(0 AS BOOLEAN) END AS is_nullable
from information_schema.columns C INNER JOIN information_schema.tables T on c.table_schema=t.table_schema and c.table_name=t.table_name
where C.TABLE_SCHEMA not in ('information_schema', 'pg_catalog') and t.table_type LIKE '%TABLE%') DB  
on LOWER(J.table_schema) = LOWER(DB.table_schema) and LOWER(J.table_name) = LOWER(DB.table_name) and LOWER(J.col_name) = LOWER(DB.column_name) 
where J.is_nullable <> DB.is_nullable 
AND ( LOWER(ScriptCols.table_schema) = LOWER(j.table_schema) AND LOWER(ScriptCols.table_name) = LOWER(j.table_name) AND LOWER(ScriptCols.col_name) = LOWER(j.col_name) );

--is_identity 
update ScriptCols Set max_length_diff = true,colStat = 3, is_identity_db=DB.is_identity, 
	diff_descr = Case When j.diff_descr Is NULL Then '' 
		ELSE j.diff_descr || ', ' 
	END || 'is_identity is ' 
	 || CAST(DB.is_identity AS character varying(10)) || ', should be ' 
	 || CAST(J.is_identity AS character varying(10)) 
from ScriptCols J INNER join (select t.table_schema, t.table_name, c.column_name, case WHEN c.IS_IDENTITY = 'YES' then CAST(1 AS BOOLEAN)  WHEN c.IS_IDENTITY = 'NO' then CAST(0 AS BOOLEAN)  END AS is_identity
from information_schema.columns C INNER JOIN information_schema.tables T on c.table_schema=t.table_schema and c.table_name=t.table_name
where C.TABLE_SCHEMA not in ('information_schema', 'pg_catalog') and t.table_type LIKE '%TABLE%') DB  
on LOWER(J.table_schema) = LOWER(DB.table_schema) and LOWER(J.table_name) = LOWER(DB.table_name) and LOWER(J.col_name) = LOWER(DB.column_name) 
where J.is_identity <> DB.is_identity 
AND ( LOWER(ScriptCols.table_schema) = LOWER(j.table_schema) AND LOWER(ScriptCols.table_name) = LOWER(j.table_name) AND LOWER(ScriptCols.col_name) = LOWER(j.col_name) );

--is_computed 

--collation_name 

--computed_definition 


--update tables where columns are different
update ScriptTables set tableStat=3 
from ScriptTables T INNER JOIN ScriptCols C on LOWER(T.table_schema) = LOWER(C.table_schema) AND LOWER(T.table_name) = LOWER(C.table_name) 
where C.colStat IN (1,2,3) AND (T.tableStat NOT IN (1,2) OR t.tableStat IS NULL); --extra, missing, or different 

--wherever got columns different, mark the tables as different
UPDATE ScriptTables SET col_diff=true
FROM ScriptTables T INNER JOIN ScriptCols C ON LOWER(T.table_schema) = LOWER(C.table_schema) AND LOWER(T.table_name) = LOWER(C.table_name)
WHERE C.ColStat Is Not NULL AND (T.tableStat NOT IN (1,2) OR t.tableStat IS NULL);


--Defaults
perform  n.nspname ,c.relname
FROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname like 'pg_temp_%' AND c.relname='scriptdefaults' AND pg_catalog.pg_table_is_visible(c.oid);
IF FOUND THEN
	DROP TABLE ScriptDefaults;
END IF;

CREATE TEMP TABLE ScriptDefaults
(
	table_schema character varying(128) not null,
	table_name character varying(128) not null,
	col_name character varying(128) not null,
	default_name character varying(128) not null,
	default_definition character varying  not null,
	SQL_CREATE character varying  null,
	SQL_DROP character varying  null,
	col_diff boolean null,
	defaultStat smallint null
);
--wherever got columns that are different, defaults on them must be marked so they can be dropped and then added 
UPDATE ScriptDefaults SET col_diff=true 
FROM ScriptDefaults DF INNER JOIN ScriptCols C ON LOWER(DF.table_schema) = LOWER(C.table_schema) AND LOWER(DF.table_name) = LOWER(C.table_name) AND LOWER(DF.col_name) = LOWER(C.col_name)  
WHERE C.colStat=3;
--Defaults only on Johannes database (need to add)
UPDATE  ScriptDefaults SET defaultStat = 1 
FROM    ScriptDefaults J 
LEFT JOIN (select C.table_schema, C.table_name, C.COLUMN_NAME as col_name, 'def_' || C.table_schema || '_' || C.table_name || '_' || C.COLUMN_NAME as default_name, C.COLUMN_DEFAULT as definition 
FROM information_schema.COLUMNS C 
where C.TABLE_SCHEMA not in ('information_schema', 'pg_catalog') 
AND C.table_schema || C.table_name IN ('jonfamily') 
) DB ON LOWER(J.table_schema) = LOWER(DB.table_schema) 
And LOWER(J.table_name) = LOWER(DB.table_name) 
And LOWER(J.col_name) = LOWER(DB.col_name) 
And LOWER(J.default_name) = LOWER(DB.default_name) 
WHERE  DB.definition Is NULL; /*And SCHEMA_NAME(o.schema_id) + o.name In ('jonfamily')*/ 

--Default only On DB (need To drop)
INSERT  INTO ScriptDefaults   ( table_schema ,table_name,default_name,col_name,default_definition, defaultStat) 
Select  DB.table_schema , DB.table_name,DB.default_name,DB.col_name,DB.default_definition,2 
FROM    ScriptDefaults J 
RIGHT JOIN (select C.table_schema, C.table_name, C.COLUMN_NAME as col_name, 'def_' || C.table_schema || '_' || C.table_name || '_' || C.COLUMN_NAME as default_name, COLUMN_DEFAULT as default_definition 
FROM information_schema.COLUMNS C 
WHERE C.TABLE_SCHEMA not in ('information_schema', 'pg_catalog') 
AND C.table_schema || C.table_name IN ('jonfamily') and COLUMN_DEFAULT is NOT NULL
) DB On LOWER(J.table_schema) = LOWER(DB.table_schema) 
And LOWER(J.table_name )= LOWER(DB.table_name) 
And LOWER(J.default_name) = LOWER(DB.default_name) 
And LOWER(j.col_name) = LOWER(DB.col_name) 
WHERE J.table_name Is NULL; 

---updates Of Default flags--------------------
--default_definition (the only one that counts) 
update ScriptDefaults Set /*default_definition_diff=1,*/defaultStat=3  --no need For default_definition_diff right now since its the only field that might be different
from ScriptDefaults J INNER join (select C.table_schema, C.table_name, C.COLUMN_NAME as col_name, 'def_' || C.table_schema || '_' || C.table_name || '_' || C.COLUMN_NAME as default_name, COLUMN_DEFAULT as default_definition 
FROM information_schema.COLUMNS C 
WHERE C.TABLE_SCHEMA not in ('information_schema', 'pg_catalog') 
AND C.table_schema || C.table_name IN ('jonfamily') ) DB  
On LOWER(J.table_schema) = LOWER(DB.table_schema) And LOWER(J.table_name) = LOWER(DB.table_name) And LOWER(J.default_name) = LOWER(DB.default_name) And LOWER(J.col_name) = LOWER(DB.col_name) 
where J.default_definition <> DB.default_definition; 


--Indexes
perform  n.nspname ,c.relname
FROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname like 'pg_temp_%' AND c.relname='scriptindexes' AND pg_catalog.pg_table_is_visible(c.oid);
IF FOUND THEN
	DROP TABLE ScriptIndexes;
END IF;
CREATE TEMP TABLE ScriptIndexes
(
	table_schema character varying(128) not null,
	table_name character varying(128) not null,
	index_name character varying(128) not null,
	is_unique boolean null,
	is_unique_diff boolean null,
	is_clustered boolean null,
	is_clustered_diff boolean null,
	ignore_dup_key boolean null,
	ignore_dup_key_diff boolean null,
	is_primary_key boolean null,
	is_primary_key_diff boolean null,
	is_unique_constraint boolean null,
	is_unique_constraint_diff boolean null,
	allow_row_locks boolean null,
	allow_row_locks_diff boolean null,
	allow_page_locks boolean null,
	allow_page_locks_diff boolean null,
	has_filter boolean null,
	has_filter_diff boolean null,
	filter_definition character varying null,
	filter_definition_diff boolean null,
	SQL_CREATE character varying null,
	index_columns character varying (100) NULL,
	indexStat smallint null,
	col_diff boolean null,
	db_col_diff boolean null
);

perform  n.nspname ,c.relname
FROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname like 'pg_temp_%' AND c.relname='scriptindexescols' AND pg_catalog.pg_table_is_visible(c.oid);
IF FOUND THEN
	DROP TABLE ScriptIndexesCols;
END IF;
CREATE TEMP TABLE ScriptIndexesCols
(
	table_schema character varying(128) not null,
	table_name character varying(128) not null,
	index_name character varying(128) not null,
	col_name character varying(128) not  null,
	index_column_id int null,
	key_ordinal int null,
	key_ordinal_diff boolean null,
	is_descending_key boolean null,
	is_descending_key_diff boolean null,
	is_included_column boolean null,
	is_included_column_diff boolean null,
	indexColStat smallint null
);

INSERT INTO ScriptIndexes (table_schema,table_name,index_name,is_unique,is_clustered, ignore_dup_key,is_primary_key,is_unique_constraint,allow_row_locks, allow_page_locks,has_filter,filter_definition, index_columns,SQL_CREATE)
VALUES ('jon','family','family_pkey',True,
False,
NULL,
True,
False,
NULL,
NULL,
NULL,
NULL,
'family_id',
'ALTER TABLE jon.family ADD 
PRIMARY KEY 
(
family_id
)
');
--Insert Index Columns
INSERT INTO ScriptIndexesCols (table_schema,table_name,index_name,col_name,index_column_id, key_ordinal, is_descending_key,is_included_column )
VALUES ('jon','family','family_pkey','family_id',
'1',
'1',
False,
NULL);


--Indexes only on Johannes database (need to add)
UPDATE  ScriptIndexes SET indexStat = 1 
From ScriptIndexes J  
Left Join (SELECT 
scm.nspname  || '.' || t.relname as object_id, /*t.oid as object_id,*/ i.oid as index_oid, 
scm.nspname As table_schema, 
t.relname As table_name, 
i.relname as index_name 
from 
pg_index ix  
inner Join pg_class i  ON i.oid = ix.indexrelid 
inner Join pg_class t on t.oid = ix.indrelid --indrelid Is the oid of the table 
inner Join pg_namespace scm on  t.relnamespace = scm.oid 
WHERE scm.nspname || t.relname IN ('jonfamily')  
) DB ON LOWER(J.table_schema) = LOWER(DB.table_schema)
And LOWER(J.table_name) = LOWER(DB.table_name)
And LOWER(J.index_name) = LOWER(DB.index_name) 
WHERE   DB.table_name Is NULL AND ScriptIndexes.index_name = J.index_name; --PG wants an explicit join of the updated table to its alias 

--Indexes only on DB (need to drop)
INSERT  INTO ScriptIndexes   ( table_schema ,table_name,index_name,is_unique_constraint,is_primary_key, indexStat)  
SELECT  DB.table_schema , DB.table_name,DB.index_name,DB.is_unique_constraint,DB.is_primary_key,2  
FROM    ScriptIndexes J 
RIGHT JOIN ( SELECT 
scm.nspname  || '.' || t.relname as object_id, /*t.oid as object_id,*/ i.oid as index_oid, 
scm.nspname As table_schema, 
t.relname As table_name, 
i.relname as index_name, 
Case cnst.contype When 'u' then True else False end as is_unique_constraint, 
indisprimary as is_primary_key 
from 
pg_index ix  
inner Join pg_class i  ON i.oid = ix.indexrelid 
inner Join pg_class t on t.oid = ix.indrelid --indrelid Is the oid of the table 
inner Join pg_namespace scm on  t.relnamespace = scm.oid 
inner JOIN pg_class cls ON cls.oid=ix.indexrelid inner JOIN pg_am am ON am.oid=cls.relam 
inner Join pg_indexes idx on idx.schemaname=scm.nspname And idx.tablename=t.relname And idx.indexname=i.relname 
Left Join pg_constraint cnst on t.oid = cnst.conrelid And i.oid=cnst.conindid And cnst.contype='u' 
WHERE scm.nspname || t.relname IN ('jonfamily')  
) DB On LOWER(J.table_schema) = LOWER(DB.table_schema) 
And LOWER(J.table_name) = LOWER(DB.table_name) 
And LOWER(J.index_name) = LOWER(DB.index_name) 
WHERE J.table_name Is NULL; 

update ScriptIndexes Set is_unique_diff=True, indexStat = 3 
From ScriptIndexes J INNER Join (
Select 
scm.nspname  || '.' || t.relname as object_id, /*t.oid as object_id,*/ i.oid as index_oid,
scm.nspname As table_schema,
t.relname As table_name,
i.relname as index_name,
/*array_to_string(ix.indkey, ' ')*/ substring(idx.indexdef,'\((.*?)\)')  as index_columns
from
pg_index ix 
inner Join pg_class i  ON i.oid = ix.indexrelid
inner Join pg_class t on t.oid = ix.indrelid --indrelid Is the oid of the table
inner Join pg_namespace scm on  t.relnamespace = scm.oid
inner Join pg_class cls ON cls.oid=ix.indexrelid inner JOIN pg_am am ON am.oid=cls.relam
inner Join pg_indexes idx on idx.schemaname=scm.nspname And idx.tablename=t.relname And idx.indexname=i.relname
Left Join pg_constraint cnst on t.oid = cnst.conrelid And i.oid=cnst.conindid And cnst.contype='u'	
where scm.nspname || t.relname IN ('jonfamily') 
) DB 
On LOWER(J.table_schema) = LOWER(DB.table_schema) And LOWER(J.table_name) = LOWER(DB.table_name) And LOWER(J.index_name) = LOWER(DB.index_name) 
where J.index_columns <> DB.index_columns AND ScriptIndexes.index_name = J.index_name; --PG wants an explicit join of the updated table to its alias  

---updates Of index And index columns flags--------------------
---updates Of index flags--------------------
--is_unique 
update ScriptIndexes Set is_unique_diff=True, indexStat = 3 
From ScriptIndexes J INNER Join
(
Select
scm.nspname  || '.' || t.relname as object_id, /*t.oid as object_id,*/ i.oid as index_oid,
scm.nspname As table_schema,
t.relname As table_name,
i.relname as index_name, i.relname As name,
ix.indisunique as is_unique,
indisclustered as is_clustered       
from
pg_index ix 
inner Join pg_class i  ON i.oid = ix.indexrelid
inner Join pg_class t on t.oid = ix.indrelid --indrelid Is the oid of the table
inner Join pg_namespace scm on  t.relnamespace = scm.oid		
where scm.nspname Not in ('pg_catalog','information_schema', 'pg_toast')	
) DB  
On J.table_schema= DB.table_schema And J.table_name = DB.table_name And J.index_name = DB.index_name 
where J.is_unique <> DB.is_unique 
And (ScriptIndexes.index_name = J.index_name); --PG wants an explicit join of the updated table to its alias 
--is_clustered 
update ScriptIndexes Set is_clustered_diff=True, indexStat = 3 
From ScriptIndexes J INNER Join
(
Select
scm.nspname  || '.' || t.relname as object_id, /*t.oid as object_id,*/ i.oid as index_oid,
scm.nspname As table_schema,
t.relname As table_name,
i.relname as index_name, i.relname As name,
ix.indisunique as is_unique,
indisclustered as is_clustered       
from
pg_index ix 
inner Join pg_class i  ON i.oid = ix.indexrelid
inner Join pg_class t on t.oid = ix.indrelid --indrelid Is the oid of the table
inner Join pg_namespace scm on  t.relnamespace = scm.oid		
where scm.nspname Not in ('pg_catalog','information_schema', 'pg_toast')	
) DB  
On J.table_schema= DB.table_schema And J.table_name = DB.table_name And J.index_name = DB.index_name 
where J.is_clustered <> DB.is_clustered 
And (ScriptIndexes.index_name = J.index_name); --PG wants an explicit join of the updated table to its alias 





---End Of index And index columns flags update--------------------


--Foreign Keys
perform  n.nspname ,c.relname
FROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname like 'pg_temp_%' AND c.relname='scriptfks' AND pg_catalog.pg_table_is_visible(c.oid);
IF FOUND THEN
	DROP TABLE ScriptFKs;
END IF;
CREATE TEMP TABLE ScriptFKs
(
	fkey_table_schema character varying(128) not null,
	fkey_table_name character varying(128) not null,
	fk_name character varying(128) not null,
	rkey_table_schema character varying(128) null, --null because can insert extra FKs, to drop
	rkey_table_name character varying(128)  null,
	is_not_for_replication bit null,
	is_not_for_replication_diff bit null,
	is_not_trusted bit null,
	is_not_trusted_diff bit null,
	delete_referential_action smallint null,
	delete_referential_action_diff boolean null,
	update_referential_action smallint null,
	update_referential_action_diff boolean null,
	is_system_named bit null,
	is_system_named_diff boolean null,
	underlying_index_diff boolean null,
	SQL_CREATE character varying null,
	fkStat smallint null,
	col_diff boolean null,
	db_col_diff boolean null,
	indx_col_diff boolean null
);

--FK Column
perform  n.nspname ,c.relname
FROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname like 'pg_temp_%' AND c.relname='scriptfkcols' AND pg_catalog.pg_table_is_visible(c.oid);
IF FOUND THEN
	DROP TABLE ScriptFKCols;
END IF;
CREATE TEMP TABLE ScriptFKCols
(
	fkey_table_schema character varying(128) not null,
	fkey_table_name character varying(128) not null,
	fk_name character varying(128) not null,
	rkey_table_schema character varying(128) not null,
	rkey_table_name character varying(128) not null,
	fkey_col_name character varying(128) not  null,
	rkey_col_name character varying(128) not  null,
	fkColStat smallint null
);


--FKs only on Johannes database (need to add)
UPDATE  ScriptFKs SET fkStat = 1 
FROM    ScriptFKs J  
LEFT JOIN ( SELECT fk.conname as fkey_name, ns.nspname as fkey_table_schema, t.relname as fkey_table_name 
	FROM pg_catalog.pg_constraint fk 
	inner join pg_class t on fk.conrelid = t.oid 
	inner join pg_namespace ns on ns.oid = t.relnamespace 
	inner join pg_class t_f on fk.confrelid=t_f.oid 
	inner join pg_namespace ns_f on ns_f.oid = t_f.relnamespace 
	where fk.contype = 'f'
	AND ns.nspname || t.relname IN ('jonfamily')  
) DB ON LOWER(J.fkey_table_schema) = LOWER(DB.fkey_table_schema)  
AND LOWER(J.fkey_table_name) = LOWER(DB.fkey_table_name)  
AND LOWER(J.fk_name) = LOWER(DB.fkey_name) 
WHERE DB.fkey_table_name Is NULL AND ScriptFKs.fk_name = J.fk_name; --PG wants an explicit join of the updated table to its alias 

--FKs only on DB (need to drop) 
INSERT  INTO ScriptFks   ( fkey_table_schema ,fkey_table_name,fk_name,fkStat)  
SELECT  DB.fkey_table_schema, DB.fkey_table_name, DB.fkey_name,2  
FROM    ScriptFks J  
RIGHT JOIN ( SELECT fk.conname as fkey_name, ns.nspname as fkey_table_schema, t.relname as fkey_table_name 
	FROM pg_catalog.pg_constraint fk
	inner join pg_class t on fk.conrelid = t.oid 
	inner join pg_namespace ns on ns.oid = t.relnamespace 
	inner join pg_class t_f on fk.confrelid=t_f.oid 
	inner join pg_namespace ns_f on ns_f.oid = t_f.relnamespace 
	where fk.contype = 'f' 
AND ns.nspname || t.relname  IN ('jonfamily') 
) DB ON LOWER(J.fkey_table_schema) = LOWER(DB.fkey_table_schema)  
AND LOWER(J.fkey_table_name) = LOWER(DB.fkey_table_name)  
AND LOWER(J.fk_name) = LOWER(DB.fkey_name)  
WHERE J.fkey_table_name Is NULL; 

--FK Cols only on Johannes database (need to add) 

--FK Columns only on DB (need to drop)  

---updates of FK flags--------------------

--delete_referential_action 
UPDATE ScriptFKs SET delete_referential_action_diff=true,fkStat=3  
    from ScriptFKs J INNER join (
	    SELECT fk.conname as fkey_name, ns.nspname as fkey_table_schema, t.relname as fkey_table_name,
	    CASE fk.confdeltype
	    WHEN 'c' THEN 1
	    ELSE 0
	    END AS delete_referential_action,
	    CASE fk.confupdtype
	    WHEN 'c' THEN 1
	    ELSE 0
	    END AS update_referential_action	
	    FROM pg_catalog.pg_constraint fk 
		    inner join pg_class t on fk.conrelid = t.oid
		    inner join pg_namespace ns on ns.oid = t.relnamespace
	    where fk.contype = 'f'
    ) DB   
    on LOWER(J.fkey_table_schema) = LOWER(DB.fkey_table_schema) and LOWER(J.fkey_table_name) = LOWER(DB.fkey_table_name) and LOWER(J.fk_name) = LOWER(DB.fkey_name )
    where J.delete_referential_action <> DB.delete_referential_action  AND ScriptFKs.fk_name = J.fk_name; --PG wants an explicit join of the updated table to its alias 

--update_referential_action 
UPDATE ScriptFKs SET update_referential_action_diff=true,fkStat=3  
    from ScriptFKs J INNER join (
	    SELECT fk.conname as fkey_name, ns.nspname as fkey_table_schema, t.relname as fkey_table_name,
	    CASE fk.confdeltype
	    WHEN 'c' THEN 1
	    ELSE 0
	    END AS delete_referential_action,
	    CASE fk.confupdtype
	    WHEN 'c' THEN 1
	    ELSE 0
	    END AS update_referential_action	
	    FROM pg_catalog.pg_constraint fk 
		    inner join pg_class t on fk.conrelid = t.oid
		    inner join pg_namespace ns on ns.oid = t.relnamespace
	    where fk.contype = 'f'
    ) DB   
    on LOWER(J.fkey_table_schema) = LOWER(DB.fkey_table_schema) and LOWER(J.fkey_table_name) = LOWER(DB.fkey_table_name) and LOWER(J.fk_name) = LOWER(DB.fkey_name )
    where J.update_referential_action <> DB.update_referential_action AND ScriptFKs.fk_name = J.fk_name; --PG wants an explicit join of the updated table to its alias 

---done with FK flags--------------------

--A special FK case: FKs are a match but index 'under' it is not: it needs to be dropped and then re-added before the index:
UPDATE  ScriptFKs 
Set     underlying_index_diff = True , 
fkStat = 3 
FROM    ScriptFKs FK 
INNER Join ScriptFKCols FKC ON FK.fk_name = FKC.fk_name 
INNER Join ScriptIndexesCols IC ON LOWER(FKC.rkey_table_schema) = LOWER(IC.table_schema) 
And LOWER(FKC.rkey_table_name) = LOWER(IC.table_name) 
 And FKC.rkey_col_name = IC.col_name 
INNER Join ScriptIndexes I ON LOWER(I.index_name) = LOWER(IC.index_name) 
WHERE   I.indexStat Is Not NULL 
And FK.fkStat Is NULL  AND ScriptFKs.fk_name = FK.fk_name; --PG wants an explicit join of the updated table to its alias  
---done special case of FK equal but index on same columns is not----------------------


--wherever got FK columns that are different, mark the FK As different 
UPDATE ScriptFKs Set col_diff = True  
FROM ScriptFKs FK INNER JOIN ScriptFKCols FKC On LOWER(FK.fkey_table_schema) = LOWER(FKC.fkey_table_schema) And LOWER(FK.fkey_table_name) = LOWER(FKC.fkey_table_name) And LOWER(FK.fk_name) = LOWER(FKC.fk_name)  
WHERE FKC.fkColStat Is Not NULL And FK.fkStat Not In (1, 2); 

--wherever got cols that are different that the FK uses, mark the FK so can be dropped And re-created after the column Is altered 
UPDATE ScriptFKs Set db_col_diff = True  
FROM ScriptFKs FK INNER JOIN ScriptFKCols FKC On FK.fkey_table_schema=FKC.fkey_table_schema And FK.fkey_table_name=FKC.fkey_table_name And FK.fk_name=FKC.fk_name  
INNER JOIN ScriptCols C On  LOWER(FK.fkey_table_schema) = LOWER(C.table_schema) And LOWER(FK.fkey_table_name) = LOWER(C.table_name) And LOWER(FKC.fkey_col_name) = LOWER(C.col_name) 
WHERE c.colStat = 3 And FK.fkStat Is NULL Or FK.fkStat = 3  AND ScriptFKs.fk_name = FK.fk_name; --PG wants an explicit join of the updated table to its alias 

--...And other side:
UPDATE ScriptFKs SET db_col_diff = True 
FROM ScriptFKs FK 
INNER JOIN ScriptFKCols FKC ON FK.fkey_table_schema=FKC.fkey_table_schema AND FK.fkey_table_name=FKC.fkey_table_name AND FK.fk_name=FKC.fk_name 
INNER JOIN ScriptCols C ON LOWER(FK.rkey_table_schema) = LOWER(C.table_schema) AND LOWER(FK.rkey_table_name) = LOWER(C.table_name) AND LOWER(FKC.rkey_col_name) = LOWER(C.col_name) 
WHERE c.colStat = 3 And FK.fkStat Is NULL Or FK.fkStat = 3  AND ScriptFKs.fk_name = FK.fk_name; --PG wants an explicit join of the updated table to its alias 

--see if there are index changes that are on any columns that this FK is using. this would also mean we need to drop\recreate this FK
update ScriptFKs set indx_col_diff = True
FROM ScriptFKs FK
INNER JOIN ScriptFKCols FKC ON FK.fkey_table_schema=FKC.fkey_table_schema AND FK.fkey_table_name=FKC.fkey_table_name AND FK.fk_name=FKC.fk_name 
inner join ScriptIndexesCols IC on FKC.fkey_table_schema = IC.table_schema AND FKC.fkey_table_name = IC.table_name AND FKC.fkey_col_name=IC.col_name 
inner join ScriptIndexes I on IC.table_schema = I.table_schema AND IC.table_name = I.table_name AND IC.index_name=I.index_name 
WHERE I.indexStat = 3 And FK.fkStat Is NULL Or FK.fkStat = 3;
--...and other side: 
update ScriptFKs set indx_col_diff= True 
FROM ScriptFKs FK 
INNER JOIN ScriptFKCols FKC ON FK.rkey_table_schema=FKC.rkey_table_schema AND FK.rkey_table_name=FKC.rkey_table_name AND FK.fk_name=FKC.fk_name  
inner join ScriptIndexesCols IC on FKC.rkey_table_schema = IC.table_schema AND FKC.rkey_table_name = IC.table_name AND FKC.rkey_col_name=IC.col_name 
inner join ScriptIndexes I on LOWER(IC.table_schema) = LOWER(I.table_schema) AND LOWER(IC.table_name) = LOWER(I.table_name) AND LOWER(IC.index_name) = LOWER(I.index_name) 
WHERE I.indexStat = 3 And FK.fkStat Is NULL Or FK.fkStat = 3 AND ScriptFKs.fk_name = FK.fk_name; --PG wants an explicit join of the updated table to its alias 


--bubble up differenecs to table
UPDATE ScriptTables SET fk_diff = True 
FROM ScriptTables T INNER JOIN ScriptFKs FK ON LOWER(t.table_schema) = LOWER(FK.fkey_table_schema) AND LOWER(t.table_name) = LOWER(FK.fkey_table_name) 
WHERE FK.col_diff = true Or FK.db_col_diff = true OR indx_col_diff = true OR fkstat = 3 AND (ScriptTables.table_schema = T.table_schema AND ScriptTables.table_name = T.table_name); --PG wants an explicit join of the updated table to its alias 
---end of foreign keys and forein key columns flags update--------------------
--End DB State Temp Tables for Tables

--Adding Tables--------------------------------------------------------------------
declare temprow record;
BEGIN
	FOR temprow IN 
		Select s.table_schema , s.table_name, s.SQL_CREATE 
		FROM ScriptTables s
		WHERE tableStat = 1
LOOP
	IF (print=True) THEN
		INSERT INTO scriptoutput (SQLText)
		VALUES ('--Adding table ' || temprow.table_schema || '.' || temprow.table_name );
	END IF;
	IF (printExec = True) THEN 
		INSERT INTO scriptoutput (SQLText)
		VALUES (temprow.SQL_CREATE);
	END IF;
	IF (execCode = True) THEN
		EXECUTE temprow.SQL_CREATE;
	END IF;
	schemaChanged = True;


	END LOOP;
END; --of cursor 

--Pre-Dropping Foreign keys (some might be added later)---------------------------------------------------------------
--Dropping foreign keys that are different or their columns are different
	declare temprow record;
	BEGIN
		FOR temprow IN
	SELECT  FK.fkey_table_schema , 
		FK.fkey_table_name, 
		FK.fk_name 
	FROM    ScriptFKs  FK INNER JOIN ScriptTables T on LOWER(FK.fkey_table_schema) = LOWER(T.table_schema) AND LOWER(FK.fkey_table_name) = LOWER(T.table_name) 
	WHERE (fkStat in (2,3) or FK.col_diff=true or db_col_diff=true OR indx_col_diff=true) AND (T.tableStat NOT IN (2) OR T.tableStat IS NULL)--extra, different, or diferent in index columns or in DB columns (meaning they require index, so cannot have index on them) also changes on indexes that are on columns tha tthis FK uses (requires re-creating the FK)
		LOOP
	IF (print=True) THEN
		INSERT INTO scriptoutput (SQLText)
		VALUES ('--Table ' || temprow.fkey_table_schema ||'.' || temprow.fkey_table_name || ': dropping foreign key ' || temprow.fk_name );
	END IF;
		sqlCode = 'ALTER TABLE ' || temprow.fkey_table_schema || '.' || temprow.fkey_table_name || ' DROP CONSTRAINT ' || temprow.fk_name || ';';
	IF (printExec = True) THEN 
		INSERT INTO scriptoutput (SQLText)
		VALUES (sqlCode);
	END IF;
	IF (execCode = True) THEN
		EXECUTE sqlCode;
	END IF;
	schemaChanged = True;


		END LOOP;
	END; --off 


--Pre-Dropping Indexes (some might be added later)---------------------------------------------------------------
--Dropping indexes that are different or their columns are different
	declare temprow record;
	BEGIN
		FOR temprow IN
	SELECT  I.table_schema , 
		I.table_name, 
		I.index_name, I.is_unique_constraint,I.is_primary_key 
	FROM    ScriptIndexes I INNER JOIN ScriptTables T ON LOWER(I.table_schema) = LOWER(T.table_schema) AND LOWER(I.table_name) = LOWER(T.table_name)
	WHERE (indexStat in (2,3) or I.col_diff=true or db_col_diff=true) AND (T.tableStat NOT IN (1,2) OR T.tableStat IS NULL) --extra, different, or diferent in index columns or in DB columns (meaning they require index, so cannot have index on them) 
		LOOP
		IF (temprow.is_unique_constraint = true OR temprow.is_primary_key = true) THEN 
			IF (print=True) THEN
				INSERT INTO scriptoutput (SQLText)
				VALUES ('--Table ' || temprow.table_schema || '.' || temprow.table_name || ': dropping constraint ' || temprow.index_name );
			END IF;
			sqlCode = 'ALTER TABLE ' || temprow.table_schema || '.' || temprow.table_name || ' DROP CONSTRAINT ' || temprow.index_name || ';'; 
		ELSE
			IF (print=True) THEN
				INSERT INTO scriptoutput (SQLText)
				VALUES ('--Table ' || temprow.table_schema || '.' || temprow.table_name || ': dropping index ' || temprow.index_name);
			END IF;
			sqlCode = 'DROP INDEX ' || temprow.index_name || ';'; 
		END IF;
	IF (printExec = True) THEN 
		INSERT INTO scriptoutput (SQLText)
		VALUES (sqlCode);
	END IF;
	IF (execCode = True) THEN
		EXECUTE sqlCode;
	END IF;
	schemaChanged = True;


		END LOOP;
	END; --off 


--Dropping Defaults (some might be added later)---------------------------------------------------------------
--Dropping Defaults that are different or their columns are different
	declare temprow record;
	BEGIN
		FOR temprow IN
		SELECT  D.table_schema , 
			D.table_name, 
			D.default_name, 
			D.col_name 
		FROM    ScriptDefaults D
			INNER JOIN ScriptTables T ON D.table_schema = T.table_schema AND D.table_name = T.table_name 
		WHERE (defaultStat in (2,3) OR D.col_diff=true)  --extra, different 
			AND (T.tableStat NOT IN ( 1, 2 ) OR t.tableStat IS NULL)
		LOOP 
			IF (print=True) THEN
				INSERT INTO scriptoutput (SQLText)
				VALUES ('--Table ' || temprow.table_schema || '.' || temprow.table_name || ': dropping default ' || temprow.default_name );
			END IF;
			sqlCode = 'ALTER TABLE ' || temprow.table_schema || '.' || temprow.table_name || ' ALTER COLUMN ' || temprow.col_name || ' DROP DEFAULT;'; 
			IF (printExec = True) THEN 
				INSERT INTO scriptoutput (SQLText)
				VALUES (sqlCode);
			END IF;
			IF (execCode = True) THEN
				EXECUTE sqlCode;
			END IF;
			schemaChanged = True;



		END LOOP; 
	END;


--Adding, Altering and dropping columns---------------------------------------------------------------

--Adding Columns
declare temprow record;
BEGIN
	FOR temprow IN 
		SELECT  C.table_schema , 
		C.table_name, 
		C.col_name, 
		C.SQL_CREATE 
		FROM    ScriptCols C INNER JOIN ScriptTables T on LOWER(C.table_schema) = LOWER(T.table_schema) AND LOWER(C.table_name) = LOWER(T.table_name) 
		WHERE colStat = 1 AND T.tableStat=3 
	LOOP
	IF (print=True) THEN
		INSERT INTO scriptoutput (SQLText)
		VALUES ('--Table ' || temprow.table_schema ||  '.' || temprow.table_name ||': adding column ' || temprow.col_name);
	END IF;
	IF (printExec = True) THEN 
		INSERT INTO scriptoutput (SQLText)
		VALUES (temprow.SQL_CREATE);
	END IF;
	IF (execCode = True) THEN
		EXECUTE temprow.SQL_CREATE;
	END IF;
	schemaChanged = True;


	END LOOP;
END; --of cursor 

--Altering Columns
declare temprow record;
BEGIN
	FOR temprow IN 
		SELECT  C.table_schema , 
		C.table_name, 
		C.col_name, 
		C.SQL_ALTER, 
		C.diff_descr 
		FROM  ScriptCols C
		WHERE colStat = 3
	LOOP
	IF (print=True) THEN
		INSERT INTO scriptoutput (SQLText)
		VALUES ('--Table ' || temprow.table_schema ||  '.' || temprow.table_name ||': column ' || temprow.col_name || ' needs to be changed: ' || temprow.diff_descr);
	END IF;
	IF (printExec = True) THEN 
		INSERT INTO scriptoutput (SQLText)
		VALUES (temprow.SQL_ALTER);
	END IF;
	IF (execCode = True) THEN
		EXECUTE temprow.SQL_ALTER;
	END IF;
	schemaChanged = True;


	END LOOP;
END; --of cursor 

--Dropping Columns
declare temprow record;
BEGIN
	FOR temprow IN 
	SELECT  C.table_schema , 
		C.table_name, 
		C.col_name, 
		C.SQL_DROP 
	FROM    ScriptCols C 
	WHERE colStat = 2 
	LOOP
	IF (print=True) THEN
		INSERT INTO scriptoutput (SQLText)
		VALUES ('--Table ' || temprow.table_schema ||  '.' || temprow.table_name ||': dropping column ' || temprow.col_name);
	END IF;
	IF (printExec = True) THEN 
		INSERT INTO scriptoutput (SQLText)
		VALUES (temprow.SQL_DROP);
	END IF;
	IF (execCode = True) THEN
		EXECUTE temprow.SQL_DROP;
	END IF;
	schemaChanged = True;


	END LOOP;
END; --of cursor 


--Adding Defaults---------------------------------------------------------------
	DECLARE temprow record;
	BEGIN
		FOR temprow IN
	SELECT  D.table_schema , 
		D.table_name, 
		D.default_name, 
		D.SQL_CREATE 
	FROM    ScriptDefaults  D 
	INNER JOIN ScriptTables T ON LOWER(D.table_schema) = LOWER(T.table_schema) 
	AND LOWER(D.table_name) = LOWER(T.table_name) 
	WHERE (defaultStat in (1,3) OR D.col_diff=true)--extra or different 
		AND (T.tableStat NOT IN ( 1, 2 ) OR t.tableStat IS NULL)
LOOP 
		IF (print=True) THEN
			INSERT INTO scriptoutput (SQLText)
			VALUES ('--Table [' || temprow.table_schema || '].[' || temprow.table_name || ']: adding default [' || temprow.default_name || ']');
		END IF;
		sqlCode = temprow.SQL_CREATE; 
	IF (printExec = True) THEN 
		INSERT INTO scriptoutput (SQLText)
		VALUES (sqlCode);
	END IF;
	IF (execCode = True) THEN
		EXECUTE sqlCode;
	END IF;
	schemaChanged = True;



	END LOOP;
END;

--Post-Adding Indexes (some might have been dropped before)---------------------------------------------------------------
--Add indexes: new, or ones dropped before because they were different or underlying columns where different
	declare temprow record;
	BEGIN
		FOR temprow IN
	SELECT  I.table_schema , 
		I.table_name, 
		I.index_name, 
		I.sql_create 
	FROM    ScriptIndexes I INNER JOIN ScriptTables T ON LOWER(I.table_schema) = LOWER(T.table_schema) AND LOWER(I.table_name) = LOWER(T.table_name)
	WHERE (indexStat in (1,3) OR I.col_diff=true OR db_col_diff=true) AND (T.tableStat NOT IN (1,2) OR T.tableStat IS NULL) --extra, different, or diferent in index columns or in DB columns (meaning they require index, so cannot have index on them) 
	LOOP
			IF (print=True) THEN
				INSERT INTO scriptoutput (SQLText)
				VALUES ('--Table ' || table_schema || '.' || table_name || ': adding index ' || index_name);
			END IF;
		sqlCode = temprow.SQL_CREATE; 
		IF (printExec = True) THEN 
			INSERT INTO scriptoutput (SQLText)
			VALUES (sqlCode);
		END IF;
		IF (execCode = True) THEN
			EXECUTE sqlCode;
		END IF;
		schemaChanged = True;


		END LOOP;
	END; --off 


--Post-Adding Foriegn Keys (some might be added later)---------------------------------------------------------------
--Add foreign keys: new, or ones dropped before because they were different or underlying columns where different
	declare temprow record;
	BEGIN
		FOR temprow IN
	SELECT  FK.fkey_table_schema , 
		FK.fkey_table_name, 
		FK.fk_name, 
		FK.SQL_CREATE 
	FROM    ScriptFKs FK INNER JOIN ScriptTables T on LOWER(FK.fkey_table_schema) = LOWER(T.table_schema) AND LOWER(FK.fkey_table_name) = LOWER(T.table_name) 
	WHERE (fkStat in (1,3) or FK.col_diff=True OR db_col_diff=True OR indx_col_diff=True)  AND (T.tableStat NOT IN (2) OR T.tableStat IS NULL)--extra, different, or diferent in index columns or in DB columns (meaning they require index, so cannot have index on them) also changes on indexes that are on columns tha tthis FK uses (requires re-creating the FK) AND: i do add FKs on tables just added (tableStat=1) because i dont add them in the CREATE table (maybe they ref a table that doesn't exist at that point or that needs an index added on these columns that's not there yet. FKs should be added only when all tabels and indexes are in)
		LOOP
	IF (print=True) THEN
		INSERT INTO scriptoutput (SQLText)
		VALUES ('--Table ' || temprow.fkey_table_schema || '.' || temprow.fkey_table_name || ': adding foreign key ' || temprow.fk_name);
	END IF;
		IF (printExec = True) THEN 
			INSERT INTO scriptoutput (SQLText)
			VALUES (temprow.SQL_CREATE);
		END IF;
		IF (execCode = True) THEN
			EXECUTE temprow.SQL_CREATE;
		END IF;
		schemaChanged = True;


		END LOOP;
	END; --off 


END; --overall code
$$
;select * from scriptoutput
