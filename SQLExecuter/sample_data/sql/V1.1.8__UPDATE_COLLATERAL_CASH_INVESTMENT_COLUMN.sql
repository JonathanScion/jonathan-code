DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_commodity_account' AND column_name = 'deposit_institution') THEN
        ALTER TABLE collateral.collateral_cash_investments_commodity_account DROP COLUMN deposit_institution;
        ALTER TABLE collateral.collateral_cash_investments_commodity_account ADD COLUMN deposit_institution_lookup integer;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_deposit_account' AND column_name = 'deposit_institution') THEN
        ALTER TABLE collateral.collateral_cash_investments_deposit_account DROP COLUMN deposit_institution;
        ALTER TABLE collateral.collateral_cash_investments_deposit_account ADD COLUMN deposit_institution_lookup integer;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_hedge_account' AND column_name = 'deposit_institution') THEN
        ALTER TABLE collateral.collateral_cash_investments_hedge_account DROP COLUMN deposit_institution;
        ALTER TABLE collateral.collateral_cash_investments_hedge_account ADD COLUMN deposit_institution_lookup integer;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_warehouse_receipt' AND column_name = 'vendor_name') THEN
        ALTER TABLE collateral.collateral_receivables_warehouse_receipt DROP COLUMN vendor_name;
        ALTER TABLE collateral.collateral_receivables_warehouse_receipt ADD COLUMN vendor_name_lookup integer;
    END IF;
END $$;