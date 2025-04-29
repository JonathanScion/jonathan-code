DO $$
BEGIN


INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Other asset', 1, 5, lookup_id
FROM collateral.lookups
WHERE value = 9 AND type = 5 and parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 1
      AND type = 5 
      AND parent_lookup_id = lookup_id
);

END $$; 
