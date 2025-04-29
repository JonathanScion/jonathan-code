DO $$
BEGIN

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_intellectual_property_patents' AND column_name = 'recording_letter_date') THEN
        ALTER TABLE collateral.collateral_intellectual_property_patents ADD COLUMN recording_letter_date TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_intellectual_property_patents' AND column_name = 'recording_number') THEN
        ALTER TABLE collateral.collateral_intellectual_property_patents ADD COLUMN recording_number VARCHAR(64);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_intellectual_property_patents' AND column_name = 'assignor') THEN
        ALTER TABLE collateral.collateral_intellectual_property_patents ADD COLUMN assignor VARCHAR(64);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_intellectual_property_patents' AND column_name = 'expiration_date') THEN
        ALTER TABLE collateral.collateral_intellectual_property_patents ADD COLUMN expiration_date TIMESTAMPTZ;
    END IF;

END $$;
