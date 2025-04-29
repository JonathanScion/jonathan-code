DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_titled_property_trailers' AND column_name = 'trailer_make') THEN
        ALTER TABLE collateral.collateral_titled_property_trailers ADD COLUMN trailer_make VARCHAR(64);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_titled_property_trailers' AND column_name = 'trailer_model') THEN
        ALTER TABLE collateral.collateral_titled_property_trailers ADD COLUMN trailer_model VARCHAR(64);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_titled_property_trailers' AND column_name = 'trailer_year') THEN
        ALTER TABLE collateral.collateral_titled_property_trailers ADD COLUMN trailer_year INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_titled_property_trailers' AND column_name = 'trailer_vin') THEN
        ALTER TABLE collateral.collateral_titled_property_trailers ADD COLUMN trailer_vin VARCHAR(64);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_titled_property_trailers' AND column_name = 'title_expiration') THEN
        ALTER TABLE collateral.collateral_titled_property_trailers ADD COLUMN title_expiration DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_titled_property_trailers' AND column_name = 'title_number') THEN
        ALTER TABLE collateral.collateral_titled_property_trailers ADD COLUMN title_number VARCHAR(64);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_titled_property_trailers' AND column_name = 'trailer_weight') THEN
        ALTER TABLE collateral.collateral_titled_property_trailers ADD COLUMN trailer_weight INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_titled_property_trailers' AND column_name = 'trailer_state') THEN
        ALTER TABLE collateral.collateral_titled_property_trailers ADD COLUMN trailer_state CHAR(2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_titled_property_trailers' AND column_name = 'form_of_evidence_lookup') THEN
        ALTER TABLE collateral.collateral_titled_property_trailers ADD COLUMN form_of_evidence_lookup INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_titled_property_trailers' AND column_name = 'possession_verified') THEN
        ALTER TABLE collateral.collateral_titled_property_trailers ADD COLUMN possession_verified BOOLEAN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_titled_property_trailers' AND column_name = 'released_to') THEN
        ALTER TABLE collateral.collateral_titled_property_trailers ADD COLUMN released_to VARCHAR(64);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'collateral' AND table_name = 'collateral_titled_property_trailers' AND column_name = 'return_method_lookup') THEN
        ALTER TABLE collateral.collateral_titled_property_trailers ADD COLUMN return_method_lookup INTEGER;
    END IF;
END $$;