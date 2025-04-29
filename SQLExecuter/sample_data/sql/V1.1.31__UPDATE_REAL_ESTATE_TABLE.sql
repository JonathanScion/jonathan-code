DO $$
BEGIN
    ALTER TABLE collateral.real_estate_sites ADD COLUMN site_common_name TEXT;
END $$;
