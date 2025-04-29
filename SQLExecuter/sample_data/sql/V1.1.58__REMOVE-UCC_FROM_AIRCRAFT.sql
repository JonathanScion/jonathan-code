DO $$
BEGIN
    ALTER TABLE collateral.collateral_personal_property_specific_aircraft
    DROP COLUMN ucc CASCADE;
END $$;