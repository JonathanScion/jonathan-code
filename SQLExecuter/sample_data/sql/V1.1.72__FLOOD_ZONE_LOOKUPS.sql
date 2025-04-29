-- 2025/2/19 - sbhuller adding flood zone request/determination lookups

DO $$
BEGIN

-- FloodZoneRequestStatus = 27
INSERT INTO collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES 
  ('Draft', 1, 27, 1, NULL),
  ('Submitted', 2, 27, 2, NULL),
  ('Fulfilled', 3, 27, 3, NULL);

-- FloodZoneRequestType = 28
INSERT INTO collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES 
  ('New', 1, 28, 1, NULL),
  ('Refresh', 2, 28, 2, NULL);

-- FloodZoneDeterminationStatus = 29
INSERT INTO collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES 
  ('In Progress', 1, 29, 1, NULL),
  ('Pending', 2, 29, 2, NULL),
  ('Active', 3, 29, 3, NULL),
  ('Cancelled', 4, 29, 4, NULL);

END $$; 

