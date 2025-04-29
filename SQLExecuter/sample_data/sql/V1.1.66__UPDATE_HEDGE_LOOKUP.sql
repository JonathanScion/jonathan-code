DO $$
BEGIN

UPDATE collateral.lookups SET label = 'Securities account' WHERE label = 'Hedge account';

END $$;