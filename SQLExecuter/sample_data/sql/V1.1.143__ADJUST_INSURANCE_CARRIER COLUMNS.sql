DO $$
BEGIN

  ALTER TABLE collateral.insurance_policy_carriers DROP COLUMN IF EXISTS carrier_name;
  ALTER TABLE collateral.insurance_policy_carriers DROP COLUMN IF EXISTS captive_backup_carrier;

  ALTER TABLE collateral.insurance_policy_carriers ADD COLUMN carrier_name_lookup_id SMALLINT;
  ALTER TABLE collateral.insurance_policy_carriers ADD COLUMN captive_backup_carrier_name_lookup_id SMALLINT;

END $$;