DO $$
BEGIN

ALTER TABLE collateral.collateral_cash_investments_stock_certificate
    ADD COLUMN stock_certificate_status_lookup_id INTEGER;

ALTER TABLE collateral.collateral_cash_investments_stock_certificate
    DROP COLUMN stock_certificate_status;

ALTER TABLE collateral.collateral_cash_investments_equity_non_cobank_interest
    ADD COLUMN equity_interest_status_lookup_id INTEGER;

ALTER TABLE collateral.collateral_cash_investments_equity_non_cobank_interest
    DROP COLUMN equity_interest_status;
    
END $$; 

