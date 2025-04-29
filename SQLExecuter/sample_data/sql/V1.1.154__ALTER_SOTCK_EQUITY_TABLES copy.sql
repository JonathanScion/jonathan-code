DO $$
BEGIN

-- 1. First, add customer_id columns as nullable
ALTER TABLE collateral.collateral_cash_investments_stock_certificate
    ADD COLUMN customer_id VARCHAR(64);

ALTER TABLE collateral.collateral_cash_investments_equity_non_cobank_interest
    ADD COLUMN customer_id VARCHAR(64);

-- 2. Populate customer_id in stock certificates table from parent table
UPDATE collateral.collateral_cash_investments_stock_certificate cert
SET customer_id = stock.customer_id
FROM collateral.collateral_cash_investments_stock stock
WHERE cert.collateral_cash_investments_stock_id = stock.collateral_cash_investments_stock_id;

-- 3. Populate customer_id in equity interests table from parent table
UPDATE collateral.collateral_cash_investments_equity_non_cobank_interest interest
SET customer_id = equity.customer_id
FROM collateral.collateral_cash_investments_equity_non_cobank equity
WHERE interest.collateral_cash_investments_equity_non_cobank_id = equity.collateral_cash_investments_equity_non_cobank_id;

-- 4. Now make the customer_id columns NOT NULL
ALTER TABLE collateral.collateral_cash_investments_stock_certificate
    ALTER COLUMN customer_id SET NOT NULL;

ALTER TABLE collateral.collateral_cash_investments_equity_non_cobank_interest
    ALTER COLUMN customer_id SET NOT NULL;

-- 5. Replace return_method_lookup with return_method_lookup_id in equity interest table
-- First, check if the column exists
IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'collateral' 
    AND table_name = 'collateral_cash_investments_equity_non_cobank_interest' 
    AND column_name = 'return_method_lookup'
) THEN
    -- Add the new column
    ALTER TABLE collateral.collateral_cash_investments_equity_non_cobank_interest
        ADD COLUMN return_method_lookup_id INTEGER;
    
    -- Copy data from old column to new column
    UPDATE collateral.collateral_cash_investments_equity_non_cobank_interest
        SET return_method_lookup_id = return_method_lookup;
    
    -- Drop the old column
    ALTER TABLE collateral.collateral_cash_investments_equity_non_cobank_interest
        DROP COLUMN return_method_lookup;
END IF;

-- 6. Replace return_method with return_method_lookup_id in stock certificate table if needed
-- First, check if the column exists
IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'collateral' 
    AND table_name = 'collateral_cash_investments_stock_certificate' 
    AND column_name = 'return_method'
) THEN
    -- Add the new column
    ALTER TABLE collateral.collateral_cash_investments_stock_certificate
        ADD COLUMN return_method_lookup_id INTEGER;
    
    -- Copy data from old column to new column
    UPDATE collateral.collateral_cash_investments_stock_certificate
        SET return_method_lookup_id = 
            CASE 
                WHEN return_method ~ '^[0-9]+$' THEN return_method::INTEGER
                ELSE NULL
            END;
    
    -- Drop the old column
    ALTER TABLE collateral.collateral_cash_investments_stock_certificate
        DROP COLUMN return_method;
END IF;

END $$;