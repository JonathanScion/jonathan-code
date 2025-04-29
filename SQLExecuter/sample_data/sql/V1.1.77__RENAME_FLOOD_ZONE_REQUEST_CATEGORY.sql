DO $$ 
BEGIN 

ALTER TABLE collateral.flood_zone_requests RENAME COLUMN request_category TO asset_type;


END $$;