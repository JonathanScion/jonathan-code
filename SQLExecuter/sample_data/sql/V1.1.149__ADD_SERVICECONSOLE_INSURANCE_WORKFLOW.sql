DO $$
BEGIN

-- Add ServiceConsole Id fields to flood zone determination
ALTER TABLE collateral.insurance_policies
ADD COLUMN service_console_id VARCHAR(32),
ADD COLUMN service_console_id_set_date TIMESTAMPTZ;

END $$; 

