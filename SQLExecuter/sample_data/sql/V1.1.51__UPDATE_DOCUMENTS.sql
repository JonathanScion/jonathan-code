DO $$
BEGIN

    ALTER TABLE collateral.customer_documents ALTER COLUMN filename SET NOT NULL;
    
    -- Check if the column 'version' does not exist before adding it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='customer_documents' 
                   AND column_name='version') THEN
        ALTER TABLE collateral.customer_documents ADD COLUMN version INTEGER;
    END IF;

END $$;