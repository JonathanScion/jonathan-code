DO $$
BEGIN
    -- Check if the column exists before altering it
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'collateral' 
          AND table_name = 'collateral_receivables_life_insurance' 
          AND column_name = 'how_held_lookup_id'
    ) THEN
        -- Drop the NOT NULL constraint
        ALTER TABLE collateral.collateral_receivables_life_insurance 
        ALTER COLUMN how_held_lookup_id DROP NOT NULL;
    END IF;
END $$;