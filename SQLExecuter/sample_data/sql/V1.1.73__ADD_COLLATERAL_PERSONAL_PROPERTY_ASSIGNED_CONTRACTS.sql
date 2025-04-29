-- 2025/2/19 - 

DO $$
BEGIN

CREATE TABLE
    collateral.collateral_personal_property_general_assigned_contracts (
        collateral_personal_property_general_assigned_contract_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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

CREATE INDEX idx__col_personal_general_assigned_contracts ON collateral.collateral_personal_property_general_assigned_contracts (customer_id);

CREATE INDEX idx__col_personal_general_assigned_contracts__tsv_weighted ON collateral.collateral_personal_property_general_assigned_contracts USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_personal_property_general_assigned_contracts ADD CONSTRAINT fk__col_personal_general_assigned_contracts__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id) ON DELETE CASCADE;

END $$; 

