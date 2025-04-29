DO $$
BEGIN

  ALTER TABLE collateral.collateral_personal_property_general_assigned_contracts ALTER COLUMN counterparty TYPE VARCHAR(256);


END $$;