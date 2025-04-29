DO $$ 
BEGIN

ALTER TABLE collateral.flood_zone_determinations ADD COLUMN source_data VARCHAR(1024);

ALTER TABLE collateral.flood_zone_determination_map_changes ADD COLUMN source_data VARCHAR(1024);

END $$;