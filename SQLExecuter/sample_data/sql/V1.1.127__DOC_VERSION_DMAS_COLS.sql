DO $$
BEGIN

ALTER TABLE collateral.customer_document_versions ADD COLUMN dmas_document_id VARCHAR(64);
ALTER TABLE collateral.customer_document_versions ADD COLUMN dmas_version_id VARCHAR(64);

END $$;
