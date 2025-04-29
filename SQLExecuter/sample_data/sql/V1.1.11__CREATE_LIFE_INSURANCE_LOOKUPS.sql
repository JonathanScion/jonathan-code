DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_life_insurance' AND column_name = 'insurance_company_lookup_id') THEN
        ALTER TABLE collateral.collateral_receivables_life_insurance DROP COLUMN insurance_company;
        ALTER TABLE collateral.collateral_receivables_life_insurance ADD COLUMN insurance_company_lookup_id integer;
    END IF;

    INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
    SELECT * FROM (
        SELECT 'Aviva Life and Annuity Company' AS label, 1 AS value, 21 AS type, CAST(NULL AS INTEGER) UNION ALL
        SELECT 'Principal Life Insurance Company' AS label, 2 AS value, 21 AS type, CAST(NULL AS INTEGER)
    ) AS tmp
    WHERE NOT EXISTS (
        SELECT 1 FROM collateral.lookups 
        WHERE value = tmp.value 
          AND type = tmp.type 
          AND parent_lookup_id IS NULL
    );

END $$;
