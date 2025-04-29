DO $$
BEGIN

ALTER TABLE collateral.collateral_personal_property_specific_aircraft DROP COLUMN collateral_id CASCADE;

END $$;