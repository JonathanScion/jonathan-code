DO $$
BEGIN

UPDATE collateral.lookups
SET label = 'Building (FEMA eligible)'
WHERE label = 'Building' AND type = 26;

UPDATE collateral.lookups
SET label = 'Building (not eligible)'
WHERE label = 'Construction' AND type = 26;

UPDATE collateral.lookups
SET label = 'Silo (FEMA eligible)'
WHERE label = 'Silo' AND type = 26;

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT * FROM (
  SELECT 'Silo (not eligible)' AS label, 4 AS value, 26 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Land only' AS label, 5 AS value, 26 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Construction' AS label, 6 AS value, 26 AS type, CAST(NULL AS INTEGER)
) AS tmp
WHERE NOT EXISTS (
  SELECT 1 FROM collateral.lookups 
  WHERE value = tmp.value 
    AND type = tmp.type 
    AND parent_lookup_id IS NULL
);

END $$;