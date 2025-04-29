DO $$
BEGIN

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT * FROM (
  SELECT 'Locomotive' AS label, 1 AS value, 32 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Car' AS label, 2 AS value, 32 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Other Rolling Stock' AS label, 3 AS value, 32 AS type, CAST(NULL AS INTEGER)
) AS tmp
WHERE NOT EXISTS (
  SELECT 1 FROM collateral.lookups 
  WHERE value = tmp.value 
    AND type = tmp.type 
    AND parent_lookup_id IS NULL
);
END $$;