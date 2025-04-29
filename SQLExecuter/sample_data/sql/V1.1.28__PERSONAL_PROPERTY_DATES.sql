DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'collateral' 
          AND table_name = 'collateral_titled_property_vehicle' 
          AND column_name = 'title_expiration'
    ) THEN
        ALTER TABLE collateral.collateral_titled_property_vehicle 
        ALTER COLUMN title_expiration TYPE TIMESTAMPTZ 
        USING title_expiration::TIMESTAMPTZ;
    END IF;

    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'collateral' 
          AND table_name = 'collateral_receivables_life_insurance' 
          AND column_name = 'issue_date'
    ) THEN
        ALTER TABLE collateral.collateral_receivables_life_insurance 
        ALTER COLUMN issue_date TYPE TIMESTAMPTZ 
        USING issue_date::TIMESTAMPTZ;
    END IF;

    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'collateral' 
          AND table_name = 'collateral_titled_property_trailers' 
          AND column_name = 'title_expiration'
    ) THEN
        ALTER TABLE collateral.collateral_titled_property_trailers 
        ALTER COLUMN title_expiration TYPE TIMESTAMPTZ 
        USING title_expiration::TIMESTAMPTZ;
    END IF;
END $$;

