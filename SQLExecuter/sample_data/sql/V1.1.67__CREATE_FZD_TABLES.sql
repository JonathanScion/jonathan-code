DO $$
BEGIN

-- Flood zone requests
CREATE TABLE
    collateral.flood_zone_requests (
        flood_zone_request_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        customer_id VARCHAR(64) NOT NULL,        

        request_date TIMESTAMPTZ,
        status_lookup_id SMALLINT,
        lapse_date TIMESTAMPTZ,
        effective_date TIMESTAMPTZ,
        customer_name VARCHAR(128),
        project_name VARCHAR(128),
        request_type_lookup_id SMALLINT,
        refresh_corelogic_fzd_cert_number VARCHAR(32),
        county VARCHAR(32),
        state VARCHAR(16),

        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

CREATE INDEX idx__fzd_req__tsv_weighted ON collateral.flood_zone_requests USING GIN (text_search_vector_weighted);

-- Flood zone requests Table to Parcels
CREATE TABLE collateral.flood_zone_request_parcels (
    flood_zone_request_id INT REFERENCES collateral.flood_zone_requests(flood_zone_request_id) ON DELETE CASCADE,
    real_estate_site_parcel_id INT REFERENCES collateral.real_estate_site_parcels(real_estate_site_parcel_id) ON DELETE CASCADE,
    PRIMARY KEY (flood_zone_request_id, real_estate_site_parcel_id)
);


-- Flood zone determinations
CREATE TABLE
    collateral.flood_zone_determinations (
        flood_zone_determination_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        customer_id VARCHAR(64) NOT NULL,        

        flood_zone_request_id INTEGER REFERENCES collateral.flood_zone_requests(flood_zone_request_id) ON DELETE CASCADE,
        flood_zone_status_lookup_id SMALLINT,
        type_of_certification_lookup_id SMALLINT,
        cost_center VARCHAR(32),
        company_name VARCHAR(128), -- is this current company ??
        property_street_address VARCHAR(128),
        property_city VARCHAR(255),
        property_state VARCHAR(2),
        property_zip_code VARCHAR(10),
        community_number VARCHAR(32),
        community_name VARCHAR(128),
        community_participation_status_lookup_id SMALLINT,
        community_county VARCHAR(255),
        community_state VARCHAR(2),
        in_sfha BOOLEAN,
        flood_zone VARCHAR(16),
        need_flood_insurance BOOLEAN,
        reason_not_required VARCHAR(512),
        map_number INTEGER,
        map_panel_number INTEGER,
        panel_suffix VARCHAR(16),
        map_date TIMESTAMPTZ,
        partial_flag BOOLEAN,
        letter_of_map_revision_amendment_date TIMESTAMPTZ,
        coastal_barrier_resource_area_date TIMESTAMPTZ,
        determination_date TIMESTAMPTZ,
        lapse_date TIMESTAMPTZ,
        flood_certification_number VARCHAR(64),
        life_of_loan_flag BOOLEAN,
        cancellation_date TIMESTAMPTZ,
        corelogic_comment VARCHAR(2048),

        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

CREATE INDEX idx__fzd_det__tsv_weighted ON collateral.flood_zone_determinations USING GIN (text_search_vector_weighted);

-- Flood zone determinations Bridge Table to Parcels
CREATE TABLE collateral.flood_zone_determination_parcels (
    flood_zone_determination_id INT REFERENCES collateral.flood_zone_determinations(flood_zone_determination_id) ON DELETE CASCADE,
    real_estate_site_parcel_id INT REFERENCES collateral.real_estate_site_parcels(real_estate_site_parcel_id) ON DELETE CASCADE,
    PRIMARY KEY (flood_zone_determination_id, real_estate_site_parcel_id)
);

-- Create index on customer_id and flood_zone_request_id in flood_zone_determinations table
CREATE INDEX idx_flood_zone_determinations_customer_id_request_id ON collateral.flood_zone_determinations (customer_id, flood_zone_request_id);


-- add new columns to notes table
ALTER TABLE collateral.customer_notes ADD COLUMN flood_zone_request_id INTEGER;
ALTER TABLE collateral.customer_notes ADD CONSTRAINT fk__note_flood_zone_request_id FOREIGN KEY (flood_zone_request_id) REFERENCES collateral.flood_zone_requests (flood_zone_request_id) ON DELETE CASCADE;

ALTER TABLE collateral.customer_notes ADD COLUMN flood_zone_determination_id INTEGER;
ALTER TABLE collateral.customer_notes ADD CONSTRAINT fk__note_flood_zone_determination_id FOREIGN KEY (flood_zone_determination_id) REFERENCES collateral.flood_zone_determinations (flood_zone_determination_id) ON DELETE CASCADE;


-- add new columns to the documents bridge table
ALTER TABLE collateral.customer_document_bridges ADD COLUMN flood_zone_request_id INTEGER;
ALTER TABLE collateral.customer_document_bridges ADD CONSTRAINT fk__doc_flood_zone_request_id FOREIGN KEY (flood_zone_request_id) REFERENCES collateral.flood_zone_requests (flood_zone_request_id) ON DELETE CASCADE;

ALTER TABLE collateral.customer_document_bridges ADD COLUMN flood_zone_determination_id INTEGER;
ALTER TABLE collateral.customer_document_bridges ADD CONSTRAINT fk__doc_flood_zone_determination_id FOREIGN KEY (flood_zone_determination_id) REFERENCES collateral.flood_zone_determinations (flood_zone_determination_id) ON DELETE CASCADE;

    -- Intentional error to force rollback to test SQL
    --RAISE EXCEPTION 'Deliberate error to force rollback to test SQL'; 

END $$;