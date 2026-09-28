select * from wpc.task_qualifications;

update  wpc.task_qualifications set version_num=11 where id='b9eda4a1-8421-5a38-85fa-0a3535956db8'
UPDATE wpc.task_qualifications orig SET version_num=5/*11*/ WHERE s.id='b9eda4a1-8421-5a38-8'


-- SQL generated to make localhost.const2 (target) match localhost.const1 (source)
-- Table: wpc.manual_born_ready_tasks
-- Generated: 2026-09-22T21:17:13.612Z
-- Rows: 3

-- 6 cell(s) selected across 2 row(s)
UPDATE wpc.manual_born_ready_tasks SET active = TRUE WHERE id = '6eb1376f-60db-5e72-956d-1aa62f02664c';
UPDATE wpc.manual_born_ready_tasks SET requested_by = 'MORRML' WHERE id = 'c4687d4b-a4e6-5cea-8726-f03d31b3e719';


SELECT n.nspname AS schema,
       c.relname AS table,
       c.reltuples::bigint AS est_rows,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r','p')
  AND c.relispartition IS FALSE
  AND n.nspname NOT IN ('pg_catalog','information_schema')
ORDER BY c.reltuples DESC;


select * from wpc.manual_born_ready_tasks
update wpc.manual_born_ready_tasks set active=false where id = '6eb1376f-60db-5e72-956d-1aa62f02664c';
update wpc.manual_born_ready_tasks set requested_by='some new val' where id = 'c4687d4b-a4e6-5cea-8726-f03d31b3e719';
update wpc.manual_born_ready_tasks set requested_at='2027-09-15 16:48:39-07' where id = '73c75718-7c55-54fd-bc75-cfa131e2d571'
delete from wpc.manual_born_ready_tasks where id='54bead56-3b41-57de-9cc0-335ecd72e9a6';
