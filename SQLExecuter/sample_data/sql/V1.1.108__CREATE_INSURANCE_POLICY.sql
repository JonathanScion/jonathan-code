DO $$
BEGIN

-- Insurance Policies
CREATE TABLE
    collateral.insurance_policies (
        insurance_policy_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        customer_id VARCHAR(64) NOT NULL,        

        policy_number VARCHAR(64),
        coverage_amount NUMERIC(15, 2),
        deductible_amount NUMERIC(15, 2),
        
        effective_date TIMESTAMPTZ,
        renewal_date TIMESTAMPTZ,

        policy_type_lookup_id SMALLINT NOT NULL,
        coverage_type_lookup_id SMALLINT,

        total_building_insurance_value NUMERIC(15, 2),
        total_contents_insurance_value NUMERIC(15, 2),

        syndicatable_commitments BOOLEAN,

        status_lookup_id SMALLINT NOT NULL,

        producer_party_id  VARCHAR(64) NOT NULL,

        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

    ALTER TABLE collateral.insurance_policies ADD CONSTRAINT fk__ins_policies__customer FOREIGN KEY (customer_id) REFERENCES collateral.customers (customer_id) ON DELETE CASCADE;
    CREATE INDEX idx__ins_pol__tsv_weighted ON collateral.insurance_policies USING GIN (text_search_vector_weighted);


-- INSURANCE POLICY CARRIERS
    CREATE TABLE collateral.insurance_policy_carriers (
        insurance_policy_carrier_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        customer_id VARCHAR(64) NOT NULL,
        insurance_policy_id INTEGER NOT NULL,

        carrier_name VARCHAR(128) NOT NULL,
        allocation_percentage NUMERIC(5, 2),
        captive_carrier BOOLEAN,
        captive_backup_carrier VARCHAR(128) NOT NULL,
        am_best_approved BOOLEAN,

        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(64) NOT NULL,
        updated_at TIMESTAMPTZ,
        updated_by VARCHAR(64),
        deleted_at TIMESTAMPTZ,
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );


    CREATE INDEX idx__ins_pol_carrier_customer ON collateral.insurance_policy_carriers (customer_id);
    ALTER TABLE collateral.insurance_policy_carriers ADD CONSTRAINT fk__ins_pol_carrier_ins_pol_id FOREIGN KEY (insurance_policy_id) REFERENCES collateral.insurance_policies (insurance_policy_id) ON DELETE CASCADE;
    CREATE INDEX idx__ins_pol_carrier__tsv_weighted ON collateral.insurance_policy_carriers USING GIN (text_search_vector_weighted);


-- INSURANCE POLICY INSURED PARTIES
    CREATE TABLE collateral.insurance_policy_insured_parties (
        insurance_policy_insured_party_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        customer_id VARCHAR(64) NOT NULL,
        insurance_policy_id INTEGER NOT NULL,
        
        party_id VARCHAR(64),
        other_party_name VARCHAR(128),
        secured_status_lookup_ip SMALLINT,

        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(64) NOT NULL,
        updated_at TIMESTAMPTZ,
        updated_by VARCHAR(64),
        deleted_at TIMESTAMPTZ,
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );


    CREATE INDEX idx__ins_pol_ins_part_customer ON collateral.insurance_policy_insured_parties (customer_id);
    ALTER TABLE collateral.insurance_policy_insured_parties ADD CONSTRAINT fk__ins_pol_ins_part_ins_pol_id FOREIGN KEY (insurance_policy_id) REFERENCES collateral.insurance_policies (insurance_policy_id) ON DELETE CASCADE;
    CREATE INDEX idx__ins_pol_ins_part__tsv_weighted ON collateral.insurance_policy_insured_parties USING GIN (text_search_vector_weighted);


-- INSURANCE POLICY INSURED ASSETS
    CREATE TABLE collateral.insurance_policy_assets (
        insurance_policy_asset_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        customer_id VARCHAR(64) NOT NULL,
        insurance_policy_id INTEGER NOT NULL,

        real_estate_site_id INTEGER,
        real_estate_site_parcel_id INTEGER,
        fixture_id INTEGER,
        collateral_id INTEGER,
        flood_zone_request_id INTEGER,
        flood_zone_determination_id INTEGER,
        bailee_agreement_id INTEGER,
        commitment_id INTEGER,
        mortgage_id INTEGER,

        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(64) NOT NULL,
        updated_at TIMESTAMPTZ,
        updated_by VARCHAR(64),
        deleted_at TIMESTAMPTZ,
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );


    CREATE INDEX idx__ins_pol_ins_asset_customer ON collateral.insurance_policy_assets (customer_id);
    ALTER TABLE collateral.insurance_policy_assets ADD CONSTRAINT fk__ins_pol_ins_asset_pol_id FOREIGN KEY (insurance_policy_id) REFERENCES collateral.insurance_policies (insurance_policy_id) ON DELETE CASCADE;
    CREATE INDEX idx__ins_pol_ins_asset__tsv_weighted ON collateral.insurance_policy_assets USING GIN (text_search_vector_weighted);



-- RENAME INSURANCE_ID TO INSURANCE_POLICY_ID
ALTER TABLE collateral.customer_documents DROP COLUMN insurance_id;
ALTER TABLE collateral.customer_documents DROP COLUMN mortgage_id;
ALTER TABLE collateral.customer_documents DROP COLUMN commitment_id;
ALTER TABLE collateral.customer_documents DROP COLUMN bailee_agreement_id;
ALTER TABLE collateral.customer_document_bridges DROP COLUMN insurance_id;
ALTER TABLE collateral.customer_notes DROP COLUMN insurance_id;
DROP TABLE collateral.insurances;

ALTER TABLE collateral.customer_notes ADD COLUMN insurance_policy_id INTEGER;
ALTER TABLE collateral.customer_notes ADD CONSTRAINT fk__cust_note_ins_policy_id FOREIGN KEY (insurance_policy_id) REFERENCES collateral.insurance_policies (insurance_policy_id) ON DELETE CASCADE;

ALTER TABLE collateral.customer_document_bridges ADD COLUMN insurance_policy_id INTEGER;
ALTER TABLE collateral.customer_document_bridges ADD CONSTRAINT fk__doc_bridge_ins_policy_id FOREIGN KEY (insurance_policy_id) REFERENCES collateral.insurance_policies (insurance_policy_id) ON DELETE CASCADE;


-- LOOKUPS

--InsurancePolicyTypes 36
INSERT INTO collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES 
  ('General Liability', 1, 36, 1, NULL),
  ('Property', 2, 36, 2, NULL),
  ('Flood', 3, 36, 3, NULL),
  ('Environmental', 4, 36, 4, NULL),
  ('Builders Risk', 5, 36, 5, NULL),
  ('Stock', 6, 36, 6, NULL),
  ('Cargo', 7, 36, 7, NULL),
  ('Blanket Policy', 8, 36, 8, NULL),
  ('Worker''s Comp', 9, 36, 9, NULL),
  ('Auto Liability', 10, 36, 10, NULL);



-- InsurancePolicyTypeCoverageTypes = 37
INSERT INTO collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES 
  ('Blanket Coverage', 1, 37, 1, NULL),
  ('Location-specific Coverage', 2, 37, 2, NULL);


-- InsurancePolicyStatuses = 38
INSERT INTO collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES 
  ('Active', 1, 38, 1, NULL),
  ('Cancelled - CoBank', 2, 38, 2, NULL),
  ('Cancelled - Customer', 3, 38, 3, NULL);


-- InsurancePolicyInsuredPartySecuredStatuses = 39
INSERT INTO collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES 
  ('Secured - Personal Property', 1, 39, 1, NULL),
  ('Secured - Real Property', 2, 39, 2, NULL),
  ('Secured - All Assets', 3, 39, 3, NULL),
  ('Unsecured', 4, 39, 4, NULL);

END $$;