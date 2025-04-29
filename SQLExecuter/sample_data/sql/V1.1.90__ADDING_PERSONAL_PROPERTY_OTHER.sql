DO $$
BEGIN

CREATE TABLE
    collateral.collateral_other_other_assets (
        collateral_other_other_asset_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        collateral_id INT NOT NULL,
        customer_id VARCHAR(64) NOT NULL,
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

CREATE INDEX idx__col_other_other_asset ON collateral.collateral_other_other_assets (customer_id);

CREATE INDEX idx__col_other_other_asset__tsv_weighted ON collateral.collateral_other_other_assets USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_other_other_assets ADD CONSTRAINT fk__col_other_other_asset__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id) ON DELETE CASCADE;

END $$; 

