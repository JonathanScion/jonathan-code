DO $$ 
BEGIN

ALTER TABLE collateral.real_estate_site_parcel_improvements DROP CONSTRAINT IF EXISTS fk__re_site_parcel_improvements__parcel;
ALTER TABLE collateral.real_estate_site_parcel_improvements ADD CONSTRAINT fk__re_site_parcel_improvements__parcel  FOREIGN KEY (real_estate_site_parcel_id) REFERENCES collateral.real_estate_site_parcels (real_estate_site_parcel_id) ON DELETE CASCADE;

END $$;