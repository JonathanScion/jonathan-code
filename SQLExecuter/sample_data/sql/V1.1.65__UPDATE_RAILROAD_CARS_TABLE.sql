DO $$
BEGIN

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_titled_property_railroad_cars' AND column_name = 'railroad_car_record_status_lookup_id') THEN
        ALTER TABLE collateral.collateral_titled_property_railroad_cars ADD COLUMN railroad_car_record_status_lookup_id SMALLINT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_titled_property_railroad_cars' AND column_name = 'railroad_car_record_release_date') THEN
        ALTER TABLE collateral.collateral_titled_property_railroad_cars ADD COLUMN railroad_car_record_release_date TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_titled_property_railroad_cars' AND column_name = 'stoc_collateral_id') THEN
        ALTER TABLE collateral.collateral_titled_property_railroad_cars ADD COLUMN stoc_collateral_id VARCHAR(64);
    END IF;

END $$;