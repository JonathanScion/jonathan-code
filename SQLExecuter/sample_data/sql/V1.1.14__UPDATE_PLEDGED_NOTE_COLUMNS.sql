DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_pledged_note' AND column_name = 'obligor') THEN
        ALTER TABLE collateral.collateral_receivables_pledged_note ADD COLUMN obligor VARCHAR(64);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_pledged_note' AND column_name = 'obligor_customer_id') THEN
        UPDATE collateral.collateral_receivables_pledged_note
        SET obligor = obligor_customer_id, 
        obligor_customer_id = NULL;
        ALTER TABLE collateral.collateral_receivables_pledged_note DROP COLUMN obligor_customer_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_pledged_note' AND column_name = 'obligee') THEN
        ALTER TABLE collateral.collateral_receivables_pledged_note ADD COLUMN obligee VARCHAR(64);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_pledged_note' AND column_name = 'obligee_customer_id') THEN
        UPDATE collateral.collateral_receivables_pledged_note
        SET obligee = obligee_customer_id, 
        obligee_customer_id = NULL;
        ALTER TABLE collateral.collateral_receivables_pledged_note DROP COLUMN obligee_customer_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_pledged_note' AND column_name = 'released_to') THEN
        ALTER TABLE collateral.collateral_receivables_pledged_note ADD COLUMN released_to VARCHAR(64);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_receivables_pledged_note' AND column_name = 'obligor_customer_id') THEN
        UPDATE collateral.collateral_receivables_pledged_note
        SET released_to = released_to_customer_id, 
        released_to_customer_id = NULL;
        ALTER TABLE collateral.collateral_receivables_pledged_note DROP COLUMN released_to_customer_id;
    END IF;
END $$;