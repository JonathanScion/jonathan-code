DO $$
BEGIN
/*
DROP INDEX IF EXISTS idx_real_estate_site_parcel_geopoint CASCADE;
DROP INDEX IF EXISTS idx_real_estate_site_parcel_geoPoint CASCADE;
*/
/*
ALTER TABLE collateral.real_estate_site_parcels DROP COLUMN geopoint;
*/
/*
ALTER TABLE collateral.real_estate_site_parcels ADD COLUMN geo_point GEOGRAPHY(Point, 4326);
CREATE INDEX idx_real_estate_site_parcel_geo_point ON collateral.real_estate_site_parcels USING GIST (geo_point);
*/

END $$;
