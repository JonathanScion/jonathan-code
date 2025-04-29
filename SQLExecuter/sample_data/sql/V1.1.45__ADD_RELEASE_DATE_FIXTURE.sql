DO $$
BEGIN

IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'fixture') THEN
    ALTER TABLE collateral.fixture ADD COLUMN release_date DATE;
END IF;

END $$;
