DO $$ 
BEGIN

    ALTER TABLE collateral.customer_documents ALTER COLUMN file_size TYPE INTEGER;
    ALTER TABLE collateral.customer_documents ALTER COLUMN file_size SET NOT NULL;

    -- Deliberate error to do a dry run on the sql above
    --RAISE EXCEPTION 'Deliberate error to force rollback to test SQL'; 

END $$;