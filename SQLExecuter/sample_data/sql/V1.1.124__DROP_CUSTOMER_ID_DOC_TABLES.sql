DO $$
BEGIN

ALTER TABLE collateral.customer_documents DROP COLUMN customer_id;
ALTER TABLE collateral.customer_document_versions DROP COLUMN customer_id;

END $$;

