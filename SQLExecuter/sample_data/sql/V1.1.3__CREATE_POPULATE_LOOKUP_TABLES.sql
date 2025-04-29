--Lookup Types
--  SecurityStatus = 1,
--  SiteTypes = 2,
--  SiteStatus = 3,
--  RailRoadProperty = 4,
--  CollateralType = 5,
--  OwnershipInterestType = 6,
--  TenancyType = 7,
--  RealEstateHeaderStatus = 8,
--  BuildingCarveOut = 9,
--  FixtureStatus = 10,
--  ImprovementStatus = 11,
--  ParcelStatus = 12,
--  PersonalPropertyStatus = 13,
--  PersonalPropertyLifeInsuranceHowHeldType = 14
--  PersonalPropertyVehicleFormOfEvidence = 15
--  PersonalPropertyReturnMethod = 16
--  PersonalPropertySubmissionMethod = 17
--  PersonalPropertyWarehouseReceiptCommodityType = 18
--  PersonalPropertyWarehouseVendorName = 19,
--  PersonalPropertyCashInvestmentDepositInstitution = 20,
--  PersonalPropertyLifeInsuranceInsuranceCompanyType = 21,
--  PersonalPropertyVehicleMake = 22,
--  PersonalPropertyTrailerMake = 23,
--  FixtureActiveStatus = 24
--  DocumentType = 25

--  Lookup Values

DO $$
BEGIN

CREATE TABLE
    collateral.lookups (
        lookup_id SERIAL PRIMARY KEY,
        label VARCHAR(128) NOT NULL,
        value INTEGER NOT NULL,
        type SMALLINT NOT NULL,
        parent_lookup_id INTEGER
    );

ALTER TABLE collateral.lookups ADD CONSTRAINT fk__lookups__parent_lookup FOREIGN KEY (parent_lookup_id) REFERENCES collateral.lookups (lookup_id);

ALTER TABLE collateral.lookups ADD CONSTRAINT unique_lookup UNIQUE (value, type, parent_lookup_id);


INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT * FROM (
  SELECT 'Active' AS label, 1 AS value, 1 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Inactive' AS label, 2 AS value, 1 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Headquarters' AS label, 1 AS value, 2 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Operating facilities' AS label, 2 AS value, 2 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Warehouse buildings' AS label, 3 AS value, 2 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Pump stations' AS label, 4 AS value, 2 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Data centers' AS label, 5 AS value, 2 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Other' AS label, 6 AS value, 2 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Active' AS label, 1 AS value, 3 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Inactive' AS label, 2 AS value, 3 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Receivables' AS label, 1 AS value, 5 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Real estate' AS label, 2 AS value, 5 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Personal property - specific' AS label, 3 AS value, 5 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Personal property - general' AS label, 4 AS value, 5 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Titled property' AS label, 5 AS value, 5 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Extracted collateral' AS label, 6 AS value, 5 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Intellectual property' AS label, 7 AS value, 5 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Cash / investments' AS label, 8 AS value, 5 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Fee simple' AS label, 1 AS value, 6 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Leasehold' AS label, 2 AS value, 6 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'JTWROS' AS label, 1 AS value, 7 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Tenants in common' AS label, 2 AS value, 7 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Active' AS label, 1 AS value, 8 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Inactive' AS label, 2 AS value, 8 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'NA' AS label, 1 AS value, 9 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Carve-out building' AS label, 2 AS value, 9 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Blanket carve-out' AS label, 3 AS value, 9 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Building (FEMA eligible)' AS label, 1 AS value, 10 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Building (not eligible)' AS label, 2 AS value, 10 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Silo (FEMA eligible)' AS label, 3 AS value, 10 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Silo (not eligible)' AS label, 4 AS value, 10 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Land only' AS label, 5 AS value, 10 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Construction' AS label, 6 AS value, 10 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Vacant' AS label, 1 AS value, 11 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Improved' AS label, 2 AS value, 11 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Active' AS label, 1 AS value, 12 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Released' AS label, 2 AS value, 12 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Pending release' AS label, 3 AS value, 12 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'In process' AS label, 4 AS value, 12 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Potential future use' AS label, 5 AS value, 12 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Active' AS label, 1 AS value, 13 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Released' AS label, 2 AS value, 13 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Pending Release' AS label, 3 AS value, 13 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Beneficiary' AS label, 1 AS value, 14 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Pledged' AS label, 2 AS value, 14 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Electronic' AS label, 1 AS value, 15 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Paper' AS label, 2 AS value, 15 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Mail' AS label, 1 AS value, 16 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Email' AS label, 2 AS value, 16 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'FedEx' AS label, 3 AS value, 16 AS type, CAST(NULL AS INTEGER) UNION ALL 
    SELECT 'Other' AS label, 4 AS value, 16 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Paper' AS label, 1 AS value, 17 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Electronic' AS label, 2 AS value, 17 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Barley' AS label, 1 AS value, 18 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Beans' AS label, 2 AS value, 18 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Beans Navy' AS label, 3 AS value, 18 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Beans White' AS label, 4 AS value, 18 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Beets' AS label, 5 AS value, 18 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Canola' AS label, 6 AS value, 18 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Corn' AS label, 7 AS value, 18 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Corn Yellow' AS label, 8 AS value, 18 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Rice' AS label, 9 AS value, 18 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Sh Corn' AS label, 10 AS value, 18 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Sorghum' AS label, 11 AS value, 18 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Soybeans' AS label, 12 AS value, 18 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Wheat' AS label, 13 AS value, 18 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Wheat Hard Red Winter' AS label, 14 AS value, 18 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Wheat Soft Red' AS label, 15 AS value, 18 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Wheat White' AS label, 16 AS value, 18 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'eGrain' AS label, 1 AS value, 19 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'EWR' AS label, 2 AS value, 19 AS type, CAST(NULL AS INTEGER)

) AS tmp
WHERE NOT EXISTS (
  SELECT 1 FROM collateral.lookups 
  WHERE value = tmp.value 
    AND type = tmp.type 
    AND parent_lookup_id IS NULL
);

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Warehouse receipt', 1, 5, lookup_id
FROM collateral.lookups
WHERE value = 1 AND type = 5 AND parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 1 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Chattel - paper', 2, 5, lookup_id
FROM collateral.lookups
WHERE value = 1 AND type = 5 AND parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 2 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Letter of credit', 3, 5, lookup_id
FROM collateral.lookups
WHERE value = 1 AND type = 5 AND parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 3 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Accounts receivable', 4, 5, lookup_id
FROM collateral.lookups
WHERE value = 1 AND type = 5 AND parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 4 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Life insurance', 5, 5, lookup_id
FROM collateral.lookups
WHERE value = 1 AND type = 5 AND parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 5 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Pledged note', 6, 5, lookup_id
FROM collateral.lookups
WHERE value = 1 AND type = 5 AND parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 6 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Bonds', 7, 5, lookup_id
FROM collateral.lookups
WHERE value = 1 AND type = 5 AND parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 7 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Real estate', 1, 5, lookup_id
FROM collateral.lookups
WHERE value = 2 AND type = 5 AND parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 1 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Revenues', 1, 5, lookup_id
FROM collateral.lookups
WHERE value = 3 AND type = 5 and parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 1 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Consumer goods', 2, 5, lookup_id
FROM collateral.lookups
WHERE value = 3 AND type = 5 and parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 2 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Equipment', 3, 5, lookup_id
FROM collateral.lookups
WHERE value = 3 AND type = 5 and parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 3 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Crops', 4, 5, lookup_id
FROM collateral.lookups
WHERE value = 3 AND type = 5 and parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 4 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Livestock', 5, 5, lookup_id
FROM collateral.lookups
WHERE value = 3 AND type = 5 and parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 5 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Inventory', 6, 5, lookup_id
FROM collateral.lookups
WHERE value = 3 AND type = 5 and parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 6 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Aircraft', 7, 5, lookup_id
FROM collateral.lookups
WHERE value = 3 AND type = 5 and parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 7 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'RIBG - general business assets', 1, 5, lookup_id
FROM collateral.lookups
WHERE value = 4 AND type = 5 and parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 1 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Vehicle', 1, 5, lookup_id
FROM collateral.lookups
WHERE value = 5 AND type = 5 AND parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 1 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Railroad cars', 2, 5, lookup_id
FROM collateral.lookups
WHERE value = 5 AND type = 5 AND parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 2 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Vessels', 3, 5, lookup_id
FROM collateral.lookups
WHERE value = 5 AND type = 5 AND parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 3 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Trailers', 4, 5, lookup_id
FROM collateral.lookups
WHERE value = 5 AND type = 5 AND parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 4 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Oil/gas', 1, 5, lookup_id
FROM collateral.lookups
WHERE value = 6 AND type = 5 AND parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 1 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Minerals', 2, 5, lookup_id
FROM collateral.lookups
WHERE value = 6 AND type = 5 AND parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 2 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Patents', 1, 5, lookup_id
FROM collateral.lookups
WHERE value = 7 AND type = 5 AND parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 1 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Trademark', 2, 5, lookup_id
FROM collateral.lookups
WHERE value = 7 AND type = 5 AND parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 2 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Copyrights', 3, 5, lookup_id
FROM collateral.lookups
WHERE value = 7 AND type = 5 AND parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 3 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Commodity account', 1, 5, lookup_id
FROM collateral.lookups
WHERE value = 8 AND type = 5 AND parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 1 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Deposit account', 2, 5, lookup_id
FROM collateral.lookups
WHERE value = 8 AND type = 5 AND parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 2 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Hedge account', 3, 5, lookup_id
FROM collateral.lookups
WHERE value = 8 AND type = 5 AND parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 3 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Equity (non-CoBank)', 4, 5, lookup_id
FROM collateral.lookups
WHERE value = 8 AND type = 5 AND parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 4 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Bailee', 5, 5, lookup_id
FROM collateral.lookups
WHERE value = 8 AND type = 5 AND parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 5 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);

INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
SELECT 'Stock', 6, 5, lookup_id
FROM collateral.lookups
WHERE value = 8 AND type = 5 AND parent_lookup_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = 6 
      AND type = 5 
      AND parent_lookup_id = lookup_id
);


END $$;