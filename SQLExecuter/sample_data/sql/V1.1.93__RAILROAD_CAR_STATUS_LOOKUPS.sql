DO $$
BEGIN

-- RailroadCarEquipmentStatus = 35
INSERT INTO collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES 
  ('Active', 1, 35, 1, NULL),
  ('Pending Release', 2, 35, 2, NULL),
  ('Released', 3, 35, 3, NULL);

END $$;
