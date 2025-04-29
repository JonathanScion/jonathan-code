DO $$
BEGIN

DROP TABLE IF EXISTS collateral.real_estate_site_parcel_notes;
DROP TABLE IF EXISTS collateral.real_estate_site_notes;
DROP TABLE IF EXISTS collateral.real_estate_site_parcel_commitments;
DROP TABLE IF EXISTS collateral.real_estate_site_parcel_related_parties;
DROP TABLE IF EXISTS collateral.real_estate_site_related_parties;

DROP TABLE IF EXISTS collateral.collateral_related_parties;
DROP TABLE IF EXISTS collateral.collateral_commitments;

DROP TABLE IF EXISTS collateral.fixture_related_parties;
DROP TABLE IF EXISTS collateral.fixture_document;

END $$;



