DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_commodity_account' AND column_name = 'account_number') THEN
        ALTER TABLE collateral.collateral_cash_investments_commodity_account ADD COLUMN account_number VARCHAR(64);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_commodity_account' AND column_name = 'instrument_date') THEN
        ALTER TABLE collateral.collateral_cash_investments_commodity_account ADD COLUMN instrument_date DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_commodity_account' AND column_name = 'deposit_institution') THEN
        ALTER TABLE collateral.collateral_cash_investments_commodity_account ADD COLUMN deposit_institution VARCHAR(64);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_commodity_account' AND column_name = 'notice_of_sole_control') THEN
        ALTER TABLE collateral.collateral_cash_investments_commodity_account ADD COLUMN notice_of_sole_control BOOLEAN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_commodity_account' AND column_name = 'cobank_form') THEN
        ALTER TABLE collateral.collateral_cash_investments_commodity_account ADD COLUMN cobank_form BOOLEAN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_commodity_account' AND column_name = 'release_date') THEN
        ALTER TABLE collateral.collateral_cash_investments_commodity_account ADD COLUMN release_date DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_deposit_account' AND column_name = 'account_number') THEN
        ALTER TABLE collateral.collateral_cash_investments_deposit_account ADD COLUMN account_number VARCHAR(64);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_deposit_account' AND column_name = 'instrument_date') THEN
        ALTER TABLE collateral.collateral_cash_investments_deposit_account ADD COLUMN instrument_date DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_deposit_account' AND column_name = 'deposit_institution') THEN
        ALTER TABLE collateral.collateral_cash_investments_deposit_account ADD COLUMN deposit_institution VARCHAR(64);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_deposit_account' AND column_name = 'notice_of_sole_control') THEN
        ALTER TABLE collateral.collateral_cash_investments_deposit_account ADD COLUMN notice_of_sole_control BOOLEAN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_deposit_account' AND column_name = 'cobank_form') THEN
        ALTER TABLE collateral.collateral_cash_investments_deposit_account ADD COLUMN cobank_form BOOLEAN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_deposit_account' AND column_name = 'release_date') THEN
        ALTER TABLE collateral.collateral_cash_investments_deposit_account ADD COLUMN release_date DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_hedge_account' AND column_name = 'account_number') THEN
        ALTER TABLE collateral.collateral_cash_investments_hedge_account ADD COLUMN account_number VARCHAR(64);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_hedge_account' AND column_name = 'instrument_date') THEN
        ALTER TABLE collateral.collateral_cash_investments_hedge_account ADD COLUMN instrument_date DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_hedge_account' AND column_name = 'deposit_institution') THEN
        ALTER TABLE collateral.collateral_cash_investments_hedge_account ADD COLUMN deposit_institution VARCHAR(64);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_hedge_account' AND column_name = 'notice_of_sole_control') THEN
        ALTER TABLE collateral.collateral_cash_investments_hedge_account ADD COLUMN notice_of_sole_control BOOLEAN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_hedge_account' AND column_name = 'cobank_form') THEN
        ALTER TABLE collateral.collateral_cash_investments_hedge_account ADD COLUMN cobank_form BOOLEAN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_hedge_account' AND column_name = 'release_date') THEN
        ALTER TABLE collateral.collateral_cash_investments_hedge_account ADD COLUMN release_date DATE;
    END IF;
END $$;