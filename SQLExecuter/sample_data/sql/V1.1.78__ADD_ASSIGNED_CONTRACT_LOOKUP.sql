DO $$ 
BEGIN 

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Assigned contracts', 2, 5, lookup_id
FROM collateral.lookups
WHERE value = 4 AND type = 5 and parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 2 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);


END $$;