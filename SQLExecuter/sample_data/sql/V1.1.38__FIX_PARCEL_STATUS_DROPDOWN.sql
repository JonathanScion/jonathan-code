-- This is a duplicate of 1.1.37 -- we can remove in any conslidation

DO $$
BEGIN

UPDATE collateral.lookups
SET value = CASE label
    WHEN 'Potential future use' THEN 1
    WHEN 'In process' THEN 2
    WHEN 'Active' THEN 3
    WHEN 'Pending release' THEN 4
    WHEN 'Released' THEN 5
    ELSE value
END
WHERE type = 12;
   
END $$;