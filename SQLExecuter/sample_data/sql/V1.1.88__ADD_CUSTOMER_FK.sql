DO $$
BEGIN

ALTER TABLE collateral.flood_zone_requests ADD CONSTRAINT fk__fzr_customer FOREIGN KEY (customer_id) REFERENCES collateral.customers (customer_id) ON DELETE CASCADE;
ALTER TABLE collateral.flood_zone_determinations ADD CONSTRAINT fk__fzd_customer FOREIGN KEY (customer_id) REFERENCES collateral.customers (customer_id) ON DELETE CASCADE;


DELETE FROM collateral.customer_document_versions;
DELETE FROM collateral.customer_document_bridges;
DELETE FROM collateral.customer_documents;

ALTER TABLE collateral.customer_document_bridges ADD CONSTRAINT fk__docbridges_customer FOREIGN KEY (customer_id) REFERENCES collateral.customers (customer_id) ON DELETE CASCADE;
ALTER TABLE collateral.customer_document_bridges ADD CONSTRAINT fk__docbridges_doc FOREIGN KEY (document_id) REFERENCES collateral.customer_documents (document_id) ON DELETE CASCADE;

ALTER TABLE collateral.customer_document_versions ADD CONSTRAINT fk__docversions_customer FOREIGN KEY (customer_id) REFERENCES collateral.customers (customer_id) ON DELETE CASCADE;

ALTER TABLE collateral.customer_document_versions DROP CONSTRAINT fk__doc_versions;
ALTER TABLE collateral.customer_document_versions ADD CONSTRAINT fk__doc_versions FOREIGN KEY (document_id) REFERENCES collateral.customer_documents (document_id) ON DELETE CASCADE;

ALTER TABLE collateral.customer_documents ADD CONSTRAINT fk__docs_customer FOREIGN KEY (customer_id) REFERENCES collateral.customers (customer_id) ON DELETE CASCADE;
ALTER TABLE collateral.customer_notes ADD CONSTRAINT fk__notes_customer FOREIGN KEY (customer_id) REFERENCES collateral.customers (customer_id) ON DELETE CASCADE;
ALTER TABLE collateral.customer_commitments ADD CONSTRAINT fk__commitments_customer FOREIGN KEY (customer_id) REFERENCES collateral.customers (customer_id) ON DELETE CASCADE;

END $$; 

