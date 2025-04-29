DO $$
BEGIN

-- ADD NULLABLE COLUMN
ALTER TABLE collateral.collateral_receivables_letter_of_credit 
    ADD COLUMN paper_possession_verified BOOLEAN;
ALTER TABLE collateral.collateral_receivables_pledged_note 
    ADD COLUMN paper_possession_verified BOOLEAN;

END $$; 

