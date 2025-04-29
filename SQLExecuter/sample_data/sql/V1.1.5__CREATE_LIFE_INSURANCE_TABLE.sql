DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_life_insurance' AND column_name = 'issue_date') THEN
        ALTER TABLE collateral.collateral_receivables_life_insurance ADD COLUMN issue_date DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_life_insurance' AND column_name = 'how_held_lookup_id') THEN
        ALTER TABLE collateral.collateral_receivables_life_insurance ADD COLUMN how_held_lookup_id SMALLINT NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_life_insurance' AND column_name = 'policy_number') THEN
        ALTER TABLE collateral.collateral_receivables_life_insurance ADD COLUMN policy_number VARCHAR(64);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_life_insurance' AND column_name = 'insurance_company') THEN
        ALTER TABLE collateral.collateral_receivables_life_insurance ADD COLUMN insurance_company VARCHAR(64);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_life_insurance' AND column_name = 'insured_party') THEN
        ALTER TABLE collateral.collateral_receivables_life_insurance ADD COLUMN insured_party VARCHAR(64);
    END IF;
END $$;
