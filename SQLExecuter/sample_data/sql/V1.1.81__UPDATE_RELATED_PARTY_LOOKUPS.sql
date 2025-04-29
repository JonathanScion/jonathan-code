DO $$
BEGIN

-- Remove duplicate entry from PersonalPropertyOwnershipType = 30
DELETE FROM collateral.lookups
WHERE label = 'Tenants in Common' AND value = 2 AND type = 30;


--  CommonOwnershipType = 31
INSERT INTO collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES 
  ('Tenants in Common', 2, 31, 2, NULL);

END $$;