DO $$
BEGIN

    -- Check if the column 'version' does not exist before adding it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='customer_documents' 
                   AND column_name='type_lookup_id') THEN
        ALTER TABLE collateral.customer_documents ADD COLUMN type_lookup_id SMALLINT;
    END IF;

    INSERT INTO collateral.lookups (label, value, type, parent_lookup_id)
    SELECT * FROM (
        SELECT 'Appraisal' AS label, 1 AS value, 25 AS type, CAST(NULL AS INTEGER) UNION ALL
        SELECT 'Opinion of Counsel' AS label, 2 AS value, 25 AS type, CAST(NULL AS INTEGER) UNION ALL
        SELECT 'Environmental Report' AS label, 3 AS value, 25 AS type, CAST(NULL AS INTEGER) UNION ALL
        SELECT 'Environmental Checklist' AS label, 4 AS value, 25 AS type, CAST(NULL AS INTEGER)
    ) AS tmp
        WHERE NOT EXISTS (
        SELECT 1 FROM collateral.lookups 
        WHERE value = tmp.value 
            AND type = tmp.type 
            AND parent_lookup_id IS NULL
        );
END $$;
