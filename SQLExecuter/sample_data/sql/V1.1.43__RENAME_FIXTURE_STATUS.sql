DO $$
BEGIN

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'fixture' AND column_name = 'fixture_status') THEN
        ALTER TABLE collateral.fixture DROP COLUMN fixture_status;
        ALTER TABLE collateral.fixture ADD COLUMN fixture_status_lookup_id integer;
    END IF;

END $$;
