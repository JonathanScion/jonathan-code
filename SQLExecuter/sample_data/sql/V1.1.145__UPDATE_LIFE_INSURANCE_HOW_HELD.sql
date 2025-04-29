DO $$
BEGIN

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_life_insurance' AND column_name = 'how_held_lookup_id') THEN
        ALTER TABLE collateral.collateral_receivables_life_insurance ADD COLUMN how_held_lookup_id integer;
    END IF;

END $$;