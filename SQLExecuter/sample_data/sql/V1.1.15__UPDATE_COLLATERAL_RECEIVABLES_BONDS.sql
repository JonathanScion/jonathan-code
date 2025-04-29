DO $$
BEGIN

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_bonds' AND column_name = 'issue_date') THEN
        ALTER TABLE collateral.collateral_receivables_bonds ADD COLUMN issue_date TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_bonds' AND column_name = 'expiration_date') THEN
        ALTER TABLE collateral.collateral_receivables_bonds ADD COLUMN expiration_date TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_bonds' AND column_name = 'bond_id') THEN
        ALTER TABLE collateral.collateral_receivables_bonds ADD COLUMN bond_id TEXT;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_bonds' AND column_name = 'collateral_receivables_letter_of_credit_id') THEN
        ALTER TABLE collateral.collateral_receivables_bonds DROP COLUMN collateral_receivables_letter_of_credit_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_bonds' AND column_name = 'release_description') THEN
        ALTER TABLE collateral.collateral_receivables_bonds ADD COLUMN release_description TEXT;
    END IF;

END $$;