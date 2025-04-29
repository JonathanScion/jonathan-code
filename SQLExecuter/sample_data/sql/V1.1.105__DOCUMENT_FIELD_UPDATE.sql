DO $$
BEGIN

    -- DROP UNUSED COLUMNS
    ALTER TABLE collateral.customer_documents DROP COLUMN filename;
    ALTER TABLE collateral.flood_zone_determinations DROP COLUMN company_mpid;
    ALTER TABLE collateral.flood_zone_requests DROP COLUMN company_mpid;

    -- ADD COLUMN
    -- remove any existing test data ( this table is not being used by this version so any data is test data )
    DELETE FROM collateral.customer_document_versions;
    DELETE FROM collateral.customer_document_bridges;
    DELETE FROM collateral.customer_documents;

    ALTER TABLE collateral.customer_document_versions ADD COLUMN filename VARCHAR(256) NOT NULL;

END $$;