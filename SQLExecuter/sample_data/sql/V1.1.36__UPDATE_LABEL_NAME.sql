DO $$
BEGIN

UPDATE collateral.lookups
SET label = 'Building carve-out'
WHERE label = 'Carve-out building' 
AND value = 2 
AND type = 9;    
   
END $$;