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
		
		--Dropping Schemas that need to be dropped:
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
            'studentgrades',
            'CREATE TABLE public.studentgrades
(
studentid  integer  NOT NULL,
subject  character varying  (20)  NOT NULL,
grade  smallint  NOT NULL,
studentgradeid  integer  NOT NULL
);
CREATE INDEX idx_student_text
ON public.studentgrades
(
subject
)
;
ALTER TABLE public.studentgrades ADD
CONSTRAINT unq_studentid_subj UNIQUE 
(
subject,
grade
)
;
ALTER TABLE public.studentgrades ADD CONSTRAINT studentgrades_pkey PRIMARY KEY
(
studentgradeid
)
;
ALTER TABLE public.studentgrades ALTER COLUMN subject SET DEFAULT ''math''::character varying;
ALTER TABLE public.studentgrades ALTER COLUMN grade SET DEFAULT 0;',
            'DROP TABLE public.studentgrades;');
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
		INSERT INTO ScriptTables (table_schema,table_name, SQL_CREATE, SQL_DROP)
            VALUES ('public',
            'studentgrades1',
            'CREATE TABLE public.studentgrades1
(
studentid  integer  NOT NULL,
subject  character varying  (22)  NOT NULL,
grade  smallint  NOT NULL,
studentgradeid  integer  NOT NULL
);
ALTER TABLE public.studentgrades1 ADD CONSTRAINT studentgrades1_pkey PRIMARY KEY
(
studentid
)
;
ALTER TABLE public.studentgrades1 ALTER COLUMN subject SET DEFAULT ''math''::character varying;
ALTER TABLE public.studentgrades1 ALTER COLUMN grade SET DEFAULT 0;',
            'DROP TABLE public.studentgrades1;');
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
		VALUES ('public',		'studentgrades',		'subject',		'character varying',		20.0,		NULL,		NULL,		False,		False,		'0',		NULL,		NULL,		'ALTER TABLE public.studentgrades ADD subject  character varying  (20)  NOT NULL ',		'ALTER TABLE public.studentgrades ALTER COLUMN subject  TYPE  character varying  (20) ,
	ALTER COLUMN subject SET  NOT NULL ','ALTER TABLE public.studentgrades DROP COLUMN subject'		);
		INSERT INTO ScriptCols (table_schema,table_name,col_name,user_type_name,max_length,precision,scale,is_nullable,is_identity,is_computed,collation_name,computed_definition, SQL_CREATE, SQL_ALTER, SQL_DROP)
		VALUES ('public',		'students',		'studentfirstname',		'character varying',		100.0,		NULL,		NULL,		False,		False,		'0',		NULL,		NULL,		'ALTER TABLE public.students ADD studentfirstname  character varying  (100)  NOT NULL ',		'ALTER TABLE public.students ALTER COLUMN studentfirstname  TYPE  character varying  (100) ,
	ALTER COLUMN studentfirstname SET  NOT NULL ','ALTER TABLE public.students DROP COLUMN studentfirstname'		);
		INSERT INTO ScriptCols (table_schema,table_name,col_name,user_type_name,max_length,precision,scale,is_nullable,is_identity,is_computed,collation_name,computed_definition, SQL_CREATE, SQL_ALTER, SQL_DROP)
		VALUES ('public',		'studentgrades1',		'subject',		'character varying',		22.0,		NULL,		NULL,		False,		False,		'0',		NULL,		NULL,		'ALTER TABLE public.studentgrades1 ADD subject  character varying  (22)  NOT NULL ',		'ALTER TABLE public.studentgrades1 ALTER COLUMN subject  TYPE  character varying  (22) ,
	ALTER COLUMN subject SET  NOT NULL ','ALTER TABLE public.studentgrades1 DROP COLUMN subject'		);
		INSERT INTO ScriptCols (table_schema,table_name,col_name,user_type_name,max_length,precision,scale,is_nullable,is_identity,is_computed,collation_name,computed_definition, SQL_CREATE, SQL_ALTER, SQL_DROP)
		VALUES ('public',		'students',		'sideoneonly',		'integer',		NULL,		32.0,		0.0,		True,		False,		'0',		NULL,		NULL,		'ALTER TABLE public.students ADD sideoneonly  integer  NULL ',		'ALTER TABLE public.students ALTER COLUMN sideoneonly  TYPE  integer ,
	ALTER COLUMN sideoneonly SET  NULL ','ALTER TABLE public.students DROP COLUMN sideoneonly'		);
		INSERT INTO ScriptCols (table_schema,table_name,col_name,user_type_name,max_length,precision,scale,is_nullable,is_identity,is_computed,collation_name,computed_definition, SQL_CREATE, SQL_ALTER, SQL_DROP)
		VALUES ('public',		'studentgrades1',		'grade',		'smallint',		NULL,		16.0,		0.0,		False,		False,		'0',		NULL,		NULL,		'ALTER TABLE public.studentgrades1 ADD grade  smallint  NOT NULL ',		'ALTER TABLE public.studentgrades1 ALTER COLUMN grade  TYPE  smallint ,
	ALTER COLUMN grade SET  NOT NULL ','ALTER TABLE public.studentgrades1 DROP COLUMN grade'		);
		INSERT INTO ScriptCols (table_schema,table_name,col_name,user_type_name,max_length,precision,scale,is_nullable,is_identity,is_computed,collation_name,computed_definition, SQL_CREATE, SQL_ALTER, SQL_DROP)
		VALUES ('public',		'studentgrades1',		'studentid',		'integer',		NULL,		32.0,		0.0,		False,		False,		'0',		NULL,		NULL,		'ALTER TABLE public.studentgrades1 ADD studentid  integer  NOT NULL ',		'ALTER TABLE public.studentgrades1 ALTER COLUMN studentid  TYPE  integer ,
	ALTER COLUMN studentid SET  NOT NULL ','ALTER TABLE public.studentgrades1 DROP COLUMN studentid'		);
		INSERT INTO ScriptCols (table_schema,table_name,col_name,user_type_name,max_length,precision,scale,is_nullable,is_identity,is_computed,collation_name,computed_definition, SQL_CREATE, SQL_ALTER, SQL_DROP)
		VALUES ('public',		'studentgrades1',		'studentgradeid',		'integer',		NULL,		32.0,		0.0,		False,		False,		'0',		NULL,		NULL,		'ALTER TABLE public.studentgrades1 ADD studentgradeid  integer  NOT NULL ',		'ALTER TABLE public.studentgrades1 ALTER COLUMN studentgradeid  TYPE  integer ,
	ALTER COLUMN studentgradeid SET  NOT NULL ','ALTER TABLE public.studentgrades1 DROP COLUMN studentgradeid'		);
		INSERT INTO ScriptCols (table_schema,table_name,col_name,user_type_name,max_length,precision,scale,is_nullable,is_identity,is_computed,collation_name,computed_definition, SQL_CREATE, SQL_ALTER, SQL_DROP)
		VALUES ('public',		'students',		'studentdob',		'timestamp without time zone',		NULL,		NULL,		NULL,		True,		False,		'0',		NULL,		NULL,		'ALTER TABLE public.students ADD studentdob  timestamp without time zone  NULL ',		'ALTER TABLE public.students ALTER COLUMN studentdob  TYPE  timestamp without time zone ,
	ALTER COLUMN studentdob SET  NULL ','ALTER TABLE public.students DROP COLUMN studentdob'		);
		INSERT INTO ScriptCols (table_schema,table_name,col_name,user_type_name,max_length,precision,scale,is_nullable,is_identity,is_computed,collation_name,computed_definition, SQL_CREATE, SQL_ALTER, SQL_DROP)
		VALUES ('public',		'studentgrades',		'studentgradeid',		'integer',		NULL,		32.0,		0.0,		False,		False,		'0',		NULL,		NULL,		'ALTER TABLE public.studentgrades ADD studentgradeid  integer  NOT NULL ',		'ALTER TABLE public.studentgrades ALTER COLUMN studentgradeid  TYPE  integer ,
	ALTER COLUMN studentgradeid SET  NOT NULL ','ALTER TABLE public.studentgrades DROP COLUMN studentgradeid'		);
		INSERT INTO ScriptCols (table_schema,table_name,col_name,user_type_name,max_length,precision,scale,is_nullable,is_identity,is_computed,collation_name,computed_definition, SQL_CREATE, SQL_ALTER, SQL_DROP)
		VALUES ('public',		'studentgrades',		'studentid',		'integer',		NULL,		32.0,		0.0,		False,		False,		'0',		NULL,		NULL,		'ALTER TABLE public.studentgrades ADD studentid  integer  NOT NULL ',		'ALTER TABLE public.studentgrades ALTER COLUMN studentid  TYPE  integer ,
	ALTER COLUMN studentid SET  NOT NULL ','ALTER TABLE public.studentgrades DROP COLUMN studentid'		);
		INSERT INTO ScriptCols (table_schema,table_name,col_name,user_type_name,max_length,precision,scale,is_nullable,is_identity,is_computed,collation_name,computed_definition, SQL_CREATE, SQL_ALTER, SQL_DROP)
		VALUES ('public',		'students',		'studentid',		'integer',		NULL,		32.0,		0.0,		False,		False,		'0',		NULL,		NULL,		'ALTER TABLE public.students ADD studentid  integer  NOT NULL ',		'ALTER TABLE public.students ALTER COLUMN studentid  TYPE  integer ,
	ALTER COLUMN studentid SET  NOT NULL ','ALTER TABLE public.students DROP COLUMN studentid'		);
		INSERT INTO ScriptCols (table_schema,table_name,col_name,user_type_name,max_length,precision,scale,is_nullable,is_identity,is_computed,collation_name,computed_definition, SQL_CREATE, SQL_ALTER, SQL_DROP)
		VALUES ('public',		'studentgrades',		'grade',		'smallint',		NULL,		16.0,		0.0,		False,		False,		'0',		NULL,		NULL,		'ALTER TABLE public.studentgrades ADD grade  smallint  NOT NULL ',		'ALTER TABLE public.studentgrades ALTER COLUMN grade  TYPE  smallint ,
	ALTER COLUMN grade SET  NOT NULL ','ALTER TABLE public.studentgrades DROP COLUMN grade'		);
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
AND C.table_schema || C.table_name IN ('publicstudentgrades', 'publicstudentgrades1', 'publicstudents') 
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
		VALUES ('public','studentgrades','idx_student_text',False,
		False,
		NULL,
		False,
		False,
		NULL,
		NULL,
		NULL,
		NULL,
		'subject',
		'CREATE INDEX idx_student_text
ON public.studentgrades
(
subject
)
');
		
		--Insert Index Columns
		INSERT INTO ScriptIndexesCols (table_schema,table_name,index_name,col_name,index_column_id,key_ordinal,is_descending_key,is_included_column)
		VALUES ('public','studentgrades','idx_student_text','subject',
		'1',
		'1',
		False,
		'False');
		
		INSERT INTO ScriptIndexes (table_schema,table_name,index_name,is_unique,is_clustered,ignore_dup_key,is_primary_key,is_unique_constraint,allow_row_locks,allow_page_locks,has_filter,filter_definition,index_columns,SQL_CREATE)
		VALUES ('public','studentgrades','unq_studentid_subj',True,
		False,
		NULL,
		False,
		True,
		NULL,
		NULL,
		NULL,
		NULL,
		'subject, grade',
		'ALTER TABLE public.studentgrades ADD
CONSTRAINT unq_studentid_subj UNIQUE 
(
subject,
grade
)
');
		
		--Insert Index Columns
		INSERT INTO ScriptIndexesCols (table_schema,table_name,index_name,col_name,index_column_id,key_ordinal,is_descending_key,is_included_column)
		VALUES ('public','studentgrades','unq_studentid_subj','subject',
		'1',
		'1',
		False,
		'False');
		
		INSERT INTO ScriptIndexesCols (table_schema,table_name,index_name,col_name,index_column_id,key_ordinal,is_descending_key,is_included_column)
		VALUES ('public','studentgrades','unq_studentid_subj','grade',
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
		
		INSERT INTO ScriptIndexes (table_schema,table_name,index_name,is_unique,is_clustered,ignore_dup_key,is_primary_key,is_unique_constraint,allow_row_locks,allow_page_locks,has_filter,filter_definition,index_columns,SQL_CREATE)
		VALUES ('public','studentgrades1','studentgrades1_pkey',True,
		False,
		NULL,
		True,
		False,
		NULL,
		NULL,
		NULL,
		NULL,
		'studentid',
		'ALTER TABLE public.studentgrades1 ADD CONSTRAINT studentgrades1_pkey PRIMARY KEY
(
studentid
)
');
		
		--Insert Index Columns
		INSERT INTO ScriptIndexesCols (table_schema,table_name,index_name,col_name,index_column_id,key_ordinal,is_descending_key,is_included_column)
		VALUES ('public','studentgrades1','studentgrades1_pkey','studentid',
		'1',
		'1',
		False,
		'False');
		
		INSERT INTO ScriptIndexes (table_schema,table_name,index_name,is_unique,is_clustered,ignore_dup_key,is_primary_key,is_unique_constraint,allow_row_locks,allow_page_locks,has_filter,filter_definition,index_columns,SQL_CREATE)
		VALUES ('public','studentgrades','studentgrades_pkey',True,
		False,
		NULL,
		True,
		False,
		NULL,
		NULL,
		NULL,
		NULL,
		'studentgradeid',
		'ALTER TABLE public.studentgrades ADD CONSTRAINT studentgrades_pkey PRIMARY KEY
(
studentgradeid
)
');
		
		--Insert Index Columns
		INSERT INTO ScriptIndexesCols (table_schema,table_name,index_name,col_name,index_column_id,key_ordinal,is_descending_key,is_included_column)
		VALUES ('public','studentgrades','studentgrades_pkey','studentgradeid',
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
                    WHERE scm.nspname || t.relname IN ('publicstudentgrades', 'publicstudentgrades1', 'publicstudents')
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
		WHERE scm.nspname || t.relname IN ('publicstudentgrades', 'publicstudentgrades1', 'publicstudents')
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
    WHERE scm.nspname || t.relname IN ('publicstudentgrades', 'publicstudentgrades1', 'publicstudents')
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
		
		INSERT INTO scriptfks (fkey_table_schema,fkey_table_name,fk_name,rkey_table_schema,rkey_table_name,is_not_for_replication,is_not_trusted,delete_referential_action,update_referential_action,is_system_named,SQL_CREATE)
		VALUES ('public','studentgrades','fk_students','public','students',NULL,NULL,NULL,NULL,NULL,'ALTER TABLE public.studentgrades ADD CONSTRAINT fk_students FOREIGN KEY
(
studentid
)
REFERENCES public.students
(
studentid
)
');
		
		--FK's Columns
		INSERT INTO scriptfkcols (fkey_table_schema,fkey_table_name,fk_name,rkey_table_schema,rkey_table_name,fkey_col_name,rkey_col_name)
		VALUES ('public','studentgrades','fk_students','public',
		'students',
		'studentid',
		'studentid');
		
		
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
                    AND ns.nspname || t.relname IN ('publicstudentgrades', 'publicstudentgrades1', 'publicstudents')
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
			AND ns.nspname || t.relname IN ('publicstudentgrades', 'publicstudentgrades1', 'publicstudents')
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


--DB State Temp Tables for Codes
--Code Entities
BEGIN --coded entities
	perform n.nspname, c.relname
	FROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
	WHERE n.nspname like 'pg_temp_%' AND c.relname='scriptcode' AND pg_catalog.pg_table_is_visible(c.oid);
	IF FOUND THEN
		DROP TABLE ScriptCode;
	END IF;

	CREATE TEMP TABLE ScriptCode
	(
		ent_schema character varying (128) not null,
		ent_name character varying (128) not null,
		ent_type character varying (25) null,
		ent_type_pg character varying (25) null,
		SQL_CREATE character varying  null,
		SQL_DROP character varying  null,
		param_type_list character varying  null,
		codeStat smallint null
);

	--Fill it with code entities
INSERT INTO ScriptCode (ent_schema, ent_name, ent_type, SQL_CREATE, SQL_DROP, param_type_list)
VALUES ('public', 'getallstudents', 'Procedure', 'CREATE OR REPLACE PROCEDURE public.getallstudents()
 LANGUAGE sql
AS $procedure$
select * from students s;
$procedure$
', 'DROP Procedure public.getallstudents ;', '');
INSERT INTO ScriptCode (ent_schema, ent_name, ent_type, SQL_CREATE, SQL_DROP, param_type_list)
VALUES ('public', 'getallstudents', 'Procedure', 'CREATE OR REPLACE PROCEDURE public.getallstudents(IN studentid integer)
 LANGUAGE sql
AS $procedure$
select * from students s where s.studentid=studentid;
$procedure$
', 'DROP Procedure public.getallstudents IN studentid integer;', 'IN studentid integer');
INSERT INTO ScriptCode (ent_schema, ent_name, ent_type, SQL_CREATE, SQL_DROP, param_type_list)
VALUES ('public', 'show_views', 'View', 'CREATE OR REPLACE VIEW public.show_views
AS
 SELECT views.table_name
   FROM information_schema.views
  WHERE ((views.table_schema)::name = ANY (current_schemas(false)));', 'DROP View public.show_views ;', '');
INSERT INTO ScriptCode (ent_schema, ent_name, ent_type, SQL_CREATE, SQL_DROP, param_type_list)
VALUES ('public', 'somestudents', 'Procedure', 'CREATE OR REPLACE PROCEDURE public.somestudents()
 LANGUAGE sql
AS $procedure$
select 1 from students where SideOneOnly IS NULL
$procedure$
', 'DROP Procedure public.somestudents ;', '');
INSERT INTO ScriptCode (ent_schema, ent_name, ent_type, SQL_CREATE, SQL_DROP, param_type_list)
VALUES ('public', 'vw_students', 'View', 'CREATE OR REPLACE VIEW public.vw_students
AS
 SELECT students.studentid,
    students.studentfirstname,
    students.studentlastname,
    students.studentdob
   FROM students;', 'DROP View public.vw_students ;', '');
INSERT INTO ScriptCode (ent_schema, ent_name, ent_type, SQL_CREATE, SQL_DROP, param_type_list)
VALUES ('public', 'vw_students1', 'View', 'CREATE OR REPLACE VIEW public.vw_students1
AS
 SELECT students.studentid,
    students.studentfirstname,
    students.studentlastname,
    students.studentdob
   FROM students;', 'DROP View public.vw_students1 ;', '');
	
--Entities only On Johannes database (need To add)
	update ScriptCode Set codeStat = 1
	WHERE NOT EXISTS (
    	SELECT 1 
    	FROM (
        		SELECT v.table_schema || '.' || v.table_name AS "EntKey", 
               			v.table_schema as ent_schema, 
               			v.table_name as ent_name, 
               			'V' AS ent_type,
               			'' as param_type_list  
        		FROM information_schema.views v
        		WHERE v.table_schema NOT IN ('information_schema', 'pg_catalog')
        
        	UNION
        
        	SELECT n.nspname || '.' || p.proname AS "EntKey", 
               		n.nspname as ent_schema,
               		p.proname as ent_name,
               		CAST(p.prokind AS char) AS ent_type,
               		pg_get_function_arguments(p.oid) as param_type_list 
        	FROM pg_proc p 
        		LEFT JOIN pg_namespace n on p.pronamespace = n.oid
        	WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
        
        	UNION
        
        	SELECT t.trigger_schema || '.' || t.trigger_name AS "EntKey", 
               		t.trigger_schema As ent_schema,
               		t.trigger_name As ent_name,
               		'TR' AS ent_type, 
               		'' as param_type_list 
        	FROM information_schema.triggers t
        	GROUP BY 1, 2, 3, 4
    	) existing_entities
    		WHERE existing_entities.ent_schema = ScriptCode.ent_schema 
      			AND existing_entities.ent_name = ScriptCode.ent_name 
      			AND existing_entities.param_type_list = ScriptCode.param_type_list
	);

	--Entities which are different
	UPDATE ScriptCode Set codeStat = 3
FROM ScriptCode J INNER JOIN (
Select v.table_schema || '.' || v.table_name AS "EntKey", v.table_schema as ent_schema, v.table_name as ent_name, 'V' as "enttype", 
'CREATE OR REPLACE VIEW ' || v.table_schema || '.' || v.table_name || E'\nAS\n' || v.view_definition AS definition, 
'' as param_type_list 
From information_schema.views v
Where v.table_schema Not In ('information_schema', 'pg_catalog')
And ( (v.table_schema || '.' || v.table_name) IN ('public.getallstudents','public.getallstudents','public.show_views','public.somestudents','public.vw_students','public.vw_students1') ) 
	UNION
		Select n.nspname || '.' || p.proname  AS "EntKey", n.nspname as ent_schema,
		p.proname As ent_name,
		CAST(p.prokind As Char)  AS "enttype",
		case when l.lanname = 'internal' then p.prosrc
		else pg_get_functiondef(p.oid)
		end as definition, 
		pg_get_function_arguments(p.oid) as param_type_list 
		From pg_proc p 
		Left Join pg_namespace n on p.pronamespace = n.oid
		Left Join pg_language l on p.prolang = l.oid 
		Left Join pg_type t on t.oid = p.prorettype 
		where n.nspname Not in ('pg_catalog', 'information_schema')
And ( (n.nspname || '.' || p.proname) IN ('public.getallstudents','public.getallstudents','public.show_views','public.somestudents','public.vw_students','public.vw_students1') ) 
	UNION
		Select t.trigger_schema || '.' || t.trigger_name AS "EntKey", t.trigger_schema As ent_schema,
		t.trigger_name As ent_name,
		'TR' as "enttype", t.action_statement As definition, '' as param_type_list 
		From information_schema.triggers t
WHERE ( (t.trigger_schema || '.' || t.trigger_name) IN ('public.getallstudents','public.getallstudents','public.show_views','public.somestudents','public.vw_students','public.vw_students1') ) 
Group By 1, 2, 3, 4, 5
) DB On LOWER(J.ent_schema) = LOWER(DB.ent_schema) And LOWER(J.ent_name )= LOWER(DB.ent_name ) And LOWER(J.param_type_list) = LOWER(DB.param_type_list )
WHERE J.SQL_CREATE<>DB.definition 
AND (ScriptCode.ent_schema = J.ent_schema AND ScriptCode.ent_name = J.ent_name); --PG wants an explicit join of the updated table to its alias  

	End; --coded entities


	--Adding Tables--------------------------------------------------------------------

--Dropping Tables that need to be dropped:
declare temprow record;
BEGIN
	FOR temprow IN 
		Select s.table_schema , s.table_name 
		FROM ScriptTables s
		WHERE tableStat = 2
LOOP
	IF (print=True) THEN
		INSERT INTO scriptoutput (SQLText)
		VALUES ('--Table ' || temprow.table_schema || '.' || temprow.table_name || ' is different. Drop and then add:');
	END IF;
	IF (printExec = True) THEN 
		INSERT INTO scriptoutput (SQLText)
		VALUES ('DROP TABLE ' || temprow.table_schema || '.' || temprow.table_name);
	END IF;
	IF (execCode = True) THEN
		EXECUTE 'DROP TABLE ' || temprow.table_schema || '.' || temprow.table_name;
	END IF;
	schemaChanged := True;
	END LOOP;
END; --of cursor 


	--Dropping Extra Schemas----------------------------------------------------------------
		DECLARE temprow record;
		BEGIN
			FOR temprow IN
				SELECT  s.schema_name ,  
				s.SQL_DROP 
				FROM    ScriptSchemas s
					WHERE SchemaStat = 2
				LOOP
				IF (print=True) THEN
					INSERT INTO scriptoutput (SQLText)
					VALUES ('--Dropping Schema ' || temprow.schema_name || ':');
				END IF;
				IF (printExec = True) THEN 
					INSERT INTO scriptoutput (SQLText)
					VALUES ('DROP SCHEMA ' || temprow.schema_name || ';');
				END IF;
				IF (execCode = True) THEN
					EXECUTE 'DROP SCHEMA ' || temprow.schema_name || ';';
				END IF;
				schemaChanged := True;
				END LOOP;
			END; --FOR


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
declare temprow record;
BEGIN
	FOR temprow IN 
		Select s.ent_schema , s.ent_name, s.ent_type, s.param_type_list  
		FROM ScriptCode s
		WHERE codeStat = 2
LOOP
	IF (print=True) THEN
		INSERT INTO scriptoutput (SQLText)
		VALUES ('--' || temprow.ent_schema || '.' || temprow.ent_name || ' is extra. Drop this code:');
	END IF;
	IF (printExec = True) THEN 
		INSERT INTO scriptoutput (SQLText)
		VALUES ('DROP  ' || temprow.ent_type || ' ' || temprow.ent_schema || '.' || temprow.ent_name || '(' || COALESCE(temprow.param_type_list,'') || ')');
	END IF;
	IF (execCode = True) THEN
		EXECUTE 'DROP  ' || temprow.ent_type || ' ' || temprow.ent_schema || '.' || temprow.ent_name || '(' || COALESCE(temprow.param_type_list,'') || ')';
	END IF;
	schemaChanged := True;
	END LOOP;
END; --of cursor 
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
