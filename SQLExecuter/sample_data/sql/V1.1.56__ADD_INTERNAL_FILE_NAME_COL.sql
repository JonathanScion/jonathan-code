DO $$ 
BEGIN

    ALTER TABLE collateral.customer_documents ADD COLUMN internal_filename VARCHAR(1024);

    ALTER TABLE collateral.customer_documents ALTER COLUMN filename TYPE VARCHAR(256);
    ALTER TABLE collateral.customer_documents ALTER COLUMN filename SET NOT NULL;

    -- Deliberate error to do a dry run on the sql above
    --RAISE EXCEPTION 'Deliberate error to force rollback to test SQL'; 

END $$;