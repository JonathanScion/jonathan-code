-- 2025/03/07 - Brian added lookups for the following lookup type

-- PersonalPropertyTrailerMake = 23,


DO $$
BEGIN

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT * FROM (
  SELECT 'Heil' AS label, 330 AS value, 23 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Other Vehicle' AS label, 990 AS value, 23 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Sterling' AS label, 740 AS value, 23 AS type, CAST(NULL AS INTEGER)
  

) AS tmp
WHERE NOT EXISTS (
  SELECT 1 FROM collateral.lookups 
  WHERE value = tmp.value 
    AND type = tmp.type 
    AND parent_lookup_id IS NULL
);
END $$; 
