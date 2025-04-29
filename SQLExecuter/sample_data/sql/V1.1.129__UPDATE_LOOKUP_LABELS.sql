DO $$
BEGIN

UPDATE collateral.lookups
SET label = 'Building or parcel released / not mortgaged'
WHERE label = 'Building or Parcel Released / Not Mortgaged' 
AND value = 7 
AND type = 34;    
 
END $$;