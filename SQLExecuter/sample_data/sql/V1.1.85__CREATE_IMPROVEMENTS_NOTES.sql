DO $$
BEGIN

ALTER TABLE collateral.customer_notes ADD COLUMN real_estate_site_parcel_improvement_id INTEGER;
ALTER TABLE collateral.customer_notes ADD CONSTRAINT fk__note_real_estate_site_parcel_improvement_id FOREIGN KEY (real_estate_site_parcel_improvement_id) REFERENCES collateral.real_estate_site_parcel_improvements (real_estate_site_parcel_improvement_id) ON DELETE CASCADE;

END $$;