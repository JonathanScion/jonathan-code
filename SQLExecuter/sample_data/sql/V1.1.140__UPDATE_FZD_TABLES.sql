DO $$ 
BEGIN

-- Add fixture_id column to flood_zone_determinations table
IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'collateral' 
    AND table_name = 'flood_zone_determinations' 
    AND column_name = 'fixture_id'
) THEN
    ALTER TABLE collateral.flood_zone_determinations 
    ADD COLUMN fixture_id INTEGER NULL;

    ALTER TABLE collateral.flood_zone_determinations
    ADD CONSTRAINT fk_flood_zone_determination_fixture
    FOREIGN KEY (fixture_id) 
    REFERENCES collateral.fixture(fixture_id)
    ON DELETE CASCADE;

    CREATE INDEX idx_flood_zone_determinations_fixture_id 
    ON collateral.flood_zone_determinations(fixture_id);
END IF;

-- Add fixture_id column to flood_zone_requests table
IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'collateral' 
    AND table_name = 'flood_zone_requests' 
    AND column_name = 'fixture_id'
) THEN
    ALTER TABLE collateral.flood_zone_requests 
    ADD COLUMN fixture_id INTEGER NULL;

    ALTER TABLE collateral.flood_zone_requests
    ADD CONSTRAINT fk_flood_zone_request_fixture
    FOREIGN KEY (fixture_id) 
    REFERENCES collateral.fixture(fixture_id)
    ON DELETE CASCADE;

    CREATE INDEX idx_flood_zone_requests_fixture_id 
    ON collateral.flood_zone_requests(fixture_id);
END IF;

-- Drop flood_zone_determination_fixtures table if it exists
IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'collateral' 
    AND table_name = 'flood_zone_determination_fixtures'
) THEN
    DROP TABLE collateral.flood_zone_determination_fixtures;
END IF;

-- Drop flood_zone_request_fixtures table if it exists
IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'collateral' 
    AND table_name = 'flood_zone_request_fixtures'
) THEN
    DROP TABLE collateral.flood_zone_request_fixtures;
END IF;


END $$;