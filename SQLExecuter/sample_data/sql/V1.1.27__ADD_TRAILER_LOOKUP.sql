-- 2024/12/23 - Clare added lookups for the following lookup type

-- PersonalPropertyTrailerMake = 23,


DO $$
BEGIN

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT * FROM (
  SELECT 'Cottrell' AS label, 160 AS value, 23 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'East' AS label, 220 AS value, 23 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Fontaine' AS label, 260 AS value, 23 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Fruehauf' AS label, 290 AS value, 23 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Great Dane' AS label, 320 AS value, 23 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Manac' AS label, 530 AS value, 23 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Stoughton' AS label, 750 AS value, 23 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Strick' AS label, 760 AS value, 23 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Talbert' AS label, 790 AS value, 23 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Trail King' AS label, 820 AS value, 23 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Trailmobile' AS label, 830 AS value, 23 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Transcraft' AS label, 840 AS value, 23 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Utility' AS label, 850 AS value, 23 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Vanguard' AS label, 860 AS value, 23 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Wabash National' AS label, 890 AS value, 23 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Heli' AS label, 900 AS value, 23 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Other Trailer' AS label, 980 AS value, 23 AS type, CAST(NULL AS INTEGER)
  

) AS tmp
WHERE NOT EXISTS (
  SELECT 1 FROM collateral.lookups 
  WHERE value = tmp.value 
    AND type = tmp.type 
    AND parent_lookup_id IS NULL
);
END $$; 
