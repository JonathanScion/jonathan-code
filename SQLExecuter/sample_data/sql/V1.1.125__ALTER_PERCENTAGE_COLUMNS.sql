DO $$
BEGIN

IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_equity_non_cobank' AND column_name = 'percentage_outstanding_shares') THEN
    ALTER TABLE collateral.collateral_cash_investments_equity_non_cobank 
    ALTER COLUMN percentage_outstanding_shares TYPE NUMERIC(9, 6);
END IF;

IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_stock' AND column_name = 'percentage_outstanding_shares') THEN
    ALTER TABLE collateral.collateral_cash_investments_stock 
    ALTER COLUMN percentage_outstanding_shares TYPE NUMERIC(9, 6);
END IF;

END $$;