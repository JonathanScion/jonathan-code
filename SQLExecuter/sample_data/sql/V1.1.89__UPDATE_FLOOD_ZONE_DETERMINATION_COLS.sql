DO $$
BEGIN

    ALTER TABLE collateral.flood_zone_determinations DROP COLUMN reason_not_required;
    ALTER TABLE collateral.flood_zone_determinations DROP COLUMN type_of_certification_lookup_id;

    ALTER TABLE collateral.flood_zone_determinations ADD COLUMN reason_not_required_lookup_id SMALLINT;
    ALTER TABLE collateral.flood_zone_determinations ADD COLUMN type_of_certification VARCHAR(128);

    ALTER TABLE collateral.real_estate_site_parcels ADD COLUMN geo_point_confidence SMALLINT;

END $$; 

