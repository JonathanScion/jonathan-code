DO $$ 
BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'col' AND table_name = 'collateral.real_estate_site_parcel_improvements' AND column_name = 'created_by') THEN
        ALTER TABLE collateral.real_estate_site_parcel_improvements DROP COLUMN created_by;
        ALTER TABLE collateral.real_estate_site_parcel_improvements ADD COLUMN created_by VARCHAR(64);
    END IF;
    -- Deliberate error to do a dry run on the sql above
    -- RAISE EXCEPTION 'Deliberate error to force rollback to test SQL'; 

END $$;