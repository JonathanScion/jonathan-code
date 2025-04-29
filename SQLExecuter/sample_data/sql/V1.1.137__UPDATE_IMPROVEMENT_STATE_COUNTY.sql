DO $$
BEGIN

ALTER TABLE collateral.real_estate_site_parcel_improvements ADD COLUMN IF NOT EXISTS improvement_states VARCHAR[];

ALTER TABLE collateral.real_estate_site_parcel_improvements ADD COLUMN IF NOT EXISTS improvement_counties VARCHAR[];

ALTER TABLE collateral.real_estate_site_parcel_improvements DROP COLUMN improvement_state;

ALTER TABLE collateral.real_estate_site_parcel_improvements DROP COLUMN improvement_county;

END $$;