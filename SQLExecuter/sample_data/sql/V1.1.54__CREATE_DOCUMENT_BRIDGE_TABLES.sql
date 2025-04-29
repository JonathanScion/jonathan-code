DO $$ 
BEGIN


-- remove any existing test data ( this table is not being used by this version so any data is test data )
    TRUNCATE TABLE collateral.customer_documents;

-- Customer Documents FK drop


    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk__doc_re_site_id' AND conrelid = 'collateral.customer_documents'::regclass) THEN
        ALTER TABLE collateral.customer_documents DROP CONSTRAINT fk__doc_re_site_id;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk__doc_re_site_parcel_id' AND conrelid = 'collateral.customer_documents'::regclass) THEN
        ALTER TABLE collateral.customer_documents DROP CONSTRAINT fk__doc_re_site_parcel_id;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk__doc_fixture_id' AND conrelid = 'collateral.customer_documents'::regclass) THEN
        ALTER TABLE collateral.customer_documents DROP CONSTRAINT fk__doc_fixture_id;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk__doc_collateral_id' AND conrelid = 'collateral.customer_documents'::regclass) THEN
        ALTER TABLE collateral.customer_documents DROP CONSTRAINT fk__doc_collateral_id;
    END IF;


    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'collateral' 
        AND table_name = 'customer_documents' 
        AND column_name = 'real_estate_site_id'
    ) THEN
        -- Drop column from Customer Documents Bridge if it exists
        ALTER TABLE collateral.customer_documents DROP COLUMN real_estate_site_id;
    END IF;

    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'collateral' 
        AND table_name = 'customer_documents' 
        AND column_name = 'real_estate_site_parcel_id'
    ) THEN
        -- Drop column from Customer Documents Bridge if it exists
        ALTER TABLE collateral.customer_documents DROP COLUMN real_estate_site_parcel_id;
    END IF;

    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'collateral' 
        AND table_name = 'customer_documents' 
        AND column_name = 'fixture_id'
    ) THEN
        -- Drop column from Customer Documents Bridge if it exists
        ALTER TABLE collateral.customer_documents DROP COLUMN fixture_id;
    END IF;

    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'collateral' 
        AND table_name = 'customer_documents' 
        AND column_name = 'collateral_id'
    ) THEN
        -- Drop column from Customer Documents Bridge if it exists
        ALTER TABLE collateral.customer_documents DROP COLUMN collateral_id;
    END IF;

    -- Add new columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'customer_documents' AND column_name = 'transfer_status') THEN
        ALTER TABLE collateral.customer_documents ADD COLUMN transfer_status SMALLINT;
    END IF;
        
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'customer_documents' AND column_name = 'file_size') THEN
        ALTER TABLE collateral.customer_documents ADD COLUMN file_size SMALLINT NOT NULL;
    END IF;
        
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'customer_documents' AND column_name = 'instrument_date') THEN
        ALTER TABLE collateral.customer_documents ADD COLUMN instrument_date TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'customer_documents' AND column_name = 'record_date') THEN
        ALTER TABLE collateral.customer_documents ADD COLUMN record_date TIMESTAMPTZ;
    END IF;

-- Customer Documents Bridge
CREATE TABLE
    collateral.customer_documents_bridge (
        document_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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

CREATE INDEX idx__document_customer_bridge ON collateral.customer_documents_bridge (customer_id);

ALTER TABLE collateral.customer_documents_bridge ADD CONSTRAINT fk__doc_re_site_id FOREIGN KEY (real_estate_site_id) REFERENCES collateral.real_estate_sites (real_estate_site_id) ON DELETE CASCADE;
ALTER TABLE collateral.customer_documents_bridge ADD CONSTRAINT fk__doc_re_site_parcel_id FOREIGN KEY (real_estate_site_parcel_id) REFERENCES collateral.real_estate_site_parcels (real_estate_site_parcel_id) ON DELETE CASCADE;
ALTER TABLE collateral.customer_documents_bridge ADD CONSTRAINT fk__doc_fixture_id FOREIGN KEY (fixture_id) REFERENCES collateral.fixture (fixture_id) ON DELETE CASCADE;
ALTER TABLE collateral.customer_documents_bridge ADD CONSTRAINT fk__doc_collateral_id FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id) ON DELETE CASCADE;

-- Deliberate error to do a dry run on the sql above
--RAISE EXCEPTION 'Deliberate error to force rollback to test SQL'; 


END $$;