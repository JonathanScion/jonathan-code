DO $$
BEGIN

-- InsurancePolicyCarrierNames = 41
INSERT INTO collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES 
  ('Temp carrier 1', 1, 41, 1, NULL),
  ('Temp carrier 2', 2, 41, 2, NULL),
  ('Temp carrier 3', 3, 41, 3, NULL),
  ('Temp carrier 4', 4, 41, 4, NULL);

ALTER TABLE collateral.insurance_policy_carriers ADD COLUMN carrier_name_lookup_id SMALLINT;

END $$;

