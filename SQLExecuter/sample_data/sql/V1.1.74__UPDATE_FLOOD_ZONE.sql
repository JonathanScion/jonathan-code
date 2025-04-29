-- 2025/2/19 - 

DO $$
BEGIN

TRUNCATE TABLE collateral.flood_zone_requests CASCADE;

-- Flood Zone Request
ALTER TABLE collateral.flood_zone_requests DROP COLUMN customer_name;
ALTER TABLE collateral.flood_zone_requests ADD COLUMN company_mpid VARCHAR(64);
ALTER TABLE collateral.flood_zone_requests ADD COLUMN cost_center VARCHAR(16);
ALTER TABLE collateral.flood_zone_requests ADD COLUMN request_category SMALLINT NOT NULL;


-- Flood Zone Determination
ALTER TABLE collateral.flood_zone_determinations DROP COLUMN company_name;
ALTER TABLE collateral.flood_zone_determinations ADD COLUMN company_mpid VARCHAR(64);
ALTER TABLE collateral.flood_zone_determinations ADD COLUMN map_change BOOLEAN;

END $$; 

