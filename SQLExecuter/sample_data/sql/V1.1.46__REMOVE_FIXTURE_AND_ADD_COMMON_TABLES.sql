DO $$
BEGIN

DROP TABLE IF EXISTS collateral.fixture_related_parties;
DROP TABLE IF EXISTS collateral.fixture_document;


-- Customer Documents
CREATE TABLE
    collateral.customer_documents (
        document_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        customer_id VARCHAR(64) NOT NULL,
        real_estate_site_id INTEGER,
        real_estate_site_parcel_id INTEGER,
        fixture_id INTEGER,
        collateral_id INTEGER,
        filename VARCHAR(1024),
        title VARCHAR(128),
        description TEXT,
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

DROP INDEX IF EXISTS collateral.idx__document_customer;
CREATE INDEX idx__document_customer ON collateral.customer_documents (customer_id);

DROP INDEX IF EXISTS collateral.idx__document__tsv_weighted;
CREATE INDEX idx__document__tsv_weighted ON collateral.customer_documents USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.customer_documents ADD CONSTRAINT fk__doc_re_site_id FOREIGN KEY (real_estate_site_id) REFERENCES collateral.real_estate_sites (real_estate_site_id) ON DELETE CASCADE;
ALTER TABLE collateral.customer_documents ADD CONSTRAINT fk__doc_re_site_parcel_id FOREIGN KEY (real_estate_site_parcel_id) REFERENCES collateral.real_estate_site_parcels (real_estate_site_parcel_id) ON DELETE CASCADE;
ALTER TABLE collateral.customer_documents ADD CONSTRAINT fk__doc_fixture_id FOREIGN KEY (fixture_id) REFERENCES collateral.fixture (fixture_id) ON DELETE CASCADE;
ALTER TABLE collateral.customer_documents ADD CONSTRAINT fk__doc_collateral_id FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id) ON DELETE CASCADE;


-- Customer Notes
CREATE TABLE
    collateral.customer_notes (
        note_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        customer_id VARCHAR(64) NOT NULL,
        real_estate_site_id INTEGER,
        real_estate_site_parcel_id INTEGER,
        fixture_id INTEGER,
        collateral_id INTEGER,
        title VARCHAR(255) NOT NULL,
        author VARCHAR(100) NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        note TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

DROP INDEX IF EXISTS collateral.idx__notes__customer;
CREATE INDEX idx__notes__customer ON collateral.customer_notes (
    customer_id
);

DROP INDEX IF EXISTS collateral.idx__notes__tsv_weighted;
CREATE INDEX idx__notes__tsv_weighted ON collateral.customer_notes USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.customer_notes ADD CONSTRAINT fk__notes_re_site_id FOREIGN KEY (real_estate_site_id) REFERENCES collateral.real_estate_sites (real_estate_site_id) ON DELETE CASCADE;
ALTER TABLE collateral.customer_notes ADD CONSTRAINT fk__notes_re_site_parcel_id FOREIGN KEY (real_estate_site_parcel_id) REFERENCES collateral.real_estate_site_parcels (real_estate_site_parcel_id) ON DELETE CASCADE;
ALTER TABLE collateral.customer_notes ADD CONSTRAINT fk__notes_fixture_id FOREIGN KEY (fixture_id) REFERENCES collateral.fixture (fixture_id) ON DELETE CASCADE;
ALTER TABLE collateral.customer_notes ADD CONSTRAINT fk__notes_collateral_id FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id) ON DELETE CASCADE;


-- Customer Commitments
CREATE TABLE
    collateral.customer_commitments (
        commitment_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        customer_id VARCHAR(64) NOT NULL,
        real_estate_site_id INTEGER,
        real_estate_site_parcel_id INTEGER,
        fixture_id INTEGER,
        collateral_id INTEGER,
        commitment_name VARCHAR(255) NOT NULL,
        commitment_number VARCHAR(255) NOT NULL,
        party_customer_id VARCHAR(64) NOT NULL,
        party_name VARCHAR(255) NOT NULL,
        party_ownership_interest INTEGER,
        party_tenancy INTEGER,
        role VARCHAR(255),
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

DROP INDEX IF EXISTS collateral.idx__commitments_customer;
CREATE INDEX idx__commitments_customer ON collateral.customer_commitments (customer_id);

DROP INDEX IF EXISTS collateral.idx__commitments__tsv_weighted;
CREATE INDEX idx__commitments__tsv_weighted ON collateral.customer_commitments USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.customer_commitments ADD CONSTRAINT fk__com_re_site_id FOREIGN KEY (real_estate_site_id) REFERENCES collateral.real_estate_sites (real_estate_site_id) ON DELETE CASCADE;
ALTER TABLE collateral.customer_commitments ADD CONSTRAINT fk__com_re_site_parcel_id FOREIGN KEY (real_estate_site_parcel_id) REFERENCES collateral.real_estate_site_parcels (real_estate_site_parcel_id) ON DELETE CASCADE;
ALTER TABLE collateral.customer_commitments ADD CONSTRAINT fk__com_fixture_id FOREIGN KEY (fixture_id) REFERENCES collateral.fixture (fixture_id) ON DELETE CASCADE;
ALTER TABLE collateral.customer_commitments ADD CONSTRAINT fk__com_collateral_id FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id) ON DELETE CASCADE;


-- Customer Related Parties
CREATE TABLE
    collateral.customer_related_parties (
        related_party_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        customer_id VARCHAR(64) NOT NULL,

        real_estate_site_id INTEGER,
        real_estate_site_parcel_id INTEGER,
        fixture_id INTEGER,
        collateral_id INTEGER,

        party_customer_id VARCHAR(64) NOT NULL,
        party_name VARCHAR(255) NOT NULL,
        party_ownership_interest INTEGER,
        party_tenancy INTEGER,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

DROP INDEX IF EXISTS collateral.idx__related_parties__customer;
CREATE INDEX idx__related_parties__customer ON collateral.customer_related_parties (
    customer_id
);

DROP INDEX IF EXISTS collateral.idx__related_parties__tsv_weighted;
CREATE INDEX idx__related_parties__tsv_weighted ON collateral.customer_related_parties USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.customer_related_parties ADD CONSTRAINT fk__rel_part_re_site_id FOREIGN KEY (real_estate_site_id) REFERENCES collateral.real_estate_sites (real_estate_site_id) ON DELETE CASCADE;
ALTER TABLE collateral.customer_related_parties ADD CONSTRAINT fk__rel_part_re_site_parcel_id FOREIGN KEY (real_estate_site_parcel_id) REFERENCES collateral.real_estate_site_parcels (real_estate_site_parcel_id) ON DELETE CASCADE;
ALTER TABLE collateral.customer_related_parties ADD CONSTRAINT fk__rel_part_fixture_id FOREIGN KEY (fixture_id) REFERENCES collateral.fixture (fixture_id) ON DELETE CASCADE;
ALTER TABLE collateral.customer_related_parties ADD CONSTRAINT fk__rel_part_collateral_id FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id) ON DELETE CASCADE;


END $$;



