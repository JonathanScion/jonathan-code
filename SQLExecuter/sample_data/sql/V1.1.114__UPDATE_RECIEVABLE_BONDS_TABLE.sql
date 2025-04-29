DO $$
BEGIN

-- ADD NON NULLABLE COLUMN
ALTER TABLE collateral.collateral_receivables_bonds ADD COLUMN paper_possession_verified BOOLEAN;

END $$; 

