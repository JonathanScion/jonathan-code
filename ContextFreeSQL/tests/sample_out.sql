DO $$
------------------------Context Free Script------------------------------------------
--Parameters: @print: PRINT english description of what the script is doing
--            @printExec: PRINT the SQL statements the script generates
--            @execCode: EXECUTE the script on the database

--feel free to change these flags
	DECLARE print boolean 	:= 1; 
		printExec boolean 	:= 1; 
		execCode boolean 	:= 1;
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
	DECLARE sqlCode character varying  ; schemaChanged boolean := False;
BEGIN --overall code
	BEGIN --the code
	perform n.nspname, c.relname
	FROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
	WHERE n.nspname LIKE 'pg_temp_%' AND c.relname='scriptoutput' AND pg_catalog.pg_table_is_visible(c.oid);
	IF FOUND THEN
		DROP TABLE scriptoutput;
	END IF;
	CREATE TEMP TABLE scriptoutput
	(
		SQLText character varying
	);
	--Iterate tables, generate all code----------------
	--Creating Schemas----------------------------------------------------------------
	--Schemas
	DECLARE schema_name character varying (128);
	BEGIN --schema code
		perform n.nspname, c.relname
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

		--INSERTing all existing schemas
		INSERT INTO ScriptSchemas (schema_name,principal_name, SQL_CREATE)
		VALUES ('public','pg_database_owner',		'CREATE SCHEMA public AUTHORIZATION pg_database_owner;');
		INSERT INTO ScriptSchemas (schema_name,principal_name, SQL_CREATE)
		VALUES ('yonito','postgres',		'CREATE SCHEMA yonito AUTHORIZATION postgres;');
		INSERT INTO ScriptSchemas (schema_name,principal_name, SQL_CREATE)
		VALUES ('Yabayus','postgres',		'CREATE SCHEMA Yabayus AUTHORIZATION postgres;');
		INSERT INTO ScriptSchemas (schema_name,principal_name, SQL_CREATE)
		VALUES ('hozho','postgres',		'CREATE SCHEMA hozho AUTHORIZATION postgres;');

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
				schemaChanged := True;
				END LOOP;
			END; --FOR 
		END; --of adding new entities and ones that were modified
	END; --schema code


	--DB State Temp Tables for Tables
	BEGIN --Tables code
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
            VALUES ('public',
            'students',
            'CREATE TABLE public.students
(
studentid  integer  NOT NULL,
studentfirstname  character varying  (100)  NOT NULL,
studentlastname  character varying  (100)  NOT NULL,
studentdob  timestamp without time zone  NULL,
sideoneonly  integer  NULL
);
CREATE UNIQUE INDEX students_idx
ON public.students
(
studentfirstname,
studentlastname
)
;
ALTER TABLE public.students ADD CONSTRAINT students_pkey PRIMARY KEY
(
studentid
)
;
ALTER TABLE public.students ALTER COLUMN studentlastname SET DEFAULT ''Scion''::character varying;',
            'DROP TABLE public.students;');
		--tables only on Johannes database (need to add)
        update ScriptTables set tableStat = 1
		WHERE NOT EXISTS (
            SELECT 1 
            FROM information_schema.tables t 
            WHERE t.table_schema NOT IN ('information_schema', 'pg_catalog') 
            AND t.table_schema NOT LIKE 'pg_temp%'
            AND LOWER(t.table_schema) = LOWER(ScriptTables.table_schema) 
            AND LOWER(t.table_name) = LOWER(ScriptTables.table_name)
          );

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
		VALUES ('public',		'students',		'studentfirstname',		'character varying',		100.0,		NULL,		NULL,		False,		False,		'0',		NULL,		NULL,		'ALTER TABLE public.students ADD studentfirstname  character varying  (100)  NOT NULL ',		'ALTER TABLE public.students ALTER COLUMN studentfirstname  TYPE  character varying  (100) ,
	ALTER COLUMN studentfirstname SET  NOT NULL ','ALTER TABLE public.students DROP COLUMN studentfirstname'		);
		INSERT INTO ScriptCols (table_schema,table_name,col_name,user_type_name,max_length,precision,scale,is_nullable,is_identity,is_computed,collation_name,computed_definition, SQL_CREATE, SQL_ALTER, SQL_DROP)
		VALUES ('public',		'students',		'sideoneonly',		'integer',		NULL,		32.0,		0.0,		True,		False,		'0',		NULL,		NULL,		'ALTER TABLE public.students ADD sideoneonly  integer  NULL ',		'ALTER TABLE public.students ALTER COLUMN sideoneonly  TYPE  integer ,
	ALTER COLUMN sideoneonly SET  NULL ','ALTER TABLE public.students DROP COLUMN sideoneonly'		);
		INSERT INTO ScriptCols (table_schema,table_name,col_name,user_type_name,max_length,precision,scale,is_nullable,is_identity,is_computed,collation_name,computed_definition, SQL_CREATE, SQL_ALTER, SQL_DROP)
		VALUES ('public',		'students',		'studentdob',		'timestamp without time zone',		NULL,		NULL,		NULL,		True,		False,		'0',		NULL,		NULL,		'ALTER TABLE public.students ADD studentdob  timestamp without time zone  NULL ',		'ALTER TABLE public.students ALTER COLUMN studentdob  TYPE  timestamp without time zone ,
	ALTER COLUMN studentdob SET  NULL ','ALTER TABLE public.students DROP COLUMN studentdob'		);
		INSERT INTO ScriptCols (table_schema,table_name,col_name,user_type_name,max_length,precision,scale,is_nullable,is_identity,is_computed,collation_name,computed_definition, SQL_CREATE, SQL_ALTER, SQL_DROP)
		VALUES ('public',		'students',		'studentid',		'integer',		NULL,		32.0,		0.0,		False,		False,		'0',		NULL,		NULL,		'ALTER TABLE public.students ADD studentid  integer  NOT NULL ',		'ALTER TABLE public.students ALTER COLUMN studentid  TYPE  integer ,
	ALTER COLUMN studentid SET  NOT NULL ','ALTER TABLE public.students DROP COLUMN studentid'		);
		INSERT INTO ScriptCols (table_schema,table_name,col_name,user_type_name,max_length,precision,scale,is_nullable,is_identity,is_computed,collation_name,computed_definition, SQL_CREATE, SQL_ALTER, SQL_DROP)
		VALUES ('public',		'students',		'studentlastname',		'character varying',		100.0,		NULL,		NULL,		False,		False,		'0',		NULL,		NULL,		'ALTER TABLE public.students ADD studentlastname  character varying  (100)  NOT NULL ',		'ALTER TABLE public.students ALTER COLUMN studentlastname  TYPE  character varying  (100) ,
	ALTER COLUMN studentlastname SET  NOT NULL ','ALTER TABLE public.students DROP COLUMN studentlastname'		);
		
		--columns only on Johannes database (need to add)
UPDATE ScriptCols 
                                    SET colStat = 1
                                    WHERE NOT EXISTS (
                                        SELECT 1 
                                        FROM information_schema.tables t 
                                        INNER JOIN information_schema.columns c 
                                            ON t.table_schema = c.table_schema 
                                            AND t.table_name = c.table_name 
                                        WHERE t.table_schema NOT IN ('information_schema', 'pg_catalog') 
                                        AND t.table_schema NOT LIKE 'pg_temp%'  
                                        AND t.table_type LIKE '%TABLE%'
                                        AND LOWER(t.table_schema) = LOWER(ScriptCols.table_schema) 
                                        AND LOWER(t.table_name) = LOWER(ScriptCols.table_name) 
                                        AND LOWER(c.column_name) = LOWER(ScriptCols.col_name)
                                    );		
		--columns only on DB (need to drop)
INSERT INTO ScriptCols (table_schema, table_name, col_name, colStat, SQL_DROP) 
		SELECT  DB.table_schema, DB.table_name, DB.column_name, 2, 'ALTER TABLE ' || DB.table_schema || '.' || DB.table_name || ' DROP COLUMN ' || DB.column_name || ';' 
		FROM    ScriptCols J 
		RIGHT JOIN ( select t.table_schema, t.table_name, c.column_name FROM information_schema.tables t INNER JOIN information_schema.columns c on t.table_schema=c.table_schema and t.table_name=c.table_name WHERE t.table_schema not in ('information_schema', 'pg_catalog') AND t.table_schema NOT LIKE 'pg_temp%'  and t.table_type LIKE '%TABLE%' 
AND C.table_schema || C.table_name IN ('publicstudents') 
		) DB ON LOWER(J.table_schema) = LOWER(DB.table_schema) 
		And LOWER(J.table_name) = LOWER(DB.table_name) 
		And LOWER(J.col_name) = LOWER(DB.column_name) 
		WHERE ( J.col_name Is NULL );  
		

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
update ScriptCols Set max_length_diff = true, colStat = 3, max_length_db=DB.CHARACTER_MAXIMUM_LENGTH, 
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
update ScriptCols Set max_length_diff = true, colStat = 3, precision_db=DB.precision, 
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
update ScriptCols Set max_length_diff = true, colStat = 3, scale_db=DB.scale, 
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
update ScriptCols Set max_length_diff = true, colStat = 3, is_nullable_db=DB.is_nullable, 
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
update ScriptCols Set max_length_diff = true, colStat = 3, is_identity_db=DB.is_identity, 
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
		
		
		
		

		--update tables where columns are different
update ScriptTables set tableStat=3 
from ScriptTables T INNER JOIN ScriptCols C on LOWER(T.table_schema) = LOWER(C.table_schema) AND LOWER(T.table_name) = LOWER(C.table_name) 
		where C.colStat IN (1,2,3) AND (T.tableStat NOT IN (1,2) OR t.tableStat IS NULL); --extra, missing, or different 
		
		--wherever got columns different, mark the tables as different
UPDATE ScriptTables SET col_diff=true
FROM ScriptTables T INNER JOIN ScriptCols C ON LOWER(T.table_schema) = LOWER(C.table_schema) AND LOWER(T.table_name) = LOWER(C.table_name)
		WHERE C.ColStat Is Not NULL AND (T.tableStat NOT IN (1,2) OR t.tableStat IS NULL);
		


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
			col_name character varying(128) not null,
			index_column_id int null,
			key_ordinal int null,
			key_ordinal_diff boolean null,
			is_descending_key boolean null,
			is_descending_key_diff boolean null,
			is_included_column boolean null,
			is_included_column_diff boolean null,
			indexColStat smallint null
		);
		
		INSERT INTO ScriptIndexes (table_schema,table_name,index_name,is_unique,is_clustered,ignore_dup_key,is_primary_key,is_unique_constraint,allow_row_locks,allow_page_locks,has_filter,filter_definition,index_columns,SQL_CREATE)
		VALUES ('public','students','students_idx',True,
		False,
		NULL,
		False,
		False,
		NULL,
		NULL,
		NULL,
		NULL,
		'studentfirstname, studentlastname',
		'CREATE UNIQUE INDEX students_idx
ON public.students
(
studentfirstname,
studentlastname
)
');
		
		--Insert Index Columns
		INSERT INTO ScriptIndexesCols (table_schema,table_name,index_name,col_name,index_column_id,key_ordinal,is_descending_key,is_included_column)
		VALUES ('public','students','students_idx','studentfirstname',
		'1',
		'1',
		False,
		'False');
		
		INSERT INTO ScriptIndexesCols (table_schema,table_name,index_name,col_name,index_column_id,key_ordinal,is_descending_key,is_included_column)
		VALUES ('public','students','students_idx','studentlastname',
		'2',
		'2',
		False,
		'False');
		
		INSERT INTO ScriptIndexes (table_schema,table_name,index_name,is_unique,is_clustered,ignore_dup_key,is_primary_key,is_unique_constraint,allow_row_locks,allow_page_locks,has_filter,filter_definition,index_columns,SQL_CREATE)
		VALUES ('public','students','students_pkey',True,
		False,
		NULL,
		True,
		False,
		NULL,
		NULL,
		NULL,
		NULL,
		'studentid',
		'ALTER TABLE public.students ADD CONSTRAINT students_pkey PRIMARY KEY
(
studentid
)
');
		
		--Insert Index Columns
		INSERT INTO ScriptIndexesCols (table_schema,table_name,index_name,col_name,index_column_id,key_ordinal,is_descending_key,is_included_column)
		VALUES ('public','students','students_pkey','studentid',
		'1',
		'1',
		False,
		'False');
		
		--Indexes only on Johannes database (need to add)
UPDATE ScriptIndexes 
                SET indexStat = 1
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM pg_index ix
                    INNER JOIN pg_class i ON i.oid = ix.indexrelid
                    INNER JOIN pg_class t ON t.oid = ix.indrelid
                    INNER JOIN pg_namespace scm ON t.relnamespace = scm.oid
                    WHERE scm.nspname || t.relname IN ('publicstudents')
                    AND LOWER(scm.nspname) = LOWER(ScriptIndexes.table_schema)
                    AND LOWER(t.relname) = LOWER(ScriptIndexes.table_name)
                    AND LOWER(i.relname) = LOWER(ScriptIndexes.index_name)
                );
		
		--Indexes only on DB (need to drop)
		INSERT INTO ScriptIndexes (table_schema, table_name, index_name, is_unique_constraint, is_primary_key, indexStat)
		SELECT DB.table_schema, DB.table_name, DB.index_name, DB.is_unique_constraint, DB.is_primary_key, 2
		FROM ScriptIndexes J
		RIGHT JOIN ( SELECT
		scm.nspname || '.' || t.relname as object_id, i.oid as index_oid,
		scm.nspname AS table_schema,
		t.relname AS table_name,
		i.relname as index_name,
		CASE cnst.contype WHEN 'u' THEN True ELSE False END as is_unique_constraint,
		indisprimary as is_primary_key
		FROM pg_index ix
		INNER JOIN pg_class i ON i.oid = ix.indexrelid
		INNER JOIN pg_class t ON t.oid = ix.indrelid
		INNER JOIN pg_namespace scm ON t.relnamespace = scm.oid
		INNER JOIN pg_class cls ON cls.oid = ix.indexrelid
		INNER JOIN pg_am am ON am.oid = cls.relam
		INNER JOIN pg_indexes idx ON idx.schemaname = scm.nspname AND idx.tablename = t.relname AND idx.indexname = i.relname
		LEFT JOIN pg_constraint cnst ON t.oid = cnst.conrelid AND i.oid = cnst.conindid AND cnst.contype = 'u'
		WHERE scm.nspname || t.relname IN ('publicstudents')
		) DB ON LOWER(J.table_schema) = LOWER(DB.table_schema)
		AND LOWER(J.table_name) = LOWER(DB.table_name)
		AND LOWER(J.index_name) = LOWER(DB.index_name)
		WHERE J.table_name IS NULL;
		
UPDATE ScriptIndexes 
SET is_unique_diff = True, indexStat = 3
WHERE EXISTS (
    SELECT 1
    FROM pg_index ix
    INNER JOIN pg_class i ON i.oid = ix.indexrelid
    INNER JOIN pg_class t ON t.oid = ix.indrelid
    INNER JOIN pg_namespace scm ON t.relnamespace = scm.oid
    INNER JOIN pg_class cls ON cls.oid = ix.indexrelid
    INNER JOIN pg_am am ON am.oid = cls.relam
    INNER JOIN pg_indexes idx ON idx.schemaname = scm.nspname 
                              AND idx.tablename = t.relname 
                              AND idx.indexname = i.relname
    LEFT JOIN pg_constraint cnst ON t.oid = cnst.conrelid 
                                 AND i.oid = cnst.conindid 
                                 AND cnst.contype = 'u'
    WHERE scm.nspname || t.relname IN ('publicstudents')
      AND LOWER(scm.nspname) = LOWER(ScriptIndexes.table_schema)
      AND LOWER(t.relname) = LOWER(ScriptIndexes.table_name)
      AND LOWER(i.relname) = LOWER(ScriptIndexes.index_name)
      AND ScriptIndexes.index_columns <> substring(idx.indexdef, '\((.*?)\)'));		
		---updates Of index And index columns flags--------------------
		---updates Of index flags--------------------
		--is_unique
		update ScriptIndexes Set is_unique_diff=True, indexStat = 3
		From ScriptIndexes J INNER Join
		(
		Select
		scm.nspname || '.' || t.relname as object_id, i.oid as index_oid,
		scm.nspname AS table_schema,
		t.relname AS table_name,
		i.relname as index_name, i.relname AS name,
		ix.indisunique as is_unique,
		indisclustered as is_clustered
		from
		pg_index ix
		inner Join pg_class i ON i.oid = ix.indexrelid
		inner Join pg_class t on t.oid = ix.indrelid
		inner Join pg_namespace scm on t.relnamespace = scm.oid
		where scm.nspname Not in ('pg_catalog','information_schema', 'pg_toast')
		) DB
		On J.table_schema= DB.table_schema And J.table_name = DB.table_name And J.index_name = DB.index_name
		where J.is_unique <> DB.is_unique
		And (ScriptIndexes.index_name = J.index_name);
		
		--is_clustered
		update ScriptIndexes Set is_clustered_diff=True, indexStat = 3
		From ScriptIndexes J INNER Join
		(
		Select
		scm.nspname || '.' || t.relname as object_id, i.oid as index_oid,
		scm.nspname AS table_schema,
		t.relname AS table_name,
		i.relname as index_name, i.relname AS name,
		ix.indisunique as is_unique,
		indisclustered as is_clustered
		from
		pg_index ix
		inner Join pg_class i ON i.oid = ix.indexrelid
		inner Join pg_class t on t.oid = ix.indrelid
		inner Join pg_namespace scm on t.relnamespace = scm.oid
		where scm.nspname Not in ('pg_catalog','information_schema', 'pg_toast')
		) DB
		On J.table_schema= DB.table_schema And J.table_name = DB.table_name And J.index_name = DB.index_name
		where J.is_clustered <> DB.is_clustered
		And (ScriptIndexes.index_name = J.index_name);
		---End Of index And index columns flags update--------------------


		--Foreign Keys
		perform  n.nspname ,c.relname
		FROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
		WHERE n.nspname like 'pg_temp_%' AND c.relname='scriptfks' AND pg_catalog.pg_table_is_visible(c.oid);
		IF FOUND THEN
			DROP TABLE scriptfks;
		END IF;
		CREATE TEMP TABLE scriptfks
		(
			fkey_table_schema character varying(128) not null,
			fkey_table_name character varying(128) not null,
			fk_name character varying(128) not null,
			rkey_table_schema character varying(128) null, --null because can insert extra FKs, to drop
			rkey_table_name character varying(128) null,
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
			DROP TABLE scriptfkcols;
		END IF;
		CREATE TEMP TABLE scriptfkcols
		(
			fkey_table_schema character varying(128) not null,
			fkey_table_name character varying(128) not null,
			fk_name character varying(128) not null,
			rkey_table_schema character varying(128) not null,
			rkey_table_name character varying(128) not null,
			fkey_col_name character varying(128) not null,
			rkey_col_name character varying(128) not null,
			fkColStat smallint null
		);
		
		
		--FKs only on Johannes database (need to add)
UPDATE scriptfks 
                SET fkStat = 1
                WHERE NOT EXISTS (
                    SELECT 1 
                    FROM pg_catalog.pg_constraint fk
                    INNER JOIN pg_class t ON fk.conrelid = t.oid
                    INNER JOIN pg_namespace ns ON ns.oid = t.relnamespace
                    INNER JOIN pg_class t_f ON fk.confrelid = t_f.oid
                    INNER JOIN pg_namespace ns_f ON ns_f.oid = t_f.relnamespace
                    WHERE fk.contype = 'f'
                    AND ns.nspname || t.relname IN ('publicstudents')
                    AND LOWER(ns.nspname) = LOWER(scriptfks.fkey_table_schema)
                    AND LOWER(t.relname) = LOWER(scriptfks.fkey_table_name)
                    AND LOWER(fk.conname) = LOWER(scriptfks.fk_name)
                );
		
		--FKs only on DB (need to drop)
		INSERT INTO scriptfks (fkey_table_schema, fkey_table_name, fk_name, fkStat)
		SELECT DB.fkey_table_schema, DB.fkey_table_name, DB.fkey_name, 2
		FROM scriptfks J
		RIGHT JOIN ( SELECT fk.conname as fkey_name, ns.nspname as fkey_table_schema, t.relname as fkey_table_name
			FROM pg_catalog.pg_constraint fk
			inner join pg_class t on fk.conrelid = t.oid
			inner join pg_namespace ns on ns.oid = t.relnamespace
			inner join pg_class t_f on fk.confrelid=t_f.oid
			inner join pg_namespace ns_f on ns_f.oid = t_f.relnamespace
			where fk.contype = 'f'
			AND ns.nspname || t.relname IN ('publicstudents')
		) DB ON LOWER(J.fkey_table_schema) = LOWER(DB.fkey_table_schema)
		AND LOWER(J.fkey_table_name) = LOWER(DB.fkey_table_name)
		AND LOWER(J.fk_name) = LOWER(DB.fkey_name)
		WHERE J.fkey_table_name Is NULL;
		
		--FK Cols only on Johannes database (need to add)
		
		--FK Columns only on DB (need to drop)
		
		---updates of FK flags--------------------
		
		
		--delete_referential_action
		UPDATE scriptfks SET delete_referential_action_diff=true,fkStat=3
		from scriptfks J INNER join (
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
		on LOWER(J.fkey_table_schema) = LOWER(DB.fkey_table_schema) and LOWER(J.fkey_table_name) = LOWER(DB.fkey_table_name) and LOWER(J.fk_name) = LOWER(DB.fkey_name)
		where J.delete_referential_action <> DB.delete_referential_action AND scriptfks.fk_name = J.fk_name;
		
		--update_referential_action
		UPDATE scriptfks SET update_referential_action_diff=true,fkStat=3
		from scriptfks J INNER join (
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
		on LOWER(J.fkey_table_schema) = LOWER(DB.fkey_table_schema) and LOWER(J.fkey_table_name) = LOWER(DB.fkey_table_name) and LOWER(J.fk_name) = LOWER(DB.fkey_name)
		where J.update_referential_action <> DB.update_referential_action AND scriptfks.fk_name = J.fk_name;
		
		---done with FK flags--------------------
		
		--A special FK case: FKs are a match but index 'under' it is not: it needs to be dropped and then re-added before the index:
		UPDATE scriptfks
		Set underlying_index_diff = True,
		fkStat = 3
		FROM scriptfks FK
		INNER Join scriptfkcols FKC ON FK.fk_name = FKC.fk_name
		INNER Join ScriptIndexesCols IC ON LOWER(FKC.rkey_table_schema) = LOWER(IC.table_schema)
		And LOWER(FKC.rkey_table_name) = LOWER(IC.table_name)
		And FKC.rkey_col_name = IC.col_name
		INNER Join ScriptIndexes I ON LOWER(I.index_name) = LOWER(IC.index_name)
		WHERE I.indexStat Is Not NULL
		And FK.fkStat Is NULL AND scriptfks.fk_name = FK.fk_name;
		---done special case of FK equal but index on same columns is not----------------------
		

		--wherever got FK columns that are different, mark the FK As different
		UPDATE scriptfks Set col_diff = True
		FROM scriptfks FK INNER JOIN scriptfkcols FKC On LOWER(FK.fkey_table_schema) = LOWER(FKC.fkey_table_schema) And LOWER(FK.fkey_table_name) = LOWER(FKC.fkey_table_name) And LOWER(FK.fk_name) = LOWER(FKC.fk_name)
		WHERE FKC.fkColStat Is Not NULL And FK.fkStat Not In (1, 2);
		
		--wherever got cols that are different that the FK uses, mark the FK so can be dropped And re-created after the column Is altered
		UPDATE scriptfks Set db_col_diff = True
		FROM scriptfks FK INNER JOIN scriptfkcols FKC On FK.fkey_table_schema=FKC.fkey_table_schema And FK.fkey_table_name=FKC.fkey_table_name And FK.fk_name=FKC.fk_name
		INNER JOIN ScriptCols C On LOWER(FK.fkey_table_schema) = LOWER(C.table_schema) And LOWER(FK.fkey_table_name) = LOWER(C.table_name) And LOWER(FKC.fkey_col_name) = LOWER(C.col_name)
		WHERE c.colStat = 3 And FK.fkStat Is NULL Or FK.fkStat = 3 AND scriptfks.fk_name = FK.fk_name;
		
		--...And other side:
		UPDATE scriptfks SET db_col_diff = True
		FROM scriptfks FK
		INNER JOIN scriptfkcols FKC ON FK.fkey_table_schema=FKC.fkey_table_schema AND FK.fkey_table_name=FKC.fkey_table_name AND FK.fk_name=FKC.fk_name
		INNER JOIN ScriptCols C ON LOWER(FK.rkey_table_schema) = LOWER(C.table_schema) AND LOWER(FK.rkey_table_name) = LOWER(C.table_name) AND LOWER(FKC.rkey_col_name) = LOWER(C.col_name)
		WHERE c.colStat = 3 And FK.fkStat Is NULL Or FK.fkStat = 3 AND scriptfks.fk_name = FK.fk_name;
		
		--see if there are index changes that are on any columns that this FK is using. this would also mean we need to drop-recreate this FK
		update scriptfks set indx_col_diff = True
		FROM scriptfks FK
		INNER JOIN scriptfkcols FKC ON FK.fkey_table_schema=FKC.fkey_table_schema AND FK.fkey_table_name=FKC.fkey_table_name AND FK.fk_name=FKC.fk_name
		inner join ScriptIndexesCols IC on FKC.fkey_table_schema = IC.table_schema AND FKC.fkey_table_name = IC.table_name AND FKC.fkey_col_name=IC.col_name
		inner join ScriptIndexes I on IC.table_schema = I.table_schema AND IC.table_name = I.table_name AND IC.index_name=I.index_name
		WHERE I.indexStat = 3 And FK.fkStat Is NULL Or FK.fkStat = 3;
		--...and other side:
		update scriptfks set indx_col_diff= True
		FROM scriptfks FK
		INNER JOIN scriptfkcols FKC ON FK.rkey_table_schema=FKC.rkey_table_schema AND FK.rkey_table_name=FKC.rkey_table_name AND FK.fk_name=FKC.fk_name
		inner join ScriptIndexesCols IC on FKC.rkey_table_schema = IC.table_schema AND FKC.rkey_table_name = IC.table_name AND FKC.rkey_col_name=IC.col_name
		inner join ScriptIndexes I on LOWER(IC.table_schema) = LOWER(I.table_schema) AND LOWER(IC.table_name) = LOWER(I.table_name) AND LOWER(IC.index_name) = LOWER(I.index_name)
		WHERE I.indexStat = 3 And FK.fkStat Is NULL Or FK.fkStat = 3 AND scriptfks.fk_name = FK.fk_name;
		

	End; --DB State Temp Tables for Tables




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
	schemaChanged := True;
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
	schemaChanged := True;
		END LOOP;
	END; --off 



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
	schemaChanged := True;
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
	schemaChanged := True;
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
	schemaChanged := True;
	END LOOP;
END; --of cursor 



--Data-----------------------------------------------------------------------------
DECLARE _cmprstate_ smallint;
DECLARE NumNonEqualRecs INT;
public_students_JustCreated boolean := false; --This flag is used in case the script was doing schema, and this table was just created. this script is not doing schema for 'public.students'so the table wasn't just created. set it to 1 if it did, in which case the script will just do a bunch of INSERTs as against comparing to existing data
BEGIN --Data Code
IF (schemaChanged=True and execCode=False) THEN
	IF (print=True) THEN
		INSERT INTO scriptoutput (SQLText)
		VALUES ('--Note: Changes were found in the schema but not executed (because execution flag is turned off) - Data migration may therefore not work');
	END IF;
END IF;
perform 1 from scripttables T WHERE T.table_schema='public' AND T.table_name='students' AND tablestat=1;
IF FOUND THEN
	public_students_JustCreated := true;
ELSE
	public_students_JustCreated := false;
END IF;

perform n.nspname, c.relname
FROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname like 'pg_temp_%' AND c.relname='public_students' AND pg_catalog.pg_table_is_visible(c.oid);
IF FOUND THEN
	DROP TABLE public_students;
END IF;
IF (printExec=True AND execCode=False AND public_students_JustCreated=True) THEN --Table was just created, but we want to print and not execute (so its not really created, can't really compare against existing data, table is not there
	--we are in PRINT mode here. Table needs to be created but wasn't (because we're printing, not executing) so just spew out the full INSERT statements
		INSERT INTO scriptoutput (SQLText)
		VALUES ('--INSERT INTO public.students (studentid,studentfirstname,studentlastname,studentdob,sideoneonly)
 VALUES (''1'',''murfi J'',''Sion'',''1979-08-15 00:00:00.000'',NULL);');
		INSERT INTO scriptoutput (SQLText)
		VALUES ('--INSERT INTO public.students (studentid,studentfirstname,studentlastname,studentdob,sideoneonly)
 VALUES (''2'',''Raz-Or'',''Sion'',''1976-12-27 00:00:00.000'',NULL);');
		INSERT INTO scriptoutput (SQLText)
		VALUES ('--INSERT INTO public.students (studentid,studentfirstname,studentlastname,studentdob,sideoneonly)
 VALUES (''3'',''Yan'',''Scion'',''1973-09-15 00:00:00.000'',NULL);');
		INSERT INTO scriptoutput (SQLText)
		VALUES ('--INSERT INTO public.students (studentid,studentfirstname,studentlastname,studentdob,sideoneonly)
 VALUES (''4'',''Dodo'',''oh no'',''1970-03-13 00:00:00.000'',NULL);');
		INSERT INTO scriptoutput (SQLText)
		VALUES ('--INSERT INTO public.students (studentid,studentfirstname,studentlastname,studentdob,sideoneonly)
 VALUES (''94'',''Dodo'',''nada-ed'',''1970-03-13 00:00:00.000'',NULL);');

--END IF;--of Batch INSERT of all the data into public.students
ELSE --and this begins the INSERT as against potentially existing data
--Data for 'public.students'
CREATE TEMP TABLE public_students
(
studentid  integer  NULL,
studentfirstname  character varying  (100)  NULL,
studentlastname  character varying  (100)  NULL,
studentdob  timestamp without time zone  NULL,
sideoneonly  integer  NULL
);

INSERT INTO public_students (
studentid,studentfirstname,studentlastname,studentdob,sideoneonly)
 VALUES ('1','murfi J','Sion','1979-08-15 00:00:00.000',NULL);
INSERT INTO public_students (
studentid,studentfirstname,studentlastname,studentdob,sideoneonly)
 VALUES ('2','Raz-Or','Sion','1976-12-27 00:00:00.000',NULL);
INSERT INTO public_students (
studentid,studentfirstname,studentlastname,studentdob,sideoneonly)
 VALUES ('3','Yan','Scion','1973-09-15 00:00:00.000',NULL);
INSERT INTO public_students (
studentid,studentfirstname,studentlastname,studentdob,sideoneonly)
 VALUES ('4','Dodo','oh no','1970-03-13 00:00:00.000',NULL);
INSERT INTO public_students (
studentid,studentfirstname,studentlastname,studentdob,sideoneonly)
 VALUES ('94','Dodo','nada-ed','1970-03-13 00:00:00.000',NULL);

--add status field, and update it:
ALTER TABLE public_students ADD _cmprstate_ smallint NULL;
--Records to be added:
UPDATE public_students orig SET _cmprstate_=1 FROM public_students t LEFT JOIN public.students p ON t.studentid=p.studentid WHERE orig.studentid = t.studentid  AND p.studentid IS NULL;
--add all missing records:
IF (execCode=True) THEN
	sqlCode := 'INSERT INTO public.students(studentid, studentfirstname, studentlastname, studentdob, sideoneonly)
 SELECT studentid, studentfirstname, studentlastname, studentdob, sideoneonly FROM public_students WHERE _cmprstate_=1';
	EXECUTE sqlCode;
END IF; --of INSERTing into public.students

--generating individual DML statements: INSERTS
IF (printExec=True) THEN --only if asked to print, since that's the only reason they are here
	PERFORM 1 from public_students s WHERE s._cmprstate_=1;
	IF FOUND THEN
		declare temprow record;
		BEGIN
			FOR temprow IN
				SELECT studentid,studentfirstname,studentlastname,studentdob,sideoneonly FROM public_students s WHERE s._cmprstate_=1
		LOOP
			sqlCode='INSERT INTO public.students (studentid, studentfirstname, studentlastname, studentdob, sideoneonly) VALUES (';
			IF (temprow.studentid IS NULL) THEN
				sqlCode = sqlCode || 'NULL';
			ELSE
				sqlCode = sqlCode || CAST(temprow.studentid AS varchar(30));
			END IF;

			sqlCode = sqlCode || ','; 
			IF (temprow.studentfirstname IS NULL) THEN
				sqlCode = sqlCode || 'NULL';
			ELSE
				sqlCode = sqlCode || '''' || temprow.studentfirstname ||'''';
			END IF;

			sqlCode = sqlCode || ','; 
			IF (temprow.studentlastname IS NULL) THEN
				sqlCode = sqlCode || 'NULL';
			ELSE
				sqlCode = sqlCode || '''' || temprow.studentlastname ||'''';
			END IF;

			sqlCode = sqlCode || ','; 
			IF (temprow.studentdob IS NULL) THEN
				sqlCode = sqlCode || 'NULL';
			ELSE
				sqlCode = sqlCode || '''' || CAST(temprow.studentdob AS varchar(30)) || '''';
			END IF;

			sqlCode = sqlCode || ','; 
			IF (temprow.sideoneonly IS NULL) THEN
				sqlCode = sqlCode || 'NULL';
			ELSE
				sqlCode = sqlCode || CAST(temprow.sideoneonly AS varchar(30));
			END IF;

			sqlCode = sqlCode ||  ')';
			IF (printExec=True) THEN
				INSERT INTO scriptoutput (SQLText)
				VALUES (sqlCode);
			END IF;
		END LOOP;
	END; --of loop block 
END IF; --of IF FOUND record iteration (temprow) 
END IF; --of generating DML statements: INSERT for public.students
END IF;--of INSERT as against potentially existing data

--Records to be deleted or removed: Do not even check if the table was just created
IF (public_students_JustCreated=False) THEN --Records to be deleted or removed: do not even check if the table was just created
--records to be removed:
sqlCode :='INSERT INTO public_students (
studentid, studentfirstname, studentlastname, studentdob, sideoneonly, _cmprstate_) SELECT p.studentid, p.studentfirstname, p.studentlastname, p.studentdob, p.sideoneonly, ''2'' FROM public.students p LEFT JOIN public_students t ON p.studentid=t.studentid WHERE (t.studentid IS NULL)';
EXECUTE sqlCode;
IF NOT (printExec=True AND execCode=False AND public_students_JustCreated=True) THEN --Table was just created, but we want to print and not execute (so its not really created, can't really compare against existing data, table is not there
--remove all extra records:
If (execCode=True) THEN
	sqlCode = 'DELETE FROM public.students orig USING public_students AS p LEFT JOIN public_students AS t ON p.studentid=t.studentid WHERE (orig.studentid=t.studentid) AND (t.studentid IS NULL OR (t._cmprstate_=2))'; --Need to check _cmprstate_ in case we've asked a 'data report', then those extra records to be deleted will actually be in the temp table
EXECUTE sqlCode;
END IF; --'of: 'remove all extra recods'
END IF; --Of 'Records to be deleted or removed: do not even check if the table was just created'
END IF; --of table was just created

--records in both: find which need to be updated
sqlCode = 'UPDATE public_students orig SET _cmprstate_=3
 FROM public_students t WHERE (
orig.studentid = t.studentid) AND ( (orig.studentfirstname<> t.studentfirstname) OR (orig.studentfirstname IS NULL AND t.studentfirstname IS NOT NULL) OR (orig.studentfirstname IS NOT NULL AND t.studentfirstname IS NULL) OR (orig.studentlastname<> t.studentlastname) OR (orig.studentlastname IS NULL AND t.studentlastname IS NOT NULL) OR (orig.studentlastname IS NOT NULL AND t.studentlastname IS NULL) OR (orig.studentdob<> t.studentdob) OR (orig.studentdob IS NULL AND t.studentdob IS NOT NULL) OR (orig.studentdob IS NOT NULL AND t.studentdob IS NULL) OR (orig.sideoneonly<> t.sideoneonly) OR (orig.sideoneonly IS NULL AND t.sideoneonly IS NOT NULL) OR (orig.sideoneonly IS NOT NULL AND t.sideoneonly IS NULL))';
EXECUTE sqlCode; --flagging the temp table with records that need to be updated

--update fields that are different:
--Updating differences in 'studentfirstname' for reporting purposes
ALTER TABLE public_students ADD _diffbit_studentfirstname Boolean NULL;
--and retaining old value for full report
ALTER TABLE public_students ADD _existingval_studentfirstname character varying  (100)  NULL;
sqlCode='UPDATE public_students orig SET _diffbit_studentfirstname = True, _cmprstate_=3
,_existingval_studentfirstname = p.studentfirstname
 FROM public.students p  WHERE (orig.studentid = p.studentid) AND ((orig.studentfirstname<> p.studentfirstname) OR (orig.studentfirstname IS NULL AND p.studentfirstname IS NOT NULL) OR (orig.studentfirstname IS NOT NULL AND p.studentfirstname IS NULL))';EXECUTE sqlCode;If (execCode=True) THEN
	sqlCode ='UPDATE public.students orig SET studentfirstname = p.studentfirstname
 FROM public_students p 
 WHERE (orig.studentid = p.studentid) AND ((orig.studentfirstname<> p.studentfirstname) OR (orig.studentfirstname IS NULL AND p.studentfirstname IS NOT NULL) OR (orig.studentfirstname IS NOT NULL AND p.studentfirstname IS NULL))';
	EXECUTE sqlCode;
END IF;
--Updating differences in 'studentlastname' for reporting purposes
ALTER TABLE public_students ADD _diffbit_studentlastname Boolean NULL;
--and retaining old value for full report
ALTER TABLE public_students ADD _existingval_studentlastname character varying  (100)  NULL;
sqlCode='UPDATE public_students orig SET _diffbit_studentlastname = True, _cmprstate_=3
,_existingval_studentlastname = p.studentlastname
 FROM public.students p  WHERE (orig.studentid = p.studentid) AND ((orig.studentlastname<> p.studentlastname) OR (orig.studentlastname IS NULL AND p.studentlastname IS NOT NULL) OR (orig.studentlastname IS NOT NULL AND p.studentlastname IS NULL))';EXECUTE sqlCode;If (execCode=True) THEN
	sqlCode ='UPDATE public.students orig SET studentlastname = p.studentlastname
 FROM public_students p 
 WHERE (orig.studentid = p.studentid) AND ((orig.studentlastname<> p.studentlastname) OR (orig.studentlastname IS NULL AND p.studentlastname IS NOT NULL) OR (orig.studentlastname IS NOT NULL AND p.studentlastname IS NULL))';
	EXECUTE sqlCode;
END IF;
--Updating differences in 'studentdob' for reporting purposes
ALTER TABLE public_students ADD _diffbit_studentdob Boolean NULL;
--and retaining old value for full report
ALTER TABLE public_students ADD _existingval_studentdob timestamp without time zone  NULL;
sqlCode='UPDATE public_students orig SET _diffbit_studentdob = True, _cmprstate_=3
,_existingval_studentdob = p.studentdob
 FROM public.students p  WHERE (orig.studentid = p.studentid) AND ((orig.studentdob<> p.studentdob) OR (orig.studentdob IS NULL AND p.studentdob IS NOT NULL) OR (orig.studentdob IS NOT NULL AND p.studentdob IS NULL))';EXECUTE sqlCode;If (execCode=True) THEN
	sqlCode ='UPDATE public.students orig SET studentdob = p.studentdob
 FROM public_students p 
 WHERE (orig.studentid = p.studentid) AND ((orig.studentdob<> p.studentdob) OR (orig.studentdob IS NULL AND p.studentdob IS NOT NULL) OR (orig.studentdob IS NOT NULL AND p.studentdob IS NULL))';
	EXECUTE sqlCode;
END IF;
--Updating differences in 'sideoneonly' for reporting purposes
ALTER TABLE public_students ADD _diffbit_sideoneonly Boolean NULL;
--and retaining old value for full report
ALTER TABLE public_students ADD _existingval_sideoneonly integer  NULL;
sqlCode='UPDATE public_students orig SET _diffbit_sideoneonly = True, _cmprstate_=3
,_existingval_sideoneonly = p.sideoneonly
 FROM public.students p  WHERE (orig.studentid = p.studentid) AND ((orig.sideoneonly<> p.sideoneonly) OR (orig.sideoneonly IS NULL AND p.sideoneonly IS NOT NULL) OR (orig.sideoneonly IS NOT NULL AND p.sideoneonly IS NULL))';EXECUTE sqlCode;If (execCode=True) THEN
	sqlCode ='UPDATE public.students orig SET sideoneonly = p.sideoneonly
 FROM public_students p 
 WHERE (orig.studentid = p.studentid) AND ((orig.sideoneonly<> p.sideoneonly) OR (orig.sideoneonly IS NULL AND p.sideoneonly IS NOT NULL) OR (orig.sideoneonly IS NOT NULL AND p.sideoneonly IS NULL))';
	EXECUTE sqlCode;
END IF;

--generating individual DML statements: DELETE, UPDATE
IF (printExec=True) THEN --only if asked to print, since that's the only reason they are here
	PERFORM 1 from public_students s WHERE s._cmprstate_ IN (2,3);
	IF FOUND THEN
		declare temprow record;
		BEGIN
			FOR temprow IN
				SELECT  studentid ,studentfirstname , _diffbit_studentfirstname , _existingval_studentfirstname ,studentlastname , _diffbit_studentlastname , _existingval_studentlastname ,studentdob , _diffbit_studentdob , _existingval_studentdob ,sideoneonly , _diffbit_sideoneonly , _existingval_sideoneonly ,s._cmprstate_ FROM public_students s WHERE s._cmprstate_ IN (2,3)
		LOOP
If (temprow._CmprState_=2) THEN --to be dropped
	sqlCode='DELETE FROM public.students s WHERE s.studentid=''' || CAST( temprow.studentid AS VARCHAR(20)) || ''''; 
	If (printExec = True) THEN
		INSERT INTO scriptoutput (SQLText)
		VALUES (sqlCode);
	End If;
ELSE
If (temprow._CmprState_=3) THEN--to be updated
			sqlCode='UPDATE public.students orig SET ';
			IF (temprow._diffbit_studentfirstname=True) THEN
				IF temprow.studentfirstname IS NULL THEN
					sqlCode = sqlCode || 'studentfirstname=NULL';
				ELSE
					sqlCode = sqlCode || 'studentfirstname= ''' || temprow.studentfirstname || ''''; --DML Update: set the value
					IF temprow._existingval_studentfirstname IS NULL THEN
						sqlCode = sqlCode || '/*NULL*/';
					ELSE
						sqlCode = sqlCode || '/*' || temprow._existingval_studentfirstname || '*/';
					END IF;
				END IF; --of: if field IS NULL
				sqlCode = sqlCode || ',';
			END IF; --of: if diffbit flag is true

			IF (temprow._diffbit_studentlastname=True) THEN
				IF temprow.studentlastname IS NULL THEN
					sqlCode = sqlCode || 'studentlastname=NULL';
				ELSE
					sqlCode = sqlCode || 'studentlastname= ''' || temprow.studentlastname || ''''; --DML Update: set the value
					IF temprow._existingval_studentlastname IS NULL THEN
						sqlCode = sqlCode || '/*NULL*/';
					ELSE
						sqlCode = sqlCode || '/*' || temprow._existingval_studentlastname || '*/';
					END IF;
				END IF; --of: if field IS NULL
				sqlCode = sqlCode || ',';
			END IF; --of: if diffbit flag is true

			IF (temprow._diffbit_studentdob=True) THEN
				IF temprow.studentdob IS NULL THEN
					sqlCode = sqlCode || 'studentdob=NULL';
				ELSE
					sqlCode = sqlCode || 'studentdob=''' || CAST(Format(CAST(temprow.studentdob AS character varying), 'yyyy-MM-dd HH:mm:ss.fff') AS character varying)  || '''';
					IF temprow._existingval_studentdob IS NULL THEN
						sqlCode = sqlCode || '/*NULL*/';
					ELSE
						sqlCode = sqlCode || '/*' || CAST(FORMAT(CAST(temprow._existingval_studentdob AS character varying), 'yyyy-MM-dd HH:mm:ss.fff') As character varying) || '*/';
					END IF;
				END IF; --of: if field IS NULL
				sqlCode = sqlCode || ',';
			END IF; --of: if diffbit flag is true

			IF (temprow._diffbit_sideoneonly=True) THEN
				IF temprow.sideoneonly IS NULL THEN
					sqlCode = sqlCode || 'sideoneonly=NULL';
				ELSE
					sqlCode = sqlCode || 'sideoneonly=' || CAST(temprow.sideoneonly AS character varying);
					IF temprow._existingval_sideoneonly IS NULL THEN
						sqlCode = sqlCode || '/*NULL*/';
					ELSE
						sqlCode = sqlCode || '/*' || CAST(temprow._existingval_sideoneonly As character varying) || '*/';
					END IF;
				END IF; --of: if field IS NULL
				sqlCode = sqlCode || ',';
			END IF; --of: if diffbit flag is true

			sqlCode = LEFT(sqlCode,LENGTH(sqlCode)-1) || ' WHERE s.studentid=''' || CAST( temprow.studentid AS VARCHAR(20)) || '''' ;
			IF (printExec=True) THEN
				INSERT INTO scriptoutput (SQLText)
				VALUES (sqlCode);
			END IF;
		END IF; --of To be updated
	END IF; --Of If-Then To be dropped
		END LOOP;
	END; --of record iteration (temprow) 
	END IF; --of IF FOUND (for generating individual DML statements: DELETE, UPDATE)
END IF; --of if asked to print

NumNonEqualRecs := COUNT(*) FROM public_students s WHERE s._cmprstate_<>1;
IF NumNonEqualRecs>0 THEN
	IF (print=True) THEN
		INSERT INTO scriptoutput (SQLText)
		VALUES ('----SELECT * FROM public_students --to get the full state of the data comparison (column _cmprstate_: 1=Added, 2=Removed, 3=Updated). There were ' || NumNonEqualRecs || ' records that were different');
	END IF;
END IF;
END; --end of data section
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
		schemaChanged := True;
		END LOOP;
	END; --off 



	--Post-Adding Foreign Keys (some might be added later)---------------------------------------------------------------
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
		schemaChanged := True;
		END LOOP;
	END; --off 



--Coded Entities---------------------------------------------------------------

BEGIN --coded entities
--Dropping Entities that need to be altered: (will then be added again. we don't do ALTER. just DROP-CREATE)
	declare temprow record;
	BEGIN
		FOR temprow IN
			SELECT  s.ent_schema , s.ent_name, s.ent_type, S.param_type_list 
			FROM ScriptCode s
			WHERE codeStat = 3 
		LOOP
	IF (print=True) THEN
		INSERT INTO scriptoutput (SQLText)
		VALUES ('--' || temprow.ent_schema || '.' || temprow.ent_name || ' is different. Drop and then add:');
	END IF;
	IF (printExec = True) THEN 
		INSERT INTO scriptoutput (SQLText)
		VALUES ('DROP ' || temprow.ent_type || ' ' || temprow.ent_schema || '.' || temprow.ent_name || '(' || COALESCE(temprow.param_type_list,'') || ');');
	END IF;
	IF (execCode = True) THEN
		EXECUTE 'DROP ' || temprow.ent_type || ' ' || temprow.ent_schema || '.' || temprow.ent_name || '(' || COALESCE(temprow.param_type_list,'') || ');';
	END IF;
	schemaChanged := True;
		END LOOP;
	END; --of cursor 
--Adding new coded entities and ones that were modified
	declare temprow record;
	BEGIN
		FOR temprow IN
			SELECT  s.ent_schema , s.ent_name, s.sql_create, s.ent_type 
			FROM ScriptCode s
			WHERE codeStat IN (1,3) 
		LOOP
	IF (print=True) THEN
		INSERT INTO scriptoutput (SQLText)
		VALUES ('--' || temprow.ent_type || ' ' || temprow.ent_schema || '.' || temprow.ent_name || ' will be added');
	END IF;
	IF (printExec = True) THEN 
		INSERT INTO scriptoutput (SQLText)
		VALUES (temprow.SQL_CREATE);
	END IF;
	IF (execCode = True) THEN
		EXECUTE temprow.SQL_CREATE;
	END IF;
	schemaChanged := True;
		END LOOP;
	END; --of cursor 
END; --coded entities

	--Dropping Tables-------------------------------------------------------------------------
declare temprow record;
BEGIN
	FOR temprow IN 
		Select s.table_schema , s.table_name, s.SQL_CREATE 
		FROM ScriptTables s
		WHERE tableStat = 1
LOOP
	IF (print=True) THEN
		INSERT INTO scriptoutput (SQLText)
		VALUES ('--Adding table ' || temprow.table_schema || '.' || temprow.table_name);
	END IF;
	IF (printExec = True) THEN 
		INSERT INTO scriptoutput (SQLText)
		VALUES (temprow.SQL_CREATE);
	END IF;
	IF (execCode = True) THEN
		EXECUTE temprow.SQL_CREATE;
	END IF;
	schemaChanged := True;
	END LOOP;
END; --of cursor 


END; --overall code
$$
;select * from scriptoutput
