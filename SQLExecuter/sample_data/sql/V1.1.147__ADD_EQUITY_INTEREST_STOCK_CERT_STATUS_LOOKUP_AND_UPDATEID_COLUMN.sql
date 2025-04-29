DO $$
BEGIN

-- EquityNonCobankInterestStatus = 42
INSERT INTO collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES 
  ('Active', 1, 42, 1, NULL),
  ('Pending Release', 2, 42, 2, NULL),
  ('Released', 3, 42, 3, NULL);

-- StockCertificateStatus = 43
INSERT INTO collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES 
  ('Active', 1, 43, 1, NULL),
  ('Pending Release', 2, 43, 2, NULL),
  ('Released', 3, 43, 3, NULL);


-- First table: collateral_cash_investments_stock_certificate-- First table: collateral_cash_investments_stock_certificate
ALTER TABLE collateral.collateral_cash_investments_stock_certificate
ALTER COLUMN collateral_cash_investments_stock_certificate_id DROP DEFAULT;

-- Get the correct sequence name (run this separately to check)
-- SELECT pg_get_serial_sequence('collateral.collateral_cash_investments_stock_certificate', 'collateral_cash_investments_stock_certificate_id');

-- Drop the associated sequence (adjust name if needed based on the SELECT result)
DROP SEQUENCE IF EXISTS collateral.collateral_cash_investments_s_collateral_cash_investments__seq2 CASCADE;

-- Modify the column to use identity
ALTER TABLE collateral.collateral_cash_investments_stock_certificate
ALTER COLUMN collateral_cash_investments_stock_certificate_id ADD GENERATED ALWAYS AS IDENTITY;


-- Second table: collateral_cash_investments_equity_non_cobank_interest
ALTER TABLE collateral.collateral_cash_investments_equity_non_cobank_interest
ALTER COLUMN collateral_cash_investments_equity_non_cobank_interest_id DROP DEFAULT;

-- Get the correct sequence name (run this separately to check)
-- SELECT pg_get_serial_sequence('collateral.collateral_cash_investments_equity_non_cobank_interest', 'collateral_cash_investments_equity_non_cobank_interest_id');

-- Drop the associated sequence (adjust name if needed based on the SELECT result)
DROP SEQUENCE IF EXISTS collateral.collateral_cash_investments_equity_non_cobank_interest_id_seq CASCADE;

-- Modify the column to use identity
ALTER TABLE collateral.collateral_cash_investments_equity_non_cobank_interest
ALTER COLUMN collateral_cash_investments_equity_non_cobank_interest_id ADD GENERATED ALWAYS AS IDENTITY;

END $$;
