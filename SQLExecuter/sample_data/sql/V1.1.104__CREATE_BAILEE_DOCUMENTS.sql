DO $$
BEGIN

CREATE TABLE collateral.mortgages (
    mortgage_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY
    -- Add other columns as needed in the future
);

CREATE TABLE collateral.insurances (
    insurance_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY
    -- Add other columns as needed in the future
);

ALTER TABLE collateral.customer_documents ADD COLUMN bailee_agreement_id INTEGER;
ALTER TABLE collateral.customer_documents ADD CONSTRAINT fk__bailee_agreement_id FOREIGN KEY (bailee_agreement_id) REFERENCES collateral.bailee_agreement (bailee_agreement_id) ON DELETE CASCADE;

ALTER TABLE collateral.customer_documents ADD COLUMN commitment_id INTEGER;
ALTER TABLE collateral.customer_documents ADD CONSTRAINT fk__commitment_id FOREIGN KEY (commitment_id) REFERENCES collateral.customer_commitments (commitment_id) ON DELETE CASCADE;
ALTER TABLE collateral.customer_documents ADD COLUMN mortgage_id INTEGER;
ALTER TABLE collateral.customer_documents ADD CONSTRAINT fk__mortgage_id FOREIGN KEY (mortgage_id) REFERENCES collateral.mortgages (mortgage_id) ON DELETE CASCADE;

ALTER TABLE collateral.customer_documents ADD COLUMN insurance_id INTEGER;
ALTER TABLE collateral.customer_documents ADD CONSTRAINT fk__insurance_id FOREIGN KEY (insurance_id) REFERENCES collateral.insurances (insurance_id) ON DELETE CASCADE;

ALTER TABLE collateral.customer_notes ADD COLUMN commitment_id INTEGER;
ALTER TABLE collateral.customer_notes ADD CONSTRAINT fk__commitment_id FOREIGN KEY (commitment_id) REFERENCES collateral.customer_commitments (commitment_id) ON DELETE CASCADE;

ALTER TABLE collateral.customer_notes ADD COLUMN mortgage_id INTEGER;
ALTER TABLE collateral.customer_notes ADD CONSTRAINT fk__mortgage_id FOREIGN KEY (mortgage_id) REFERENCES collateral.mortgages (mortgage_id) ON DELETE CASCADE;

ALTER TABLE collateral.customer_notes ADD COLUMN insurance_id INTEGER;
ALTER TABLE collateral.customer_notes ADD CONSTRAINT fk__insurance_id FOREIGN KEY (insurance_id) REFERENCES collateral.insurances (insurance_id) ON DELETE CASCADE;



END $$;