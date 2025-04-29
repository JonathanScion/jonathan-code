DO $$
BEGIN

UPDATE collateral.lookups
SET label = 'Vessel'
WHERE label = 'Vessels' AND type = 5;

END $$;