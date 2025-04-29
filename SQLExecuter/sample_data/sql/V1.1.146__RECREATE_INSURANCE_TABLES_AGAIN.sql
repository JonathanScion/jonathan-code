DO $$
BEGIN

  DROP TABLE collateral.insurance_certificate_insured_parties;
  DROP TABLE collateral.insurance_policy_assets;
  DROP TABLE collateral.insurance_policy_carriers;
  DROP TABLE collateral.insurance_policy_coverages;
  DROP TABLE collateral.insurance_certificate_policies;
  DROP TABLE collateral.insurance_certificates CASCADE;
  
-- Insurance Policies
  CREATE TABLE
    collateral.insurance_policies (
      insurance_policy_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      customer_id VARCHAR(64) NOT NULL, 

      policy_type_lookup_id SMALLINT,
      policy_number VARCHAR(64),      
      effective_date TIMESTAMPTZ,
      renewal_date TIMESTAMPTZ,
      expiration_date TIMESTAMPTZ, 
      syndicatable_commitments BOOLEAN,   
      producer_party_id  VARCHAR(64),  
      status_lookup_id SMALLINT NOT NULL,

      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ,
      deleted_at TIMESTAMPTZ,
      created_by VARCHAR(64) NOT NULL,
      updated_by VARCHAR(64),
      deleted_by VARCHAR(64),
      text_search_vector_weighted TSVECTOR
    );

    CREATE INDEX idx__ins_pol_customer ON collateral.insurance_policies (customer_id);    
    CREATE INDEX idx__ins_pol__tsv_weighted ON collateral.insurance_policies USING GIN (text_search_vector_weighted);



  -- INSURANCE INSURED PARTIES
  CREATE TABLE collateral.insurance_policy_insured_parties (
    insurance_insured_party_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id VARCHAR(64) NOT NULL,
    insurance_policy_id INTEGER NOT NULL,        
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

  CREATE INDEX idx__ins_pol_ins_party_customer ON collateral.insurance_policy_insured_parties (customer_id);
  ALTER TABLE collateral.insurance_policy_insured_parties ADD CONSTRAINT fk__ins_pol_ins_party_ins_pol_id FOREIGN KEY (insurance_policy_id) REFERENCES collateral.insurance_policies (insurance_policy_id) ON DELETE CASCADE;
  CREATE INDEX idx__ins_pol_ins_party__tsv_weighted ON collateral.insurance_policy_insured_parties USING GIN (text_search_vector_weighted);


  -- INSURANCE POLICY INSURED ASSETS
  CREATE TABLE collateral.insurance_policy_assets (
    insurance_policy_asset_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id VARCHAR(64) NOT NULL,
    insurance_policy_id INTEGER NOT NULL,

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
  ALTER TABLE collateral.insurance_policy_assets ADD CONSTRAINT fk__ins_pol_ins_asset_pol_id FOREIGN KEY (insurance_policy_id) REFERENCES collateral.insurance_policies (insurance_policy_id) ON DELETE CASCADE;
  CREATE INDEX idx__ins_pol_ins_asset__tsv_weighted ON collateral.insurance_policy_assets USING GIN (text_search_vector_weighted);

  -- INSURANCE POLICY CARRIERS
  CREATE TABLE collateral.insurance_policy_carriers (
    insurance_policy_carrier_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id VARCHAR(64) NOT NULL,
    insurance_policy_id INTEGER NOT NULL,

    carrier_name_lookup_id SMALLINT,
    allocation_percentage NUMERIC(5, 2),
    captive_carrier BOOLEAN,
    captive_backup_carrier_name_lookup_id SMALLINT,
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

  -- INSURANCE COVERAGES
  CREATE TABLE collateral.insurance_policy_coverages (
    insurance_policy_coverage_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id VARCHAR(64) NOT NULL,
    insurance_policy_id INTEGER NOT NULL,

    coverage_type_lookup_id SMALLINT NOT NULL,

    aggregate_coverage NUMERIC(15, 2),
    occurrence_coverage NUMERIC(15, 2),
    deductible NUMERIC(15, 2),
   
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
  ALTER TABLE collateral.insurance_policy_coverages ADD CONSTRAINT fk__ins_pol_coverage_ins_pol_id FOREIGN KEY (insurance_policy_id) REFERENCES collateral.insurance_policies (insurance_policy_id) ON DELETE CASCADE;
  CREATE INDEX idx__ins_pol_coverage__tsv_weighted ON collateral.insurance_policy_coverages USING GIN (text_search_vector_weighted);


  UPDATE collateral.lookups 
  SET label = 'Property',
      sort_order = 2  
  WHERE label = 'Location-specific Coverage' AND type = 37;

  UPDATE collateral.lookups 
  SET label = 'Blanket',
      sort_order = 3  
  WHERE label = 'Blanket Coverage' AND type = 37;

  INSERT INTO collateral.lookups (label, value, type, sort_order, parent_lookup_id)
  VALUES 
    ('Liability', 3, 37, 1, NULL);


END $$;