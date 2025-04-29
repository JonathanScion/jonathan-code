-- 2024/12/5 - Sunny/Steve added lookups for the following two lookup types

-- PersonalPropertyWarehouseVendorName = 19,
-- PersonalPropertyCashInvestmentDepositInstitution = 20

DO $$
BEGIN

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT * FROM (
  SELECT 'Warehouse Vendor 1' AS label, 1 AS value, 19 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Warehouse Vendor 2' AS label, 2 AS value, 19 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Warehouse Vendor 3' AS label, 3 AS value, 19 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Ackers Banking' AS label, 2 AS value, 20 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'City Credit Union' AS label, 1 AS value, 20 AS type, CAST(NULL AS INTEGER) UNION ALL
  SELECT 'Chase Bank' AS label, 4 AS value, 20 AS type, CAST(NULL AS INTEGER)
) AS tmp
WHERE NOT EXISTS (
  SELECT 1 FROM collateral.lookups 
  WHERE value = tmp.value 
    AND type = tmp.type 
    AND parent_lookup_id IS NULL
);
END $$; 
