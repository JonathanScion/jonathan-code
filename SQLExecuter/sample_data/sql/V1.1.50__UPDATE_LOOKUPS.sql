DO $$
BEGIN

UPDATE collateral.lookups
SET label = 'Patent'
WHERE label = 'Patents' 
AND value = 1 
AND type = 5;    

UPDATE collateral.lookups
SET label = 'Copyright'
WHERE label = 'Copyrights' 
AND value = 3 
AND type = 5;    

END $$;