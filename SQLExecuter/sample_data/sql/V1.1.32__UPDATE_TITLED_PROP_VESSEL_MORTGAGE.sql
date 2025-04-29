DO $$
BEGIN

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_titled_property_vessels' AND column_name = 'mortgage_date') THEN
        ALTER TABLE collateral.collateral_titled_property_vessels ADD COLUMN mortgage_date TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_titled_property_vessels' AND column_name = 'mortgage_recording_date') THEN
        ALTER TABLE collateral.collateral_titled_property_vessels ADD COLUMN mortgage_recording_date TIMESTAMPTZ;
    END IF;

END $$;
