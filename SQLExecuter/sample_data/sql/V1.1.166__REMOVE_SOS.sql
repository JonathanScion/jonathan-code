DO $$ 
BEGIN

-- Remove all 'S.O.S.' entries from the lookup_state_counties table
DELETE FROM collateral.lookup_state_counties
WHERE county_description = 'S.O.S.';


END $$;