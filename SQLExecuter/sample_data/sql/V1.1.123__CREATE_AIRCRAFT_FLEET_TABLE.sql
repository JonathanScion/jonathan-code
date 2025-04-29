DO $$
BEGIN

CREATE TABLE
    collateral.collateral_personal_property_specific_aircraft_fleet (
        collateral_personal_property_specific_aircraft_fleet_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        collateral_id INTEGER NOT NULL,
        customer_id VARCHAR(64) NOT NULL,
        updated_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64),
        deleted_by VARCHAR(64),
        text_search_vector_weighted TSVECTOR
    );

ALTER TABLE collateral.collateral_personal_property_specific_aircraft ADD COLUMN collateral_personal_property_specific_aircraft_fleet_id INTEGER;    

ALTER TABLE collateral.collateral_personal_property_specific_aircraft 
  ADD CONSTRAINT fk_aircraft_specific_aircraft_fleet 
  FOREIGN KEY (collateral_personal_property_specific_aircraft_fleet_id) 
  REFERENCES collateral.collateral_personal_property_specific_aircraft_fleet (collateral_personal_property_specific_aircraft_fleet_id)
  ON DELETE CASCADE;

INSERT INTO collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES 
    ('Aircraft Fleet', 8, 5, NULL, 13);


END $$;

