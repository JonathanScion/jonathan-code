DO $$
BEGIN

CREATE TABLE
    collateral.collateral_cash_investments_securities_account (
        collateral_cash_investments_securities_account_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        collateral_id INT NOT NULL,
        customer_id VARCHAR(64) NOT NULL,
        account_number VARCHAR(64) NOT NULL,
        instrument_date TIMESTAMPTZ,
        deposit_institution VARCHAR(64),
        notice_of_sole_control BOOLEAN,
        cobank_form BOOLEAN,
        release_date TIMESTAMPTZ,
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

CREATE INDEX idx__col_cash_investments_securities_account ON collateral.collateral_cash_investments_securities_account (customer_id);

CREATE INDEX idx__col_cash_investments_securities_account__tsv_weighted ON collateral.collateral_cash_investments_securities_account USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_cash_investments_securities_account ADD CONSTRAINT fk__col_cash_investments_securities_account__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);


    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_securities_account' AND column_name = 'account_number') THEN
        ALTER TABLE collateral.collateral_cash_investments_securities_account ADD COLUMN account_number VARCHAR(64);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_securities_account' AND column_name = 'instrument_date') THEN
        ALTER TABLE collateral.collateral_cash_investments_securities_account ADD COLUMN instrument_date DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_securities_account' AND column_name = 'deposit_institution') THEN
        ALTER TABLE collateral.collateral_cash_investments_securities_account ADD COLUMN deposit_institution VARCHAR(64);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_securities_account' AND column_name = 'notice_of_sole_control') THEN
        ALTER TABLE collateral.collateral_cash_investments_securities_account ADD COLUMN notice_of_sole_control BOOLEAN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_securities_account' AND column_name = 'cobank_form') THEN
        ALTER TABLE collateral.collateral_cash_investments_securities_account ADD COLUMN cobank_form BOOLEAN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_securities_account' AND column_name = 'release_date') THEN
        ALTER TABLE collateral.collateral_cash_investments_securities_account ADD COLUMN release_date DATE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_securities_account' AND column_name = 'deposit_institution') THEN
        ALTER TABLE collateral.collateral_cash_investments_securities_account DROP COLUMN deposit_institution;
        ALTER TABLE collateral.collateral_cash_investments_securities_account ADD COLUMN deposit_institution_lookup integer;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_cash_investments_securities_account' AND column_name = 'release_date') THEN
        ALTER TABLE collateral.collateral_cash_investments_securities_account DROP COLUMN release_date;
    END IF;

    ALTER TABLE collateral.collateral_cash_investments_securities_account DROP CONSTRAINT IF EXISTS fk__col_cash_investments_securities_account__collateral;
    ALTER TABLE collateral.collateral_cash_investments_securities_account ADD CONSTRAINT fk__col_cash_investments_securities_account__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id) ON DELETE CASCADE;

END $$;

