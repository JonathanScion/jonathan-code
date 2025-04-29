DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_pledged_note' AND column_name = 'return_method_lookup') THEN
        ALTER TABLE collateral.collateral_receivables_pledged_note ADD COLUMN return_method_lookup INTEGER;
    END IF;
END $$;