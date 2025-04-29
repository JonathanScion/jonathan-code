DO $$ 
BEGIN

-- Add in_participating_community field to fixtures table
IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'collateral' 
    AND table_name = 'fixture' 
    AND column_name = 'in_participating_community'
) THEN
    ALTER TABLE collateral.fixture 
    ADD COLUMN in_participating_community BOOLEAN;

END IF;

-- Add need_flood_insurance field to fixtures table
IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'collateral' 
    AND table_name = 'fixture' 
    AND column_name = 'need_flood_insurance'
) THEN
    ALTER TABLE collateral.fixture 
    ADD COLUMN need_flood_insurance BOOLEAN;

END IF;

-- Add flood_zone_determination_id field to fixtures table
IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'collateral' 
    AND table_name = 'fixture' 
    AND column_name = 'flood_zone_determination_id'
) THEN
    ALTER TABLE collateral.fixture 
    ADD COLUMN flood_zone_determination_id INTEGER;

    -- Add foreign key constraint
    ALTER TABLE collateral.fixture
    ADD CONSTRAINT fk_fixture_flood_zone_determination
    FOREIGN KEY (flood_zone_determination_id) 
    REFERENCES collateral.flood_zone_determinations(flood_zone_determination_id)
    ON DELETE SET NULL;

    -- Add index to improve query performance
    CREATE INDEX idx_fixture_flood_zone_determination_id 
    ON collateral.fixture(flood_zone_determination_id);
END IF;

END $$;