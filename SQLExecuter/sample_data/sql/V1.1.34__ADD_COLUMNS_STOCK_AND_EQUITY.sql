DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_equity_non_cobank' AND column_name = 'issuer_name') THEN
        ALTER TABLE collateral.collateral_cash_investments_equity_non_cobank ADD COLUMN issuer_name VARCHAR(64);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_equity_non_cobank' AND column_name = 'certificate_number') THEN
        ALTER TABLE collateral.collateral_cash_investments_equity_non_cobank ADD COLUMN certificate_number VARCHAR(64);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_equity_non_cobank' AND column_name = 'certificated') THEN
        ALTER TABLE collateral.collateral_cash_investments_equity_non_cobank ADD COLUMN certificated BOOLEAN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_equity_non_cobank' AND column_name = 'in_possession') THEN
        ALTER TABLE collateral.collateral_cash_investments_equity_non_cobank ADD COLUMN in_possession BOOLEAN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_equity_non_cobank' AND column_name = 'percentage_outstanding_shares') THEN
        ALTER TABLE collateral.collateral_cash_investments_equity_non_cobank ADD COLUMN percentage_outstanding_shares NUMERIC(5, 2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_equity_non_cobank' AND column_name = 'number_of_shares') THEN
        ALTER TABLE collateral.collateral_cash_investments_equity_non_cobank ADD COLUMN number_of_shares INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_equity_non_cobank' AND column_name = 'power_document') THEN
        ALTER TABLE collateral.collateral_cash_investments_equity_non_cobank ADD COLUMN power_document BOOLEAN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_equity_non_cobank' AND column_name = 'pledge_agreement') THEN
        ALTER TABLE collateral.collateral_cash_investments_equity_non_cobank ADD COLUMN pledge_agreement BOOLEAN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_equity_non_cobank' AND column_name = 'released_to') THEN
        ALTER TABLE collateral.collateral_cash_investments_equity_non_cobank ADD COLUMN released_to VARCHAR(64);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_equity_non_cobank' AND column_name = 'return_method_lookup') THEN
        ALTER TABLE collateral.collateral_cash_investments_equity_non_cobank ADD COLUMN return_method_lookup INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_stock' AND column_name = 'issuer_name') THEN
        ALTER TABLE collateral.collateral_cash_investments_stock ADD COLUMN issuer_name VARCHAR(64);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_stock' AND column_name = 'certificate_number') THEN
        ALTER TABLE collateral.collateral_cash_investments_stock ADD COLUMN certificate_number VARCHAR(64);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_stock' AND column_name = 'certificated') THEN
        ALTER TABLE collateral.collateral_cash_investments_stock ADD COLUMN certificated BOOLEAN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_stock' AND column_name = 'in_possession') THEN
        ALTER TABLE collateral.collateral_cash_investments_stock ADD COLUMN in_possession BOOLEAN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_stock' AND column_name = 'percentage_outstanding_shares') THEN
        ALTER TABLE collateral.collateral_cash_investments_stock ADD COLUMN percentage_outstanding_shares NUMERIC(5, 2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_stock' AND column_name = 'number_of_shares') THEN
        ALTER TABLE collateral.collateral_cash_investments_stock ADD COLUMN number_of_shares INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_stock' AND column_name = 'power_document') THEN
        ALTER TABLE collateral.collateral_cash_investments_stock ADD COLUMN power_document BOOLEAN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_stock' AND column_name = 'pledge_agreement') THEN
        ALTER TABLE collateral.collateral_cash_investments_stock ADD COLUMN pledge_agreement BOOLEAN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_stock' AND column_name = 'released_to') THEN
        ALTER TABLE collateral.collateral_cash_investments_stock ADD COLUMN released_to VARCHAR(64);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_stock' AND column_name = 'return_method_lookup') THEN
        ALTER TABLE collateral.collateral_cash_investments_stock ADD COLUMN return_method_lookup INTEGER;
    END IF;

END $$;
