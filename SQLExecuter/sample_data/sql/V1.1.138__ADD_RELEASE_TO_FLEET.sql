DO $$
BEGIN

ALTER TABLE collateral.collateral_personal_property_specific_aircraft ADD COLUMN release_date DATE;    

END $$;

