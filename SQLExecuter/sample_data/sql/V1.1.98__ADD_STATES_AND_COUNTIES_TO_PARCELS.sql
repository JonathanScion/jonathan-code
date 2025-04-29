DO $$
BEGIN

ALTER TABLE collateral.real_estate_site_parcels ADD COLUMN IF NOT EXISTS parcel_states VARCHAR[];

ALTER TABLE collateral.real_estate_site_parcels ADD COLUMN IF NOT EXISTS parcel_counties VARCHAR[];

ALTER TABLE collateral.real_estate_site_parcels DROP COLUMN parcel_state;

ALTER TABLE collateral.real_estate_site_parcels DROP COLUMN parcel_county;

END $$;