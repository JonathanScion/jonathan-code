DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_pledged_note' AND column_name = 'note_date_tz') THEN
        ALTER TABLE collateral.collateral_receivables_pledged_note ADD COLUMN note_date_tz TIMESTAMPTZ;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_pledged_note' AND column_name = 'note_date') THEN
        UPDATE collateral.collateral_receivables_pledged_note
        SET note_date_tz = note_date, 
        note_date = NULL;
        ALTER TABLE collateral.collateral_receivables_pledged_note DROP COLUMN note_date;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_pledged_note' AND column_name = 'note_maturity_date_tz') THEN
        ALTER TABLE collateral.collateral_receivables_pledged_note ADD COLUMN note_maturity_date_tz TIMESTAMPTZ;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_pledged_note' AND column_name = 'note_maturity_date') THEN
        UPDATE collateral.collateral_receivables_pledged_note
        SET note_maturity_date_tz = note_maturity_date, 
        note_maturity_date = NULL;
        ALTER TABLE collateral.collateral_receivables_pledged_note DROP COLUMN note_maturity_date;
    END IF;
END $$;
