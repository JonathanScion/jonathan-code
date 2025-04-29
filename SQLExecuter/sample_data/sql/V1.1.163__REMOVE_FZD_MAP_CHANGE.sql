DO $$
BEGIN

-- Drop map_change from flood zone determination
ALTER TABLE collateral.flood_zone_determinations DROP COLUMN map_change;

END $$;