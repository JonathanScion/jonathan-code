DO $$
BEGIN

-- DELETE DUPLICATE STATE COUNTY RECORD
DELETE FROM collateral.lookup_state_counties WHERE county_code = '08014';

END $$; 

