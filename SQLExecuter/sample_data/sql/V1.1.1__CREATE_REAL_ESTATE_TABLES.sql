DO $$
BEGIN

CREATE TABLE
    collateral.real_estate (
        real_estate_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        customer_id VARCHAR(64) NOT NULL,
        overall_real_estate_value NUMERIC,
        overall_real_estate_value_date DATE,
        overall_real_estate_details TEXT,
        overall_real_estate_value_source VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

CREATE INDEX idx__re__customer ON collateral.real_estate (customer_id);

CREATE INDEX idx__re__tsv_weighted ON collateral.real_estate USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.real_estate ADD CONSTRAINT fk__re__customer FOREIGN KEY (customer_id) REFERENCES collateral.customers (customer_id);

CREATE TABLE
    collateral.real_estate_sites (
        real_estate_site_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        customer_id VARCHAR(64) NOT NULL,
        real_estate_id INTEGER NOT NULL,
        site_name VARCHAR(255) NOT NULL,
        site_description TEXT,
        railroad_property BOOLEAN,
        site_type INTEGER,
        site_value NUMERIC,
        site_street_address VARCHAR(255),
        site_value_date DATE,
        site_value_source VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

CREATE INDEX idx__re_sites__customer ON collateral.real_estate_sites (customer_id, real_estate_id);

CREATE INDEX idx__re_sites__tsv_weighted ON collateral.real_estate_sites USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.real_estate_sites ADD CONSTRAINT fk__re_sites__real_estate FOREIGN KEY (real_estate_id) REFERENCES collateral.real_estate (real_estate_id);

CREATE TABLE
    collateral.real_estate_site_related_parties (
        real_estate_site_related_party_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        customer_id VARCHAR(64) NOT NULL,
        real_estate_site_id INTEGER NOT NULL,
        party_customer_id VARCHAR(64) NOT NULL,
        party_name VARCHAR(255) NOT NULL,
        party_ownership_interest INTEGER,
        party_tenancy INTEGER,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

CREATE INDEX idx__re_site_related_parties__customer_site ON collateral.real_estate_site_related_parties (customer_id, real_estate_site_id);

CREATE INDEX idx__re_site_related_parties__tsv_weighted ON collateral.real_estate_site_related_parties USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.real_estate_site_related_parties ADD CONSTRAINT fk__re_site_related_parties__parcel FOREIGN KEY (real_estate_site_id) REFERENCES collateral.real_estate_sites (real_estate_site_id);

CREATE TABLE
    collateral.real_estate_site_notes (
        real_estate_site_note_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        customer_id VARCHAR(64) NOT NULL,
        real_estate_site_id INTEGER NOT NULL,
        title VARCHAR(255) NOT NULL,
        author VARCHAR(100) NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        note TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

CREATE INDEX idx__re_site_notes__customer_site ON collateral.real_estate_site_notes (
    customer_id,
    real_estate_site_id,
    real_estate_site_note_id
);

CREATE INDEX idx__re_site_notes__tsv_weighted ON collateral.real_estate_site_notes USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.real_estate_site_notes ADD CONSTRAINT fk__re_site_notes__site FOREIGN KEY (real_estate_site_id) REFERENCES collateral.real_estate_sites (real_estate_site_id);

CREATE TABLE
    collateral.real_estate_site_parcels (
        real_estate_site_parcel_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        customer_id VARCHAR(64) NOT NULL,
        real_estate_site_id INT NOT NULL,
        building_carve_out NUMERIC,
        fixture_status INTEGER,
        fzd_identifier VARCHAR(255),
        improvement_description TEXT,
        improvement_status INTEGER,
        in_sfha BOOLEAN,
        is_related_parties_lock BOOLEAN,
        legal_description TEXT,
        mortgage_parcel_number VARCHAR(255),
        need_flood_insurance BOOLEAN,
        parcel_address VARCHAR(255),
        parcel_building_value NUMERIC,
        parcel_city VARCHAR(255),
        parcel_county VARCHAR(255),
        parcel_country VARCHAR(255),
        parcel_land_value NUMERIC,
        parcel_name VARCHAR(255),
        parcel_number VARCHAR(255),
        parcel_state CHAR(2),
        parcel_status INTEGER,
        parcel_valuation_year INTEGER,
        parcel_zip VARCHAR(10),
        participating_community BOOLEAN,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

CREATE INDEX idx__re_site_parcels__customer_site ON collateral.real_estate_site_parcels (customer_id, real_estate_site_id);

CREATE INDEX idx__re_site_parcels__tsv_weighted ON collateral.real_estate_site_parcels USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.real_estate_site_parcels ADD CONSTRAINT fk__parcel__site FOREIGN KEY (real_estate_site_id) REFERENCES collateral.real_estate_sites (real_estate_site_id);

CREATE TABLE
    collateral.real_estate_site_parcel_related_parties (
        real_estate_site_parcel_related_party_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        customer_id VARCHAR(64) NOT NULL,
        real_estate_site_id INT NOT NULL,
        real_estate_site_parcel_id INT NOT NULL,
        party_customer_id VARCHAR(64) NOT NULL,
        party_name VARCHAR(255) NOT NULL,
        party_ownership_interest INTEGER,
        party_tenancy INTEGER,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

CREATE INDEX idx__re_site_parcel_related_parties__customer_site_parcel ON collateral.real_estate_site_parcel_related_parties (
    customer_id,
    real_estate_site_id,
    real_estate_site_parcel_id
);

CREATE INDEX idx__re_site_parcel_related_parties__tsv_weighted ON collateral.real_estate_site_parcel_related_parties USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.real_estate_site_parcel_related_parties ADD CONSTRAINT fk__re_site_parcel_related_parties__parcel FOREIGN KEY (real_estate_site_parcel_id) REFERENCES collateral.real_estate_site_parcels (real_estate_site_parcel_id);

CREATE TABLE
    collateral.real_estate_site_parcel_commitments (
        real_estate_site_parcel_commitment_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        customer_id VARCHAR(64) NOT NULL,
        real_estate_site_id INTEGER NOT NULL,
        real_estate_site_parcel_id INT NOT NULL,
        commitment_name VARCHAR(255) NOT NULL,
        commitment_number VARCHAR(255) NOT NULL,
        party_customer_id VARCHAR(64) NOT NULL,
        party_name VARCHAR(255) NOT NULL,
        party_ownership_interest INTEGER,
        party_tenancy INTEGER,
        role VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

CREATE INDEX idx__re_site_parcel_commitments__customer_site_parcel ON collateral.real_estate_site_parcel_commitments (
    customer_id,
    real_estate_site_id,
    real_estate_site_parcel_id
);

CREATE INDEX idx__re_site_parcel_commitments__tsv_weighted ON collateral.real_estate_site_parcel_commitments USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.real_estate_site_parcel_commitments ADD CONSTRAINT fk__re_site_parcel_commitments__parcel FOREIGN KEY (real_estate_site_parcel_id) REFERENCES collateral.real_estate_site_parcels (real_estate_site_parcel_id);

CREATE TABLE
    collateral.real_estate_site_parcel_notes (
        real_estate_site_parcel_note_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        customer_id VARCHAR(64) NOT NULL,
        real_estate_site_id INTEGER NOT NULL,
        real_estate_site_parcel_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        author VARCHAR(100) NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        note TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

CREATE INDEX idx__re_site_parcel_notes__customer_site_parcel ON collateral.real_estate_site_parcel_notes (
    customer_id,
    real_estate_site_id,
    real_estate_site_parcel_id,
    real_estate_site_parcel_note_id
);

CREATE INDEX idx__re_site_parcel_notes__tsv_weighted ON collateral.real_estate_site_parcel_notes USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.real_estate_site_parcel_notes ADD CONSTRAINT fk__re_site_parcel_notes__parcel FOREIGN KEY (real_estate_site_parcel_id) REFERENCES collateral.real_estate_site_parcels (real_estate_site_parcel_id);

END $$;