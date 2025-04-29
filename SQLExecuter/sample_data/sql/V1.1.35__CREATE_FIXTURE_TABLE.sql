DO $$ 
BEGIN

-- Create the fixture table
CREATE TABLE collateral.fixture (
    fixture_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id VARCHAR(64) NOT NULL,
    fixture_description VARCHAR(2048),
    railroad_status BOOLEAN,
    fixture_status INTEGER,
    flood_zone_determination BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_by VARCHAR(64) NOT NULL,
    updated_by VARCHAR(64),
    deleted_by VARCHAR(64),
    text_search_vector_weighted TSVECTOR
);

CREATE INDEX idx__fix__customer ON collateral.fixture (customer_id);

CREATE INDEX idx__fix__tsv_weighted ON collateral.fixture USING GIN (text_search_vector_weighted);

-- Add a foreign key constraint to the fixture table
ALTER TABLE collateral.fixture ADD CONSTRAINT fk__fixture__customer FOREIGN KEY (customer_id) REFERENCES collateral.customers (customer_id) ON DELETE CASCADE;

-- Create the fixture_related_party table
CREATE TABLE collateral.fixture_related_parties (
    fixture_related_party_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fixture_id INTEGER NOT NULL,
    customer_id VARCHAR(64) NOT NULL,
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

CREATE INDEX idx__fix_related_parties ON collateral.fixture_related_parties (customer_id);

CREATE INDEX idx__fix_related_parties__tsv_weighted ON collateral.fixture_related_parties USING GIN (text_search_vector_weighted);

-- Add a foreign key constraint to the fixture_related_party table
ALTER TABLE collateral.fixture_related_parties ADD CONSTRAINT fk__fixture_related_parties__fixture FOREIGN KEY (fixture_id) REFERENCES collateral.fixture (fixture_id) ON DELETE CASCADE;

-- Create the fixture_document table
CREATE TABLE collateral.fixture_document (
    fixture_document_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fixture_id INTEGER NOT NULL,
    customer_id VARCHAR(64) NOT NULL,
    filename VARCHAR(1024),
    title VARCHAR(128),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_by VARCHAR(64) NOT NULL,
    updated_by VARCHAR(64),
    deleted_by VARCHAR(64),
    text_search_vector_weighted TSVECTOR
);

CREATE INDEX idx__fix_document ON collateral.fixture_document (customer_id);

CREATE INDEX idx__fix_document__tsv_weighted ON collateral.fixture_document USING GIN (text_search_vector_weighted);

-- Add a foreign key constraint to the fixture_document table
ALTER TABLE collateral.fixture_document ADD CONSTRAINT fk__fixture_document__fixture FOREIGN KEY (fixture_id) REFERENCES collateral.fixture (fixture_id) ON DELETE CASCADE;

END $$;