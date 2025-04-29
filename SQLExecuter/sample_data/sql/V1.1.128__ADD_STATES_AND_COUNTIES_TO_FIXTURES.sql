DO $$
BEGIN

ALTER TABLE collateral.fixture ADD COLUMN IF NOT EXISTS states VARCHAR[];

ALTER TABLE collateral.fixture ADD COLUMN IF NOT EXISTS counties VARCHAR[];

ALTER TABLE collateral.fixture DROP COLUMN state;

ALTER TABLE collateral.fixture DROP COLUMN county;

END $$;