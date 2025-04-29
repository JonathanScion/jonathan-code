DO $$
BEGIN

-- Update Fixture_Legal_Description from VARCHAR to TEXT
ALTER TABLE collateral.fixture
ALTER COLUMN fixture_legal_description TYPE text;

END $$;