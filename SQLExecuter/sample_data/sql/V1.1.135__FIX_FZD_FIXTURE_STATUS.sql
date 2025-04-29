DO $$
BEGIN

    ALTER TABLE collateral.lookups DROP COLUMN structure_status_lookup_id;

    ALTER TABLE collateral.flood_zone_determinations ADD COLUMN structure_status_lookup_id SMALLINT;

END $$;