DO $$
BEGIN

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_titled_property_vehicle' AND column_name = 'vehicle_make') THEN
        ALTER TABLE collateral.collateral_titled_property_vehicle ADD COLUMN vehicle_make_lookup INTEGER;
    END IF;


END $$;
