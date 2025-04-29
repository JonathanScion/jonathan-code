DO $$
BEGIN

    DELETE FROM collateral.lookups
    WHERE label = 'NA' 
    AND value = 1 
    AND type = 9 
    AND CAST(NULL AS INTEGER) IS NULL;


   
END $$;
