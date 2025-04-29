DO $$
BEGIN IF NOT EXISTS (
    SELECT
        1
    FROM
        information_schema.columns
    WHERE
        table_schema = 'collateral'
        AND table_name = 'collateral'
        AND column_name = 'external_collateral_id'
) THEN
ALTER TABLE collateral.collateral
ADD COLUMN external_collateral_id INT;

END IF;

IF NOT EXISTS (
    SELECT
        1
    FROM
        information_schema.columns
    WHERE
        table_schema = 'collateral'
        AND table_name = 'fixture'
        AND column_name = 'external_collateral_id'
) THEN
ALTER TABLE collateral.fixture
ADD COLUMN external_collateral_id INT;

END IF;

IF NOT EXISTS (
    SELECT
        1
    FROM
        information_schema.columns
    WHERE
        table_schema = 'collateral'
        AND table_name = 'real_estate_sites'
        AND column_name = 'external_collateral_id'
) THEN
ALTER TABLE collateral.real_estate_sites
ADD COLUMN external_collateral_id INT;

END IF;

IF NOT EXISTS (
    SELECT
        1
    FROM
        information_schema.columns
    WHERE
        table_schema = 'collateral'
        AND table_name = 'real_estate_site_parcels'
        AND column_name = 'external_collateral_id'
) THEN
ALTER TABLE collateral.real_estate_site_parcels
ADD COLUMN external_collateral_id INT;

END IF;

END $$;