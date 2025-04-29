DO $$
BEGIN

  DROP TABLE IF EXISTS collateral.insurance_policy_insured_parties;
  DROP TABLE IF EXISTS collateral.insurance_policy_assets;
  DROP TABLE IF EXISTS collateral.insurance_policy_carriers;
  DROP TABLE IF EXISTS collateral.insurance_policies CASCADE;

-- Insurance Certificate
  CREATE TABLE
    collateral.insurance_certificates (
        insurance_certificate_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        customer_id VARCHAR(64) NOT NULL,  
        syndicatable_commitments BOOLEAN,  
        producer_party_id  VARCHAR(64),  

        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

  CREATE INDEX idx__ins_cert_customer ON collateral.insurance_certificates (customer_id);
  ALTER TABLE collateral.insurance_certificates ADD CONSTRAINT fk__ins_cert__customer FOREIGN KEY (customer_id) REFERENCES collateral.customers (customer_id) ON DELETE CASCADE;
  CREATE INDEX idx__ins_cert__tsv_weighted ON collateral.insurance_certificates USING GIN (text_search_vector_weighted);

  
-- Insurance Policies
  CREATE TABLE
    collateral.insurance_certificate_policies (
      insurance_certificate_policy_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      customer_id VARCHAR(64) NOT NULL,  
      insurance_certificate_id INTEGER NOT NULL, 

      policy_number VARCHAR(64),
      
      effective_date TIMESTAMPTZ,
      renewal_date TIMESTAMPTZ,
      expiration_date TIMESTAMPTZ,

      status_lookup_id SMALLINT NOT NULL,

      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ,
      deleted_at TIMESTAMPTZ,
      created_by VARCHAR(64) NOT NULL,
      updated_by VARCHAR(64),
      deleted_by VARCHAR(64),
      text_search_vector_weighted TSVECTOR
    );

    CREATE INDEX idx__ins_cert_pol_customer ON collateral.insurance_certificate_policies (customer_id);
    ALTER TABLE collateral.insurance_certificate_policies ADD CONSTRAINT fk__ins_certificate_policies__ins_cert_id FOREIGN KEY (insurance_certificate_id) REFERENCES collateral.insurance_certificates (insurance_certificate_id) ON DELETE CASCADE;
    CREATE INDEX idx__ins_pol__tsv_weighted ON collateral.insurance_certificate_policies USING GIN (text_search_vector_weighted);



  -- INSURANCE CERTIFICATE INSURED PARTIES
  CREATE TABLE collateral.insurance_certificate_insured_parties (
    insurance_certificate_insured_party_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id VARCHAR(64) NOT NULL,
    insurance_certificate_id INTEGER NOT NULL,        
    party_id VARCHAR(64),
    other_party_name VARCHAR(128),
    secured_status_lookup_id SMALLINT,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(64) NOT NULL,
    updated_at TIMESTAMPTZ,
    updated_by VARCHAR(64),
    deleted_at TIMESTAMPTZ,
    deleted_by VARCHAR(64),
    text_search_vector_weighted TSVECTOR
  );

  CREATE INDEX idx__ins_cert_ins_party_customer ON collateral.insurance_certificate_insured_parties (customer_id);
  ALTER TABLE collateral.insurance_certificate_insured_parties ADD CONSTRAINT fk__ins_cert_ins_party_ins_cert_id FOREIGN KEY (insurance_certificate_id) REFERENCES collateral.insurance_certificates (insurance_certificate_id) ON DELETE CASCADE;
  CREATE INDEX idx__ins_cert_ins_part__tsv_weighted ON collateral.insurance_certificate_insured_parties USING GIN (text_search_vector_weighted);


  -- INSURANCE POLICY INSURED ASSETS
  CREATE TABLE collateral.insurance_policy_assets (
    insurance_policy_asset_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id VARCHAR(64) NOT NULL,
    insurance_certificate_policy_id INTEGER NOT NULL,

    real_estate_site_id INTEGER,
    real_estate_site_parcel_id INTEGER,
    fixture_id INTEGER,
    collateral_id INTEGER,
    improvement_id INTEGER,
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
  ALTER TABLE collateral.insurance_policy_assets ADD CONSTRAINT fk__ins_pol_ins_asset_pol_id FOREIGN KEY (insurance_certificate_policy_id) REFERENCES collateral.insurance_certificate_policies (insurance_certificate_policy_id) ON DELETE CASCADE;
  CREATE INDEX idx__ins_pol_ins_asset__tsv_weighted ON collateral.insurance_policy_assets USING GIN (text_search_vector_weighted);

  -- INSURANCE POLICY CARRIERS
  CREATE TABLE collateral.insurance_policy_carriers (
    insurance_policy_carrier_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id VARCHAR(64) NOT NULL,
    insurance_certificate_policy_id INTEGER NOT NULL,

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
  ALTER TABLE collateral.insurance_policy_carriers ADD CONSTRAINT fk__ins_pol_carrier_ins_pol_id FOREIGN KEY (insurance_certificate_policy_id) REFERENCES collateral.insurance_certificate_policies (insurance_certificate_policy_id) ON DELETE CASCADE;
  CREATE INDEX idx__ins_pol_carrier__tsv_weighted ON collateral.insurance_policy_carriers USING GIN (text_search_vector_weighted);

  -- INSURANCE COVERAGES
  CREATE TABLE collateral.insurance_policy_coverages (
    insurance_policy_coverage_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id VARCHAR(64) NOT NULL,
    insurance_certificate_policy_id INTEGER NOT NULL,

    coverage_type_lookup_id SMALLINT NOT NULL,

    covered_sites VARCHAR(1024),
    total_structure_insurance_value NUMERIC(15, 2),
    total_contents_insurance_value NUMERIC(15, 2),
    required_structure_insurance NUMERIC(15, 2),
    required_contents_insurance NUMERIC(15, 2),

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(64) NOT NULL,
    updated_at TIMESTAMPTZ,
    updated_by VARCHAR(64),
    deleted_at TIMESTAMPTZ,
    deleted_by VARCHAR(64),
    text_search_vector_weighted TSVECTOR
  );

  CREATE INDEX idx__ins_pol_coverage_customer ON collateral.insurance_policy_coverages (customer_id);
  ALTER TABLE collateral.insurance_policy_coverages ADD CONSTRAINT fk__ins_pol_coverage_ins_pol_id FOREIGN KEY (insurance_certificate_policy_id) REFERENCES collateral.insurance_certificate_policies (insurance_certificate_policy_id) ON DELETE CASCADE;
  CREATE INDEX idx__ins_pol_coverage__tsv_weighted ON collateral.insurance_policy_carriers USING GIN (text_search_vector_weighted);


  --Additional InsurancePolicyTypes 36
INSERT INTO collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES 
  ('Location-specific Policy', 11, 36, 11, NULL),
  ('Earthquake', 12, 36, 12, NULL),
  ('Cyber Security', 13, 36, 13, NULL),
  ('Umbrella Liability', 14, 36, 14, NULL),
  ('Errors and Omissions', 15, 36, 15, NULL),
  ('Boiler & Machinery/Equipment Breakdown', 16, 36, 16, NULL),
  ('Contractors Equipment', 17, 36, 17, NULL),
  ('Inland Marine', 18, 36, 18, NULL),
  ('Professional Liability', 19, 36, 19, NULL),
  ('Pollution Liability', 20, 36, 20, NULL),
  ('Excess Liability', 21, 36, 21, NULL);

END $$;