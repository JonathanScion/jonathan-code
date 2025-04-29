DO $$
BEGIN

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_titled_property_trailers' AND column_name = 'trailer_make') THEN
        ALTER TABLE collateral.collateral_titled_property_trailers DROP COLUMN trailer_make;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_titled_property_trailers' AND column_name = 'trailer_make_lookup') THEN
        ALTER TABLE collateral.collateral_titled_property_trailers ADD COLUMN trailer_make_lookup INTEGER;
    END IF;

END $$;
