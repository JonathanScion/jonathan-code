DO $$
BEGIN

-- INSURANCE POLICY INSURED PARTIES FIX COLUMN NAME
ALTER TABLE collateral.insurance_policy_insured_parties DROP COLUMN secured_status_lookup_ip;
ALTER TABLE collateral.insurance_policy_insured_parties ADD COLUMN secured_status_lookup_id SMALLINT;

END $$;