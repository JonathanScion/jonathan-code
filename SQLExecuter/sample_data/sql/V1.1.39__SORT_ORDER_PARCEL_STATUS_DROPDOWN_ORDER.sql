DO $$
BEGIN

UPDATE collateral.lookups SET sort_order = 1 WHERE type = 12 and label = 'Potential future use';
UPDATE collateral.lookups SET sort_order = 2 WHERE type = 12 and label = 'In process';
UPDATE collateral.lookups SET sort_order = 3 WHERE type = 12 and label = 'Active';
UPDATE collateral.lookups SET sort_order = 4 WHERE type = 12 and label = 'Pending release';
UPDATE collateral.lookups SET sort_order = 5 WHERE type = 12 and label = 'Released';

END $$;
