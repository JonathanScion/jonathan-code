DO $$
BEGIN

-- ADD IS_SFHA column
ALTER TABLE collateral.fixture ADD COLUMN is_sfha BOOLEAN;

END $$; 