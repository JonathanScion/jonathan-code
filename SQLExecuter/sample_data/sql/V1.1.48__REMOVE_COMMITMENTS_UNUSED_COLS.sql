DO $$
BEGIN

ALTER TABLE collateral.customer_commitments
DROP COLUMN IF EXISTS party_name,
DROP COLUMN IF EXISTS party_ownership_interest,
DROP COLUMN IF EXISTS party_tenancy;

END $$;



