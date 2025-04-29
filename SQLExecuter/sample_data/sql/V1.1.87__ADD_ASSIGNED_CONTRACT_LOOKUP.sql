DO $$
BEGIN


-- FloodZoneDeterminationCommunityParticipationStatuses = 33
INSERT INTO collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES 
  ('Regular', 1, 33, 1, NULL),
  ('Emergency', 2, 33, 2, NULL),
  ('Non-participating', 3, 33, 3, NULL);


--  FloodZoneDeterminationReasonsNotRequired = 34
INSERT INTO collateral.lookups (label, value, type, sort_order, parent_lookup_id)
VALUES 
  ('Building not in SFHA', 1, 34, 1, NULL),
  ('Building in SFHA, not eligible', 2, 34, 2, NULL),
  ('SFHA vacant', 3, 34, 3, NULL),
  ('Customer leases building', 4, 34, 4, NULL),
  ('Customer does not own parcel', 5, 34, 5, NULL),
  ('Building value < $1,000 NFIP minimum deductible', 6, 34, 6, NULL),
  ('Building or Parcel Released / Not Mortgaged', 7, 34, 7, NULL);


-- Update type for tenants in common
UPDATE collateral.lookups SET type = 31 WHERE label = 'Tenants in Common' AND value = 2 AND type = 30 and sort_order =2;


-- Add ServiceConsole Id fields to flood zone determination
ALTER TABLE collateral.flood_zone_determinations
ADD COLUMN service_console_id VARCHAR(32),
ADD COLUMN service_console_id_set_date TIMESTAMPTZ;

END $$; 

