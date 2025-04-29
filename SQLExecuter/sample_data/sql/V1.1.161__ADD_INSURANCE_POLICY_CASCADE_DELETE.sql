DO $$ 
BEGIN

ALTER TABLE collateral.insurance_policies ADD CONSTRAINT fk__ins_pol_customer FOREIGN KEY (customer_id) REFERENCES collateral.customers (customer_id) ON DELETE CASCADE;

END $$;