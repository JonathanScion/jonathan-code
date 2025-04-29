DO $$
BEGIN

/*
ALTER TABLE collateral.real_estate_site_parcels ADD COLUMN geoPoint GEOGRAPHY(Point, 4326);
CREATE INDEX idx_real_estate_site_parcel_geopoint ON collateral.real_estate_site_parcels USING GIST (geoPoint);
*/

END $$;
