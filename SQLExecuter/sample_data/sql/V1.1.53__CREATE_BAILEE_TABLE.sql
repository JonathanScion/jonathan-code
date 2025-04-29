DO $$ 
BEGIN

-- Create the bailee table
CREATE TABLE collateral.bailee_agreement (
    bailee_agreement_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id VARCHAR(64) NOT NULL,
    document_date TIMESTAMPTZ,
    bailor VARCHAR(64),
    status INTEGER,
    description TEXT,
    storage_address VARCHAR(64),
    release_date TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(64) NOT NULL,
    updated_by VARCHAR(64),
    deleted_by VARCHAR(64),
    text_search_vector_weighted TSVECTOR
);

CREATE INDEX idx__bailee__customer ON collateral.bailee_agreement (customer_id);

CREATE INDEX idx__bailee__tsv_weighted ON collateral.bailee_agreement USING GIN (text_search_vector_weighted);

-- Add a foreign key constraint to the bailee_agreement table
ALTER TABLE collateral.bailee_agreement ADD CONSTRAINT fk__bailee__customer FOREIGN KEY (customer_id) REFERENCES collateral.customers (customer_id) ON DELETE CASCADE;

END $$;