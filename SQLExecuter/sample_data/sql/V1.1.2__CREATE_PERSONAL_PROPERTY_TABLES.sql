DO $$
BEGIN

CREATE TABLE
    collateral.collateral (
        collateral_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        customer_id VARCHAR(64) NOT NULL,
        type_lookup_id SMALLINT NOT NULL,
        subtype_lookup_id SMALLINT NOT NULL,
        collateral_description TEXT,
        status_lookup_id SMALLINT NULL,
        release_date TIMESTAMPTZ, 
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

CREATE INDEX idx__col ON collateral.collateral (customer_id);

CREATE INDEX idx__col__tsv_weighted ON collateral.collateral USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral ADD CONSTRAINT fk__col_customer FOREIGN KEY (customer_id) REFERENCES collateral.customers (customer_id);

CREATE TABLE
    collateral.collateral_related_parties (
        collateral_related_party_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        collateral_id INT NOT NULL,
        customer_id VARCHAR(64) NOT NULL,
        party_customer_id VARCHAR(64) NOT NULL,
        party_name VARCHAR(255) NOT NULL,
        party_ownership_interest INTEGER,
        party_tenancy INTEGER,
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

CREATE INDEX idx__col_related_party ON collateral.collateral_related_parties (customer_id);

CREATE INDEX idx__col_related_party__tsv_weighted ON collateral.collateral_related_parties USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_related_parties ADD CONSTRAINT fk__col_related_party__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_commitments (
        collateral_commitment_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        collateral_id INT NOT NULL,
        customer_id VARCHAR(64) NOT NULL,
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

CREATE INDEX idx__col_commitments ON collateral.collateral_commitments (customer_id);

CREATE INDEX idx__col_commitments__tsv_weighted ON collateral.collateral_commitments USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_commitments ADD CONSTRAINT fk__col_commitment__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_document (
        collateral_document_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        collateral_id INT NOT NULL,
        customer_id VARCHAR(64) NOT NULL,
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

CREATE INDEX idx__col_document ON collateral.collateral_document (customer_id);

CREATE INDEX idx__col_document__tsv_weighted ON collateral.collateral_document USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_document ADD CONSTRAINT fk__col_document__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_receivables_warehouse_receipt (
        collateral_receivables_warehouse_receipt_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        collateral_id INT NOT NULL,
        customer_id VARCHAR(64) NOT NULL,
        submission_method_lookup INTEGER,
        commodity_type_lookup INTEGER,
        no_of_bushels INTEGER,
        no_of_pounds INTEGER,
        issue_date TIMESTAMPTZ,
        received_date TIMESTAMPTZ,
        possession_verified BOOLEAN,
        released_to VARCHAR(64),
        return_method_lookup INTEGER,
        vendor_name VARCHAR(64),
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

CREATE INDEX idx__col_receivables_warehouse_receipt ON collateral.collateral_receivables_warehouse_receipt (customer_id);

CREATE INDEX idx__col_receivables_warehouse_receipt__tsv_weighted ON collateral.collateral_receivables_warehouse_receipt USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_receivables_warehouse_receipt ADD CONSTRAINT fk__col_receivables_warehouse_receipt__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_receivables_chattel_paper (
        collateral_receivables_chattel_paper_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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

CREATE INDEX idx__col_receivables_chattel_paper ON collateral.collateral_receivables_chattel_paper (customer_id);

CREATE INDEX idx__col_receivables_chattel_paper__tsv_weighted ON collateral.collateral_receivables_chattel_paper USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_receivables_chattel_paper ADD CONSTRAINT fk__col_receivables_chattel_paper__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_receivables_letter_of_credit (
        collateral_receivables_letter_of_credit_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        collateral_id INT NOT NULL,
        issue_date TIMESTAMPTZ,
        expiration_date TIMESTAMPTZ,
        letter_of_credit_id VARCHAR(64) NOT NULL,
        release_description TEXT,
        customer_id VARCHAR(64) NOT NULL,
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

CREATE INDEX idx__col_receivables_letter_of_credit ON collateral.collateral_receivables_letter_of_credit (customer_id);

CREATE INDEX idx__col_receivables_letter_of_credit__tsv_weighted ON collateral.collateral_receivables_letter_of_credit USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_receivables_letter_of_credit ADD CONSTRAINT fk__col_receivables_letter_of_credit__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_receivables_accounts_receivable (
        collateral_receivables_accounts_receivable_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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

CREATE INDEX idx__col_receivables_accounts_receivable ON collateral.collateral_receivables_accounts_receivable (customer_id);

CREATE INDEX idx__col_receivables_accounts_receivable__tsv_weighted ON collateral.collateral_receivables_accounts_receivable USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_receivables_accounts_receivable ADD CONSTRAINT fk__col_receivables_accounts_receivable__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_receivables_life_insurance (
        collateral_receivables_life_insurance_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        collateral_id INT NOT NULL,
        customer_id VARCHAR(64) NOT NULL,
        issue_date DATE,
        how_held_lookup_id SMALLINT NOT NULL,
        policy_number VARCHAR(64),
        insurance_company VARCHAR(64),
        insured_party VARCHAR(64),
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

CREATE INDEX idx__col_receivables_life_insurance ON collateral.collateral_receivables_life_insurance (customer_id);

CREATE INDEX idx__col_receivables_life_insurance__tsv_weighted ON collateral.collateral_receivables_life_insurance USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_receivables_life_insurance ADD CONSTRAINT fk__col_receivables_life_insurance__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_receivables_pledged_note (
        collateral_receivables_pledged_note_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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

CREATE INDEX idx__col_receivables_pledged_note ON collateral.collateral_receivables_pledged_note (customer_id);

CREATE INDEX idx__col_receivables_pledged_note__tsv_weighted ON collateral.collateral_receivables_pledged_note USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_receivables_pledged_note ADD CONSTRAINT fk__col_receivables_pledged_note__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_receivables_bonds (
        collateral_receivables_bonds_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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

CREATE INDEX idx__col_receivables_bonds ON collateral.collateral_receivables_bonds (customer_id);

CREATE INDEX idx__col_receivables_bonds__tsv_weighted ON collateral.collateral_receivables_bonds USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_receivables_bonds ADD CONSTRAINT fk__col_receivables_bonds__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_personal_property_specific_revenues (
        collateral_personal_property_specific_revenues_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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

CREATE INDEX idx__col_pers_prop_specific_revenues ON collateral.collateral_personal_property_specific_revenues (customer_id);

CREATE INDEX idx__col_pers_prop_specific_revenues__tsv_weighted ON collateral.collateral_personal_property_specific_revenues USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_personal_property_specific_revenues ADD CONSTRAINT fk__col_pers_prop_specific_revenues__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_personal_property_specific_consumer_goods (
        collateral_personal_property_specific_consumer_goods_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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

CREATE INDEX idx__col_pers_prop_specific_consumer_goods ON collateral.collateral_personal_property_specific_consumer_goods (customer_id);

CREATE INDEX idx__col_pers_prop_specific_consumer_goods__tsv_weighted ON collateral.collateral_personal_property_specific_consumer_goods USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_personal_property_specific_consumer_goods ADD CONSTRAINT fk__col_pers_prop_specific_consumer_goods__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_personal_property_specific_equipment (
        collateral_personal_property_specific_equipment_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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

CREATE INDEX idx__col_pers_prop_specific_equipment ON collateral.collateral_personal_property_specific_equipment (customer_id);

CREATE INDEX idx__col_pers_prop_specific_equipment__tsv_weighted ON collateral.collateral_personal_property_specific_equipment USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_personal_property_specific_equipment ADD CONSTRAINT fk__col_pers_prop_specific_equipment__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_personal_property_specific_crops (
        collateral_personal_property_specific_crops_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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

CREATE INDEX idx__col_pers_prop_specific_crops ON collateral.collateral_personal_property_specific_crops (customer_id);

CREATE INDEX idx__col_pers_prop_specific_crops__tsv_weighted ON collateral.collateral_personal_property_specific_crops USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_personal_property_specific_crops ADD CONSTRAINT fk__col_pers_prop_specific_crops__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_personal_property_specific_livestock (
        collateral_personal_property_specific_livestock_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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

CREATE INDEX idx__col_pers_prop_specific_livestock ON collateral.collateral_personal_property_specific_livestock (customer_id);

CREATE INDEX idx__col_pers_prop_specific_livestock__tsv_weighted ON collateral.collateral_personal_property_specific_livestock USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_personal_property_specific_livestock ADD CONSTRAINT fk__col_pers_prop_specific_livestock__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_personal_property_specific_inventory (
        collateral_personal_property_specific_inventory_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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

CREATE INDEX idx__col_pers_prop_specific_inventory ON collateral.collateral_personal_property_specific_inventory (customer_id);

CREATE INDEX idx__col_pers_prop_specific_inventory__tsv_weighted ON collateral.collateral_personal_property_specific_inventory USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_personal_property_specific_inventory ADD CONSTRAINT fk__col_pers_prop_specific_inventory__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_personal_property_specific_aircraft (
        collateral_personal_property_specific_aircraft_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        collateral_id INT NOT NULL,
        customer_id VARCHAR(64) NOT NULL,
        ucc VARCHAR(64),
        aircraft_make VARCHAR(64),
        aircraft_model VARCHAR(64),
        aircraft_year INTEGER,
        aircraft_tail_number VARCHAR(64),
        aircraft_serial_number VARCHAR(64),
        aircraft_registration_number VARCHAR(64),
        aircraft_engine_make VARCHAR(64),
        aircraft_engine_model VARCHAR(64),
        aircraft_propeller_hub_make VARCHAR(64),
        aircraft_propeller_hub_model VARCHAR(64),
        aircraft_propeller_hub_serial_number VARCHAR(64),
        aircraft_horsepower VARCHAR(64),
        release_date DATE,
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

CREATE INDEX idx__col_pers_prop_specific_aircraft ON collateral.collateral_personal_property_specific_aircraft (customer_id);

CREATE INDEX idx__col_pers_prop_specific_aircraft__tsv_weighted ON collateral.collateral_personal_property_specific_aircraft USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_personal_property_specific_aircraft ADD CONSTRAINT fk__col_pers_prop_specific_aircraft__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_personal_property_general_ribg_gba (
        collateral_personal_property_general_ribg_gba_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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

CREATE INDEX idx__col_personal_general_ribg_gba ON collateral.collateral_personal_property_general_ribg_gba (customer_id);

CREATE INDEX idx__col_personal_general_ribg_gba__tsv_weighted ON collateral.collateral_personal_property_general_ribg_gba USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_personal_property_general_ribg_gba ADD CONSTRAINT fk__col_personal_general_ribg_gba__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_titled_property_vehicle (
        collateral_titled_property_vehicle_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        collateral_id INT NOT NULL,
        customer_id VARCHAR(64) NOT NULL,
        vehicle_make VARCHAR(64),
        vehicle_model VARCHAR(64),
        vehicle_year INTEGER,
        vehicle_vin VARCHAR(64),
        title_expiration DATE,
        title_number VARCHAR(64),
        vehicle_weight INTEGER,
        vehicle_state CHAR(2),
        form_of_evidence_lookup INTEGER,
        possession_verified BOOLEAN, 
        released_to VARCHAR(64),
        return_method_lookup INTEGER,
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

CREATE INDEX idx__col_titled_property_vehicle ON collateral.collateral_titled_property_vehicle (customer_id);

CREATE INDEX idx__col_titled_property_vehicle__tsv_weighted ON collateral.collateral_titled_property_vehicle USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_titled_property_vehicle ADD CONSTRAINT fk__col_titled_property_vehicle__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_titled_property_railroad_cars (
        collateral_titled_property_railroad_cars_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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

CREATE INDEX idx__col_titled_property_railroad_cars ON collateral.collateral_titled_property_railroad_cars (customer_id);

CREATE INDEX idx__col_titled_property_railroad_cars__tsv_weighted ON collateral.collateral_titled_property_railroad_cars USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_titled_property_railroad_cars ADD CONSTRAINT fk__col_titled_property_railroad_cars__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_titled_property_vessels (
        collateral_titled_property_vessels_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        collateral_id INT NOT NULL,
        customer_id VARCHAR(64) NOT NULL,
        mortgage_date TIMESTAMPTZ,
        mortgage_recording_date TIMESTAMPTZ,
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

CREATE INDEX idx__col_titled_property_vessels ON collateral.collateral_titled_property_vessels (customer_id);

CREATE INDEX idx__col_titled_property_vessels__tsv_weighted ON collateral.collateral_titled_property_vessels USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_titled_property_vessels ADD CONSTRAINT fk__col_titled_property_vessels__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_titled_property_trailers (
        collateral_titled_property_trailers_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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

CREATE INDEX idx__col_titled_property_trailers ON collateral.collateral_titled_property_trailers (customer_id);

CREATE INDEX idx__col_titled_property_trailers__tsv_weighted ON collateral.collateral_titled_property_trailers USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_titled_property_trailers ADD CONSTRAINT fk__col_titled_property_trailers__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_extracted_collateral_oil_gas (
        collateral_extracted_collateral_oil_gas_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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

CREATE INDEX idx__col_extracted_collateral_oil_gas ON collateral.collateral_extracted_collateral_oil_gas (customer_id);

CREATE INDEX idx__col_extracted_collateral_oil_gas__tsv_weighted ON collateral.collateral_extracted_collateral_oil_gas USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_extracted_collateral_oil_gas ADD CONSTRAINT fk__col_extracted_collateral_oil_gas__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_extracted_collateral_minerals (
        collateral_extracted_collateral_minerals_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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

CREATE INDEX idx__col_extracted_collateral_minerals ON collateral.collateral_extracted_collateral_minerals (customer_id);

CREATE INDEX idx__col_extracted_collateral_minerals__tsv_weighted ON collateral.collateral_extracted_collateral_minerals USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_extracted_collateral_minerals ADD CONSTRAINT fk__col_extracted_collateral_minerals__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_intellectual_property_patents (
        collateral_intellectual_property_patents_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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

CREATE INDEX idx__col_intellectual_property_patents ON collateral.collateral_intellectual_property_patents (customer_id);

CREATE INDEX idx__col_intellectual_property_patents__tsv_weighted ON collateral.collateral_intellectual_property_patents USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_intellectual_property_patents ADD CONSTRAINT fk__col_intellectual_property_patents__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_intellectual_property_trademark (
        collateral_intellectual_property_trademark_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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

CREATE INDEX idx__col_intellectual_property_trademark ON collateral.collateral_intellectual_property_trademark (customer_id);

CREATE INDEX idx__col_intellectual_property_trademark__tsv_weighted ON collateral.collateral_intellectual_property_trademark USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_intellectual_property_trademark ADD CONSTRAINT fk__col_intellectual_property_trademark__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_intellectual_property_copyrights (
        collateral_intellectual_property_copyrights_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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

CREATE INDEX idx__col_intellectual_property_copyrights ON collateral.collateral_intellectual_property_copyrights (customer_id);

CREATE INDEX idx__col_intellectual_property_copyrights__tsv_weighted ON collateral.collateral_intellectual_property_copyrights USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_intellectual_property_copyrights ADD CONSTRAINT fk__col_intellectual_property_copyrights__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_cash_investments_commodity_account (
        collateral_cash_investments_commodity_account_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        collateral_id INT NOT NULL,
        customer_id VARCHAR(64) NOT NULL,
        account_number VARCHAR(64) NOT NULL,
        instrument_date TIMESTAMPTZ,
        deposit_institution VARCHAR(64),
        notice_of_sole_control BOOLEAN,
        cobank_form BOOLEAN,
        release_date TIMESTAMPTZ,
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

CREATE INDEX idx__col_cash_investments_commodity_account ON collateral.collateral_cash_investments_commodity_account (customer_id);

CREATE INDEX idx__col_cash_investments_commodity_account__tsv_weighted ON collateral.collateral_cash_investments_commodity_account USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_cash_investments_commodity_account ADD CONSTRAINT fk__col_cash_investments_commodity_account__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_cash_investments_deposit_account (
        collateral_cash_investments_deposit_account_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        collateral_id INT NOT NULL,
        customer_id VARCHAR(64) NOT NULL,
        account_number VARCHAR(64) NOT NULL,
        instrument_date TIMESTAMPTZ,
        deposit_institution VARCHAR(64),
        notice_of_sole_control BOOLEAN,
        cobank_form BOOLEAN,
        release_date TIMESTAMPTZ,
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

CREATE INDEX idx__col_cash_investments_deposit_account ON collateral.collateral_cash_investments_deposit_account (customer_id);

CREATE INDEX idx__col_cash_investments_deposit_account__tsv_weighted ON collateral.collateral_cash_investments_deposit_account USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_cash_investments_deposit_account ADD CONSTRAINT fk__col_cash_investments_deposit_account__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_cash_investments_hedge_account (
        collateral_cash_investments_hedge_account_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        collateral_id INT NOT NULL,
        customer_id VARCHAR(64) NOT NULL,
        account_number VARCHAR(64) NOT NULL,
        instrument_date TIMESTAMPTZ,
        deposit_institution VARCHAR(64),
        notice_of_sole_control BOOLEAN,
        cobank_form BOOLEAN,
        release_date TIMESTAMPTZ,
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

CREATE INDEX idx__col_cash_investments_hedge_account ON collateral.collateral_cash_investments_hedge_account (customer_id);

CREATE INDEX idx__col_cash_investments_hedge_account__tsv_weighted ON collateral.collateral_cash_investments_hedge_account USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_cash_investments_hedge_account ADD CONSTRAINT fk__col_cash_investments_hedge_account__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_cash_investments_equity_non_cobank (
        collateral_cash_investments_equity_non_cobank_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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

CREATE INDEX idx__col_cash_investments_equity_non_cobank ON collateral.collateral_cash_investments_equity_non_cobank (customer_id);

CREATE INDEX idx__col_cash_investments_equity_non_cobank__tsv_weighted ON collateral.collateral_cash_investments_equity_non_cobank USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_cash_investments_equity_non_cobank ADD CONSTRAINT fk__col_cash_investments_equity_non_cobank__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_cash_investments_bailee (
        collateral_cash_investments_bailee_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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

CREATE INDEX idx__col_cash_investments_bailee ON collateral.collateral_cash_investments_bailee (customer_id);

CREATE INDEX idx__col_cash_investments_bailee__tsv_weighted ON collateral.collateral_cash_investments_bailee USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_cash_investments_bailee ADD CONSTRAINT fk__col_cash_investments_bailee__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

CREATE TABLE
    collateral.collateral_cash_investments_stock (
        collateral_cash_investments_stock_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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

CREATE INDEX idx__col_cash_investments_stock ON collateral.collateral_cash_investments_stock (customer_id);

CREATE INDEX idx__col_cash_investments_stock__tsv_weighted ON collateral.collateral_cash_investments_stock USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_cash_investments_stock ADD CONSTRAINT fk__col_cash_investments_stock__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id);

END $$;