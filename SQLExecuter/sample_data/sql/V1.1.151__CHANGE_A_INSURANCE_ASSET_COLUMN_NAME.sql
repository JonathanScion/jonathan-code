DO $$
BEGIN

  ALTER TABLE collateral.insurance_policy_assets DROP COLUMN IF EXISTS improvement_id;

  ALTER TABLE collateral.insurance_policy_assets ADD COLUMN real_estate_site_parcel_improvement_id INTEGER;

END $$;