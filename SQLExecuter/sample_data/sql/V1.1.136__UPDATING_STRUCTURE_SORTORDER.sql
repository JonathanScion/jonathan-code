DO $$
BEGIN

UPDATE collateral.lookups
SET sort_order = 1
WHERE label = 'Building (FEMA eligible)' AND type = 26;

UPDATE collateral.lookups
SET sort_order = 2
WHERE label = 'Building (not eligible)' AND type = 26;

UPDATE collateral.lookups
SET sort_order = 3
WHERE label = 'Silo (FEMA eligible)' AND type = 26;

UPDATE collateral.lookups
SET sort_order = 4
WHERE label = 'Silo (not eligible)' AND type = 26;

UPDATE collateral.lookups
SET sort_order = 5
WHERE label = 'Land only' AND type = 26;

UPDATE collateral.lookups
SET sort_order = 6
WHERE label = 'Construction' AND type = 26;

END $$;