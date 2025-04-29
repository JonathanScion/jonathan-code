DO $$
BEGIN

-- AircraftStatus = 40
INSERT INTO collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES 
  ('Active', 1, 40, 1, NULL),
  ('Pending Release', 2, 40, 2, NULL),
  ('Released', 3, 40, 3, NULL);

ALTER TABLE collateral.collateral_personal_property_specific_aircraft ADD COLUMN aircraft_status_lookup_id INTEGER;    

END $$;
