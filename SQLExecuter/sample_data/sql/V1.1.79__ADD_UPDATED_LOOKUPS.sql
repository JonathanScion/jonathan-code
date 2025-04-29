DO $$
BEGIN

-- Parcels OwnershipType = 6
INSERT INTO collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES 
  ('Life Estate', 3, 6, 3, NULL);

-- PersonalPropertyOwnershipType = 30
INSERT INTO collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES 
  ('Owned', 1, 30, 1, NULL),
  ('Leasehold', 2, 30, 2, NULL);

--  CommonOwnershipType = 30,
INSERT INTO collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES 
  ('JTWROS', 1, 31, 1, NULL),
  ('Tenants in Common', 2, 30, 2, NULL),
  ('N/A', 3, 31, 3, NULL);

-- Add column to shared table to support new value
ALTER TABLE collateral.customer_related_parties
ADD COLUMN common_ownership_type INTEGER;  

END $$; 