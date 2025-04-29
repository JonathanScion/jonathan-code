DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_pledged_note' AND column_name = 'note_number') THEN
        ALTER TABLE collateral.collateral_receivables_pledged_note ADD COLUMN note_number VARCHAR(64);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_pledged_note' AND column_name = 'note_amount') THEN
        ALTER TABLE collateral.collateral_receivables_pledged_note ADD COLUMN note_amount NUMERIC;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_pledged_note' AND column_name = 'note_date') THEN
        ALTER TABLE collateral.collateral_receivables_pledged_note ADD COLUMN note_date DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_pledged_note' AND column_name = 'note_maturity_date') THEN
        ALTER TABLE collateral.collateral_receivables_pledged_note ADD COLUMN note_maturity_date DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_pledged_note' AND column_name = 'allonge_required') THEN
        ALTER TABLE collateral.collateral_receivables_pledged_note ADD COLUMN allonge_required BOOLEAN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_pledged_note' AND column_name = 'dual_custody') THEN
        ALTER TABLE collateral.collateral_receivables_pledged_note ADD COLUMN dual_custody BOOLEAN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_pledged_note' AND column_name = 'obligor_customer_id') THEN
        ALTER TABLE collateral.collateral_receivables_pledged_note ADD COLUMN obligor_customer_id VARCHAR(64);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_pledged_note' AND column_name = 'obligee_customer_id') THEN
        ALTER TABLE collateral.collateral_receivables_pledged_note ADD COLUMN obligee_customer_id VARCHAR(64);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_pledged_note' AND column_name = 'released_to_customer_id') THEN
        ALTER TABLE collateral.collateral_receivables_pledged_note ADD COLUMN released_to_customer_id VARCHAR(64);
    END IF;
END $$;