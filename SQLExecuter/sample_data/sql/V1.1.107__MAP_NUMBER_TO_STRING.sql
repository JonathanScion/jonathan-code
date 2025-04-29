DO $$
BEGIN

    ALTER TABLE collateral.flood_zone_determinations DROP COLUMN map_number;

    ALTER TABLE collateral.flood_zone_determinations ADD COLUMN map_number varchar(6);

END $$;