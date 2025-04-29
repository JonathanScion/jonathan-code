DO $$ 
BEGIN

INSERT INTO collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES 
  ('Easement', 4, 6, 4, NULL);

END $$;