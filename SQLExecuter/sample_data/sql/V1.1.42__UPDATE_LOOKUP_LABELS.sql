DO $$
BEGIN

UPDATE collateral.lookups
SET label = 'Sh (Sweet) Corn'
WHERE label = 'Sh Corn' 
AND value = 10 
AND type = 18;    

UPDATE collateral.lookups
SET label = 'Yellow Corn'
WHERE label = 'Corn Yellow' 
AND value = 8 
AND type = 18;    

UPDATE collateral.lookups
SET label = 'Equity (Non-CoBank)'
WHERE label = 'Equity (non-CoBank)' 
AND value = 4 
AND type = 5;    
   
END $$;