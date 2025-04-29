-- 2025/1/13 - Steve added lookups for the following two lookup types

-- FixtureActiveStatus = 24,

DO $$
BEGIN

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT * FROM (
  SELECT 'Active' AS label, 1 AS value, 24 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Pending release' AS label, 2 AS value, 24 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Released' AS label, 3 AS value, 24 AS type, CAST(NULL AS INTEGER)
) AS tmp
WHERE NOT EXISTS (
  SELECT 1 FROM collateral.lookups 
  WHERE value = tmp.value 
    AND type = tmp.type 
    AND parent_lookup_id IS NULL
);
END $$; 
