DO $$
BEGIN

DELETE FROM collateral.customer_document_bridges;

DELETE FROM collateral.customer_document_versions;
ALTER TABLE collateral.customer_document_versions DROP COLUMN version;
ALTER TABLE collateral.customer_document_versions ADD COLUMN version_major INT NOT NULL CHECK (version_major >= 1);  -- Versioning starts at 1
ALTER TABLE collateral.customer_document_versions ADD COLUMN version_minor INT NOT NULL CHECK (version_minor >= 0);  -- Versioning starts at 0

DELETE FROM collateral.customer_documents;
ALTER TABLE collateral.customer_documents DROP COLUMN latest_version;
ALTER TABLE collateral.customer_documents ADD COLUMN latest_version_major INT NOT NULL CHECK (latest_version_major >= 1);  -- Versioning starts at 1
ALTER TABLE collateral.customer_documents ADD COLUMN latest_version_minor INT NOT NULL CHECK (latest_version_minor >= 0);  -- Versioning starts at 0

END $$;