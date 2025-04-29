DO $$
BEGIN

-- Rename column to shared table to support new value
ALTER TABLE collateral.customer_related_parties
DROP COLUMN common_ownership_type;

ALTER TABLE collateral.customer_related_parties
ADD COLUMN party_common_ownership_type INTEGER;

END $$;