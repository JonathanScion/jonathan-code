DO $$
BEGIN

-- since the document types are unique across all categories we do not need to save the category to the database

ALTER TABLE collateral.customer_documents DROP COLUMN type_category_lookup_id;

END $$;