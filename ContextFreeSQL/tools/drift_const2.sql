-- ============================================================================
-- Knock const2 out of shape, so a script generated from const1 has work to do.
--
--   1. psql -h localhost -U postgres -d const2 -f tools/drift_const2.sql
--   2. generate from const1, run the script on const2 with execCode true
--   3. run it a second time: it should report nothing at all
--
-- Nothing here is random. Every change is listed at the end, so what the script
-- puts back can be checked against what was done - a repeatable drift is one
-- you can argue with.
--
-- Scoped to the wpc schema, which is all const2 holds and all const1.json
-- scripts. That means it does not exercise views, functions or triggers: wpc
-- has none. The whole-database path, including those, is covered by
-- tests/integration/test_complex/test_drift_matrix.py.
--
-- Two things it deliberately leaves alone, because PostgreSQL cannot restore
-- them and the script would then report a difference for ever:
--   - the position of a column (a re-added column lands at the end)
--   - wpc.task_default_selection and wpc.task_profile_priority_sort, which have
--     no primary key or unique index, so their data cannot be compared
-- ============================================================================

\set ON_ERROR_STOP on
BEGIN;

-- ----------------------------------------------------------------------------
-- Columns
-- ----------------------------------------------------------------------------
-- one for the script to drop
ALTER TABLE wpc.work_orders ADD COLUMN drift_extra_col text;

-- one to add back, together with its default
ALTER TABLE wpc.apply_holds DROP COLUMN version_num;

-- a type to change back
ALTER TABLE wpc.task_qualifications ALTER COLUMN qualification TYPE varchar(255);

-- nullability, in both directions
ALTER TABLE wpc.manual_born_ready_tasks ALTER COLUMN work_order_nbr DROP NOT NULL;
ALTER TABLE wpc.manual_born_ready_tasks ALTER COLUMN created_at SET NOT NULL;

-- defaults: changed, removed, added
ALTER TABLE wpc.task_permit_documents ALTER COLUMN deleted SET DEFAULT true;
ALTER TABLE wpc.task_schedule_editable ALTER COLUMN version_num DROP DEFAULT;
ALTER TABLE wpc.event_log ALTER COLUMN username SET DEFAULT 'nobody';

-- ----------------------------------------------------------------------------
-- Indexes, keys and constraints
-- ----------------------------------------------------------------------------
-- an index to recreate
DROP INDEX wpc.idx_wpc_work_orders_search_vector;

-- an index to drop
CREATE INDEX drift_extra_idx ON wpc.task_permits (permit_number);

-- a foreign key to recreate
ALTER TABLE wpc.task_contract_req_editable
    DROP CONSTRAINT fk_task_contract_req_editable_task_contract_req_id;

-- a check constraint to drop
ALTER TABLE wpc.event_log ADD CONSTRAINT drift_extra_check CHECK (id IS NOT NULL);

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------
-- a table to create, with its rows
DROP TABLE wpc.task_completion_notes;

-- a table to drop
CREATE TABLE wpc.drift_extra_table (id int PRIMARY KEY, note text);
INSERT INTO wpc.drift_extra_table VALUES (1, 'should be dropped');

-- ----------------------------------------------------------------------------
-- Data
-- ----------------------------------------------------------------------------
-- rows to delete
INSERT INTO wpc.manual_born_ready_tasks
    (id, work_order_nbr, work_order_task, active, created_at, updated_at)
SELECT gen_random_uuid(), 'DRIFT-' || g, '01', true, now(), now()
FROM generate_series(1, 5) g;

-- rows to put back
DELETE FROM wpc.task_qualifications
WHERE id IN (SELECT id FROM wpc.task_qualifications ORDER BY id LIMIT 4);

-- values to correct: text, NULL, boolean, json and a timestamp
UPDATE wpc.apply_holds SET updated_by = 'DRIFTED'
WHERE id IN (SELECT id FROM wpc.apply_holds ORDER BY id LIMIT 3);

UPDATE wpc.task_crew_preassignment_model SET decision_approach = NULL
WHERE id IN (SELECT id FROM wpc.task_crew_preassignment_model ORDER BY id LIMIT 2);

UPDATE wpc.task_permit_documents SET deleted = NOT deleted
WHERE id IN (SELECT id FROM wpc.task_permit_documents ORDER BY id LIMIT 3);

UPDATE wpc.writeback_change SET atlas_payload = '{"drifted": true}'::jsonb
WHERE id IN (SELECT id FROM wpc.writeback_change ORDER BY id LIMIT 2);

UPDATE wpc.event_log SET event_timestamp = '2001-01-01 00:00:00+00'
WHERE id IN (SELECT id FROM wpc.event_log ORDER BY id LIMIT 2);

COMMIT;

-- What was done, to check against what comes back
SELECT 'drifted:' AS what
UNION ALL SELECT '  column added      wpc.work_orders.drift_extra_col'
UNION ALL SELECT '  column dropped    wpc.apply_holds.version_num (had a default)'
UNION ALL SELECT '  type changed      wpc.task_qualifications.qualification -> varchar(255)'
UNION ALL SELECT '  null dropped      wpc.manual_born_ready_tasks.work_order_nbr'
UNION ALL SELECT '  null set          wpc.manual_born_ready_tasks.created_at'
UNION ALL SELECT '  default changed   wpc.task_permit_documents.deleted'
UNION ALL SELECT '  default dropped   wpc.task_schedule_editable.version_num'
UNION ALL SELECT '  default added     wpc.event_log.username'
UNION ALL SELECT '  index dropped     wpc.idx_wpc_work_orders_search_vector'
UNION ALL SELECT '  index added       wpc.drift_extra_idx on task_permits(permit_number)'
UNION ALL SELECT '  fk dropped        fk_task_contract_req_editable_task_contract_req_id'
UNION ALL SELECT '  check added       drift_extra_check on wpc.event_log'
UNION ALL SELECT '  table dropped     wpc.task_completion_notes (100 rows)'
UNION ALL SELECT '  table added       wpc.drift_extra_table (1 row)'
UNION ALL SELECT '  rows added        5 in wpc.manual_born_ready_tasks'
UNION ALL SELECT '  rows deleted      4 from wpc.task_qualifications'
UNION ALL SELECT '  values changed    apply_holds, task_crew_preassignment_model,'
UNION ALL SELECT '                    task_permit_documents, writeback_change, event_log';
