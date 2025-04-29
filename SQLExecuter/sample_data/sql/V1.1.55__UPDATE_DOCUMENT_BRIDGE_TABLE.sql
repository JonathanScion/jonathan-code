DO $$ 
BEGIN

DROP TABLE collateral.customer_documents_bridge CASCADE;

CREATE TABLE
    collateral.customer_documents_bridge (
        document_bridge_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        document_id INTEGER NOT NULL,
        customer_id VARCHAR(64) NOT NULL,
        real_estate_site_id INTEGER,
        real_estate_site_parcel_id INTEGER,
        fixture_id INTEGER,
        collateral_id INTEGER,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(64) NOT NULL,
        deleted_at TIMESTAMPTZ,
        deleted_by VARCHAR(64)
    );

CREATE INDEX idx__document_bridge_customer ON collateral.customer_documents_bridge (customer_id);
CREATE INDEX idx__document_bridge_document ON collateral.customer_documents_bridge (document_id);

ALTER TABLE collateral.customer_documents_bridge ADD CONSTRAINT fk__doc_re_site_id FOREIGN KEY (real_estate_site_id) REFERENCES collateral.real_estate_sites (real_estate_site_id) ON DELETE CASCADE;
ALTER TABLE collateral.customer_documents_bridge ADD CONSTRAINT fk__doc_re_site_parcel_id FOREIGN KEY (real_estate_site_parcel_id) REFERENCES collateral.real_estate_site_parcels (real_estate_site_parcel_id) ON DELETE CASCADE;
ALTER TABLE collateral.customer_documents_bridge ADD CONSTRAINT fk__doc_fixture_id FOREIGN KEY (fixture_id) REFERENCES collateral.fixture (fixture_id) ON DELETE CASCADE;
ALTER TABLE collateral.customer_documents_bridge ADD CONSTRAINT fk__doc_collateral_id FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id) ON DELETE CASCADE;

-- Deliberate error to do a dry run on the sql above
--RAISE EXCEPTION 'Deliberate error to force rollback to test SQL'; 

END $$;