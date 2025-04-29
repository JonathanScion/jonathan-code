DO $$
BEGIN
    IF EXISTS (
        SELECT
            1
        FROM
            information_schema.columns
        WHERE
            table_schema = 'collateral'
            AND table_name = 'real_estate_site_parcels'
            AND column_name = 'fixture_status'            
    ) THEN
        ALTER TABLE collateral.real_estate_site_parcels
        DROP COLUMN fixture_status;
    END IF;

    IF EXISTS (
        SELECT
            1
        FROM
            information_schema.columns
        WHERE
            table_schema = 'collateral'
            AND table_name = 'real_estate_site_parcels'
            AND column_name = 'improvement_description'
    ) THEN
        ALTER TABLE collateral.real_estate_site_parcels
        DROP COLUMN improvement_description;
    END IF;

END $$;