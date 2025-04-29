DO $$
BEGIN

DROP TABLE IF EXISTS collateral.railroad_car_rail_equipments;
DROP TABLE IF EXISTS collateral.railroad_car_lessee;


-- railroad car rail equipments
CREATE TABLE
    collateral.railroad_car_rail_equipments (
        rail_equipment_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        customer_id VARCHAR(64) NOT NULL,
        collateral_id INTEGER,
        equipment_type_lookup_id INTEGER,
        aar_car_type VARCHAR(64),
        car_mark_lookup_id INTEGER,
        car_number VARCHAR(64),
        equipment_description TEXT,
        car_status_lookup_id INTEGER,
        car_release_date TIMESTAMPTZ,
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

DROP INDEX IF EXISTS collateral.idx__rail_equipments__railroad_car;
CREATE INDEX idx__rail_equipments__railroad_car ON collateral.railroad_car_rail_equipments (customer_id);

DROP INDEX IF EXISTS collateral.idx__rail_equipments__tsv_weighted;
CREATE INDEX idx__rail_equipments__tsv_weighted ON collateral.railroad_car_rail_equipments USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.railroad_car_rail_equipments ADD CONSTRAINT fk__rail_equipments_collateral_id FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id) ON DELETE CASCADE;


-- railroad car lessee
CREATE TABLE
    collateral.railroad_car_lessee (
        lessee_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        customer_id VARCHAR(64) NOT NULL,
        party_customer_id VARCHAR(64) NOT NULL,
        party_name VARCHAR(255) NOT NULL,
        collateral_id INTEGER,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

DROP INDEX IF EXISTS collateral.idx__lessee__railroad_car;
CREATE INDEX idx__lessee__railroad_car ON collateral.railroad_car_lessee (
    customer_id
);

DROP INDEX IF EXISTS collateral.idx__lessee__tsv_weighted;
CREATE INDEX idx__lessee__tsv_weighted ON collateral.railroad_car_lessee USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.railroad_car_lessee ADD CONSTRAINT fk__lessee_collateral_id FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id) ON DELETE CASCADE;



END $$;



