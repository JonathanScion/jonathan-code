DO $$
BEGIN
-- Insert 'Other' 
INSERT INTO collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES  ('Other', 9, 5, NULL, NULL);
 
 
-- Insert 'Other asset' using the parent_lookup_id from above
INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Other asset', 1, 5, lookup_id
FROM collateral.lookups
WHERE label = 'Other' AND value = 9 AND type = 5 AND parent_lookup_id IS NULL;
END $$;