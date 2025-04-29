DO $$
BEGIN

-- DELETE EXISTING ITEMS 
DELETE FROM collateral.flood_zone_determinations;

ALTER TABLE collateral.flood_zone_requests DROP COLUMN lapse_date;
ALTER TABLE collateral.flood_zone_determinations DROP COLUMN lapse_date;

ALTER TABLE collateral.flood_zone_determinations DROP COLUMN determination_date;
ALTER TABLE collateral.flood_zone_determinations ADD COLUMN determination_date TIMESTAMPTZ NOT NULL;

ALTER TABLE collateral.insurance_policies ADD COLUMN expiration_date TIMESTAMPTZ;

END $$; 

