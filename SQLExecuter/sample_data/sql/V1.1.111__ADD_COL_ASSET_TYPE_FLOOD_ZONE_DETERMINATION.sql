DO $$
BEGIN

-- DELETE EXISTING ITEMS 
DELETE FROM collateral.flood_zone_determinations;

-- ADD NON NULLABLE COLUMN
ALTER TABLE collateral.flood_zone_determinations ADD COLUMN asset_type SMALLINT NOT NULL;

END $$; 

