DO $$ 
BEGIN

-- Create the collateral bailee agreement bridge table
CREATE TABLE collateral.customer_collateral_bailee_bridge (
    collateral_bailee_bridge_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id VARCHAR(64) NOT NULL,
    collateral_id INTEGER NOT NULL,
    bailee_agreement_id INTEGER NOT NULL,
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(64) NOT NULL,
    updated_by VARCHAR(64),
    deleted_by VARCHAR(64)
);

CREATE INDEX idx__collateral__bailee__bridge__customer ON collateral.customer_collateral_bailee_bridge (customer_id);
CREATE INDEX idx__collateral__bailee__bridge__collateral ON collateral.customer_collateral_bailee_bridge (collateral_id);
CREATE INDEX idx__collateral__bailee__bridge__bailee ON collateral.customer_collateral_bailee_bridge (bailee_agreement_id);

-- Add foreign keys constraint to the customer_collateral_bailee_bridge table
ALTER TABLE collateral.customer_collateral_bailee_bridge ADD CONSTRAINT fk__collateral_bailee__bridge__customer FOREIGN KEY (customer_id) REFERENCES collateral.customers (customer_id) ON DELETE CASCADE;
ALTER TABLE collateral.customer_collateral_bailee_bridge ADD CONSTRAINT fk__collateral_bailee__bridge__collateral FOREIGN KEY (collateral_id) REFERENCES collateral.collateral (collateral_id) ON DELETE CASCADE;
ALTER TABLE collateral.customer_collateral_bailee_bridge ADD CONSTRAINT fk__collateral_bailee__bridge__bailee FOREIGN KEY (bailee_agreement_id) REFERENCES collateral.bailee_agreement (bailee_agreement_id) ON DELETE CASCADE;

END $$;