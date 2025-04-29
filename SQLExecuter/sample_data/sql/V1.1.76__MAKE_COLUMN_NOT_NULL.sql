DO $$ 
BEGIN 

ALTER TABLE collateral.real_estate_site_parcel_improvements
ALTER COLUMN created_by DROP NOT NULL;

END $$;