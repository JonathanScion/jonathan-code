DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_commodity_account' AND column_name = 'release_date') THEN
        ALTER TABLE collateral.collateral_cash_investments_commodity_account DROP COLUMN release_date;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_deposit_account' AND column_name = 'release_date') THEN
        ALTER TABLE collateral.collateral_cash_investments_deposit_account DROP COLUMN release_date;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_hedge_account' AND column_name = 'release_date') THEN
        ALTER TABLE collateral.collateral_cash_investments_hedge_account DROP COLUMN release_date;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_personal_property_specific_aircraft' AND column_name = 'release_date') THEN
        ALTER TABLE collateral.collateral_personal_property_specific_aircraft DROP COLUMN release_date;
    END IF;

    INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
    SELECT * FROM (
    SELECT 'Multiple' AS label, 17 AS value, 18 AS type, CAST(NULL AS INTEGER)
    ) AS tmp
    WHERE NOT EXISTS (
    SELECT 1 FROM collateral.lookups 
    WHERE value = tmp.value 
        AND type = tmp.type 
        AND parent_lookup_id IS NULL
);
END $$;
