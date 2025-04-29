DO $$
BEGIN

ALTER TABLE collateral.real_estate_site_parcels ADD COLUMN release_date DATE;

END $$;