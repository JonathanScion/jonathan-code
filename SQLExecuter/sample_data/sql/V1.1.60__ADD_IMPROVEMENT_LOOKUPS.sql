-- 2025/2/4 - Clare added lookups for the following lookup type

-- ImprovementFixtureStatusLookup = 25,

DO $$
BEGIN

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT * FROM (
  SELECT 'Building' AS label, 1 AS value, 25 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Construction' AS label, 2 AS value, 25 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Silo' AS label, 3 AS value, 25 AS type, CAST(NULL AS INTEGER)
) AS tmp
WHERE NOT EXISTS (
  SELECT 1 FROM collateral.lookups 
  WHERE value = tmp.value 
    AND type = tmp.type 
    AND parent_lookup_id IS NULL
);
END $$; 
