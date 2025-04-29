DO $$
BEGIN

-- MapChangeTypes = 45
INSERT INTO collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES 
  ('Material', 1, 45, 1, NULL),
  ('Immaterial', 2, 45, 2, NULL),
  ('No Flag', 3, 45, 3, NULL);

ALTER TABLE collateral.flood_zone_determinations ADD COLUMN map_change_lookup_id SMALLINT;


-- Rename column to
ALTER TABLE collateral.fixture DROP COLUMN is_sfha;
ALTER TABLE collateral.fixture ADD COLUMN in_sfha BOOLEAN;


END $$;