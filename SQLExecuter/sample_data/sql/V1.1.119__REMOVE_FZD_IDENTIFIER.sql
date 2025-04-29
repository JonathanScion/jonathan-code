DO $$ 
BEGIN

ALTER TABLE collateral.real_estate_site_parcels DROP COLUMN fzd_identifier;

END $$;