DO $$
BEGIN
    --issuer_type is actually a lookup
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'collateral' 
        AND table_name = 'collateral_cash_investments_equity_non_cobank_interest' 
        AND column_name = 'issuer_type' 
        AND data_type = 'character varying'
    ) THEN
        ALTER TABLE collateral.collateral_cash_investments_equity_non_cobank_interest 
        ALTER COLUMN issuer_type TYPE integer;
    END IF;

    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'collateral' 
        AND table_name = 'collateral_cash_investments_stock_certificate' 
        AND column_name = 'issuer_type' 
        AND data_type = 'character varying'
    ) THEN
        ALTER TABLE collateral.collateral_cash_investments_stock_certificate
        ALTER COLUMN issuer_type TYPE integer;
    END IF;


    --issuer_type values
    INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
    SELECT * FROM (
    SELECT 'Corporation' AS label, 1 AS value, 47 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Cooperative association' AS label, 2 AS value, 47 AS type, CAST(NULL AS INTEGER) UNION ALL
    SELECT 'Limited liability company' AS label, 3 AS value, 47 AS type, CAST(NULL AS INTEGER)  UNION ALL
    SELECT 'Partnership' AS label, 3 AS value, 47 AS type, CAST(NULL AS INTEGER)  UNION ALL
    SELECT 'Other' AS label, 3 AS value, 47 AS type, CAST(NULL AS INTEGER)
    ) AS tmp
    WHERE NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = tmp.value 
        AND type = tmp.type 
        AND parent_lookup_id IS NULL
    );


END $$;