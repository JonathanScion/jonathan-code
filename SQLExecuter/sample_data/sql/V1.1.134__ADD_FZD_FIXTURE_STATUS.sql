DO $$
BEGIN

    ALTER TABLE collateral.lookups ADD COLUMN structure_status_lookup_id SMALLINT;

END $$;