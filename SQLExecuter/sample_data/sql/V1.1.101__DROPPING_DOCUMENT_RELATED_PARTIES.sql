DO $$
BEGIN

    ALTER TABLE collateral.customer_documents DROP COLUMN related_parties;

END $$;