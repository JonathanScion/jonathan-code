DO $$
BEGIN

DROP TABLE IF EXISTS collateral.collateral_titled_property_railroad_cars_rail_equipments;
DROP TABLE IF EXISTS collateral.collateral_titled_property_railroad_cars_lessee;

-- railroad car rail equipments
CREATE TABLE
    collateral.collateral_titled_property_railroad_cars_rail_equipments (
        collateral_titled_property_railroad_cars_rail_equipment_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        customer_id VARCHAR(64) NOT NULL,
        collateral_titled_property_railroad_car_id INTEGER,
        equipment_type_lookup_id INTEGER,
        aar_car_type VARCHAR(64),
        car_mark VARCHAR(128),
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

CREATE INDEX idx__equip__railroad_car ON collateral.collateral_titled_property_railroad_cars_rail_equipments (customer_id);
CREATE INDEX idx__equip__tsv_weighted ON collateral.collateral_titled_property_railroad_cars_rail_equipments USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_titled_property_railroad_cars_rail_equipments ADD CONSTRAINT fk__collateral_railcar_equip__customer FOREIGN KEY (customer_id) REFERENCES collateral.customers (customer_id) ON DELETE CASCADE;
ALTER TABLE collateral.collateral_titled_property_railroad_cars_rail_equipments ADD CONSTRAINT fk__collateral_railcar_equip__car FOREIGN KEY (collateral_titled_property_railroad_car_id) REFERENCES collateral.collateral_titled_property_railroad_cars (collateral_titled_property_railroad_cars_id) ON DELETE CASCADE;



-- railroad car lessee
CREATE TABLE
    collateral.collateral_titled_property_railroad_cars_lessee (
        collateral_titled_property_railroad_cars_lessee_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        customer_id VARCHAR(64) NOT NULL,
        collateral_titled_property_railroad_car_id INTEGER,
        party_id VARCHAR(64) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

CREATE INDEX idx__lessee__railroad_car ON collateral.collateral_titled_property_railroad_cars_lessee (customer_id);
CREATE INDEX idx__lessee__tsv_weighted ON collateral.collateral_titled_property_railroad_cars_lessee USING GIN (text_search_vector_weighted);

ALTER TABLE collateral.collateral_titled_property_railroad_cars_lessee ADD CONSTRAINT fk__collateral_railcar_lessee__customer FOREIGN KEY (customer_id) REFERENCES collateral.customers (customer_id) ON DELETE CASCADE;
ALTER TABLE collateral.collateral_titled_property_railroad_cars_lessee ADD CONSTRAINT fk__collateral_railcar_lessee__car FOREIGN KEY (collateral_titled_property_railroad_car_id) REFERENCES collateral.collateral_titled_property_railroad_cars (collateral_titled_property_railroad_cars_id) ON DELETE CASCADE;

END $$;
