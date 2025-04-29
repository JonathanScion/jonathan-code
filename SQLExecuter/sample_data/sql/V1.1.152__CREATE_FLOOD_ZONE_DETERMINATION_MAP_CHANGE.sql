DO $$
BEGIN

CREATE TABLE collateral.flood_zone_determination_map_changes (
        flood_zone_determination_map_change_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        customer_id VARCHAR(64) NOT NULL,        
        flood_zone_determination_id INTEGER REFERENCES collateral.flood_zone_determinations(flood_zone_determination_id) ON DELETE CASCADE,

        transaction_code VARCHAR(2),
        servicer_code VARCHAR(10),
        branch_id VARCHAR(20),
        mpid VARCHAR(20),
        company_name VARCHAR(60),
        property_street_address VARCHAR(40),
        property_city_name VARCHAR(25),
        property_state VARCHAR(2),
        property_zip_code VARCHAR(5),
        flood_certification_number VARCHAR(10),
        flood_zone_request_id INTEGER REFERENCES collateral.flood_zone_requests(flood_zone_request_id) ON DELETE CASCADE,
        community_number VARCHAR(6),
        community_name VARCHAR(50),
        community_date TIMESTAMPTZ,
        original_community_participation_status CHAR,
        original_flood_hazard_status_flag BOOLEAN,
        original_flood_zone VARCHAR(4),
        original_partial_flag BOOLEAN,
        current_community_participation_status CHAR,
        current_flood_hazard_status_flag BOOLEAN,
        current_flood_zone VARCHAR(4),
        current_partial_flag BOOLEAN,
        map_number VARCHAR(6),
        map_panel_number VARCHAR(4),
        panel_suffix CHAR,
        map_date TIMESTAMPTZ,
        determination_date TIMESTAMPTZ,
        comment VARCHAR(250),
        loma_lomr_date TIMESTAMPTZ,

        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
);


CREATE INDEX idx__fzd_mc__tsv_weighted ON collateral.flood_zone_determination_map_changes USING GIN (text_search_vector_weighted);

END $$;