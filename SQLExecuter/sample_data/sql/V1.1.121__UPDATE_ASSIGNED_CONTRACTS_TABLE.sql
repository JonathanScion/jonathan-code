DO $$ 
BEGIN

ALTER TABLE collateral.collateral_personal_property_general_assigned_contracts
ADD COLUMN counterparty varchar(64),
ADD COLUMN separate_assignment_agreement boolean,
ADD COLUMN consent boolean;

END $$;