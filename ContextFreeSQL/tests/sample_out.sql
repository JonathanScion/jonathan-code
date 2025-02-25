DO $$
BEGIN --overall code
------------------------Context Free Script------------------------------------------
--Parameters: @print: PRINT english description of what the script is doing
--            @printExec: PRINT the SQL statements the script generates
--            @execCode: EXECUTE the script on the database

--feel free to change these flags
	DECLARE print boolean 	:= 1; 
		printExec boolean 	:= 1; 
		execCode boolean 	:= 1;
-------------------------------------------------------------------------------------

	DECLARE sqlCode character varying  ; schemaChanged boolean := False;
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
            tableStat smallint null,
        );

        --tables only on Johannes database (need to add)"
        update ScriptTables set tableStat = 1FROM ScriptTables J left join (select t.table_schema, t.table_name FROM information_schema.tables t WHERE t.table_schema not in ('information_schema', 'pg_catalog') AND t.table_schema NOT LIKE 'pg_temp%' ) DB 
            "on LOWER(J.table_schema) = LOWER(DB.table_schema) AND LOWER(J.table_name) = LOWER(DB.table_name) 
            "where DB.table_name Is null; --table only on DB (need to drop)INSERT  INTO ScriptTables ( table_schema ,table_name,tableStat)
            SELECT  DB.table_schema ,DB.table_name,2 
            FROM    ScriptTables J 
            RIGHT JOIN ( SELECT t.table_schema , 
            t.table_name 
            FROM   information_schema.tables t  where t.table_schema not in ('information_schema', 'pg_catalog') AND t.table_schema NOT LIKE 'pg_temp%'  AND table_type like '%TABLE%' 
            ) DB ON LOWER(J.table_schema) = LOWER(DB.table_schema) 
            AND LOWER(J.table_name) = LOWER(DB.table_name) 
            WHERE J.table_name Is NULL; 
	--End DB State Temp Tables for Tables
END; --overall code
$$
;select * from scriptoutput
