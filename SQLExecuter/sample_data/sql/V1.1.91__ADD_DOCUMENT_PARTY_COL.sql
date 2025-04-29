DO $$
BEGIN

-- add related_parties to customer documents
ALTER TABLE collateral.customer_documents ADD COLUMN related_parties VARCHAR(64)[];

-- drop old unused table
DROP TABLE collateral.collateral_document CASCADE;

END $$; 

