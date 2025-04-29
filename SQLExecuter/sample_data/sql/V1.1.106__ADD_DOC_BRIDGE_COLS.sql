DO $$
BEGIN

    --add fields for document bridges
    ALTER TABLE collateral.customer_document_bridges ADD COLUMN bailee_agreement_id INTEGER;
    ALTER TABLE collateral.customer_document_bridges ADD COLUMN commitment_id INTEGER;
    ALTER TABLE collateral.customer_document_bridges ADD COLUMN mortgage_id INTEGER;
    ALTER TABLE collateral.customer_document_bridges ADD COLUMN insurance_id INTEGER;

END $$;