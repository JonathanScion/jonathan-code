DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_life_insurance' AND column_name = 'how_held_lookup_id') THEN
        ALTER TABLE collateral.collateral_receivables_life_insurance ALTER COLUMN how_held_lookup_id TYPE INTEGER;
    END IF;
END $$;
