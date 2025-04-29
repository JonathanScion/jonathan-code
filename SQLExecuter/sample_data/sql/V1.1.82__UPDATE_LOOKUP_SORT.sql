DO $$
BEGIN

UPDATE collateral.lookups SET sort_order = 2 WHERE type = 31 and label = 'Tenants in Common';

UPDATE collateral.lookups SET sort_order = 3 WHERE type = 31 and label = 'N/A';

END $$;
