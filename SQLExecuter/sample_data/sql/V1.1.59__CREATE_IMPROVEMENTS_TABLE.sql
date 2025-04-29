DO $$ 
BEGIN

CREATE TABLE collateral.real_estate_site_parcel_improvements (
        real_estate_site_parcel_improvement_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        customer_id VARCHAR(64) NOT NULL,
        real_estate_site_id INTEGER NOT NULL,
        real_estate_site_parcel_id INT NOT NULL,
        improvement_name VARCHAR(64),
        fixture_status_lookup INTEGER, 
        insurance_eligible BOOLEAN,
        valuation_source VARCHAR(255),
        valuation_date TIMESTAMPTZ,
        building_insurance_value NUMERIC, 
        contents_insurance_value NUMERIC,
        improvement_street_address VARCHAR(255),
        improvement_city VARCHAR(255),
        improvement_state CHAR(2),
        improvement_zip VARCHAR(10),
        improvement_county VARCHAR(255),
        improvement_country VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

CREATE INDEX idx__re_site_parcel_improvements__customer_site_parcel ON collateral.real_estate_site_parcel_improvements (
    customer_id,
    real_estate_site_id,
    real_estate_site_parcel_id
);

CREATE INDEX idx__re_site_parcel_improvements__tsv_weighted ON collateral.real_estate_site_parcel_improvements USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.real_estate_site_parcel_improvements ADD CONSTRAINT fk__re_site_parcel_improvements__parcel FOREIGN KEY (real_estate_site_parcel_id) REFERENCES collateral.real_estate_site_parcels (real_estate_site_parcel_id);


--RAISE EXCEPTION 'Deliberate error to force rollback to test SQL'; 

END $$; 