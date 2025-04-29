-- 2025/2/5 - Update documents to support versioning in separate table

DO $$
BEGIN

    --DOCUMENTS BRIDGES
    TRUNCATE TABLE collateral.customer_documents_bridge CASCADE;

    ALTER TABLE collateral.customer_documents_bridge ADD COLUMN updated_at TIMESTAMPTZ;
    ALTER TABLE collateral.customer_documents_bridge ADD COLUMN updated_by VARCHAR(64);

    ALTER TABLE collateral.customer_documents_bridge RENAME TO customer_document_bridges;
    ALTER TABLE collateral.customer_document_bridges ADD CONSTRAINT fk__doc_bridges FOREIGN KEY (document_id) REFERENCES collateral.customer_documents (document_id);

    -- DOCUMENTS TABLE
    TRUNCATE TABLE collateral.customer_documents CASCADE;

    ALTER TABLE collateral.customer_documents DROP COLUMN instrument_date;
    ALTER TABLE collateral.customer_documents DROP COLUMN record_date;
    ALTER TABLE collateral.customer_documents DROP COLUMN internal_filename;
    ALTER TABLE collateral.customer_documents DROP COLUMN file_size;
    ALTER TABLE collateral.customer_documents DROP COLUMN title;
    ALTER TABLE collateral.customer_documents DROP COLUMN description;
    ALTER TABLE collateral.customer_documents DROP COLUMN version;

    ALTER TABLE collateral.customer_documents ADD COLUMN is_active BOOLEAN NOT NULL;
    ALTER TABLE collateral.customer_documents ADD COLUMN latest_version INTEGER NOT NULL;


    -- DOCUMENT VERSIONS
    CREATE TABLE collateral.customer_document_versions (
        document_version_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

        customer_id VARCHAR(64) NOT NULL,

        document_id INTEGER NOT NULL,

        version INT NOT NULL CHECK (version >= 1),  -- Versioning starts at 1

        storage_path VARCHAR(1024),

        file_hash VARCHAR(64),
        
        file_size INTEGER NOT NULL,

        description VARCHAR(2048),

        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(64) NOT NULL,
        updated_at TIMESTAMPTZ,
        updated_by VARCHAR(64),
        deleted_at TIMESTAMPTZ,
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

    CREATE INDEX idx__document_customer_version ON collateral.customer_document_versions (customer_id);

    ALTER TABLE collateral.customer_document_versions ADD CONSTRAINT fk__doc_versions FOREIGN KEY (document_id) REFERENCES collateral.customer_documents (document_id);

    --RAISE EXCEPTION 'Deliberate error to force rollback to test SQL'; 

END $$; 
