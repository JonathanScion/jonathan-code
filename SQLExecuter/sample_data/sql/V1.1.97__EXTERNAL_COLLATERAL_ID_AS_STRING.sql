DO $$
BEGIN
    IF EXISTS (
        SELECT
            1
        FROM
            information_schema.columns
        WHERE
            table_schema = 'collateral'
            AND table_name = 'collateral'
            AND column_name = 'external_collateral_id'
            AND data_type = 'integer'
    ) THEN
        ALTER TABLE collateral.collateral
        ALTER COLUMN external_collateral_id TYPE VARCHAR(64);
    END IF;

    IF EXISTS (
        SELECT
            1
        FROM
            information_schema.columns
        WHERE
            table_schema = 'collateral'
            AND table_name = 'fixture'
            AND column_name = 'external_collateral_id'
            AND data_type = 'integer'
    ) THEN
        ALTER TABLE collateral.fixture
        ALTER COLUMN external_collateral_id TYPE VARCHAR(64);
    END IF;

    IF EXISTS (
        SELECT
            1
        FROM
            information_schema.columns
        WHERE
            table_schema = 'collateral'
            AND table_name = 'real_estate_sites'
            AND column_name = 'external_collateral_id'
            AND data_type = 'integer'
    ) THEN
        ALTER TABLE collateral.real_estate_sites
        ALTER COLUMN external_collateral_id TYPE VARCHAR(64);
    END IF;

    IF EXISTS (
        SELECT
            1
        FROM
            information_schema.columns
        WHERE
            table_schema = 'collateral'
            AND table_name = 'real_estate_site_parcels'
            AND column_name = 'external_collateral_id'
            AND data_type = 'integer'
    ) THEN
        ALTER TABLE collateral.real_estate_site_parcels
        ALTER COLUMN external_collateral_id TYPE VARCHAR(64);
    END IF;
END $$;