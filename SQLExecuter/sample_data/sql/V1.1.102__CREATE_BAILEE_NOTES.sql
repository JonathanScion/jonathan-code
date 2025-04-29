DO $$
BEGIN

ALTER TABLE collateral.customer_notes ADD COLUMN bailee_agreement_id INTEGER;
ALTER TABLE collateral.customer_notes ADD CONSTRAINT fk__bailee_agreement_id FOREIGN KEY (bailee_agreement_id) REFERENCES collateral.bailee_agreement (bailee_agreement_id) ON DELETE CASCADE;

END $$;