-- This is to change the sort order, which is also done in 1.1.39 so it can be removed in any consolidation

DO $$
BEGIN

UPDATE collateral.lookups
SET value = CASE label
    WHEN 'Potential future use' THEN 5
    WHEN 'In process' THEN 4
    WHEN 'Active' THEN 1
    WHEN 'Pending release' THEN 3
    WHEN 'Released' THEN 2
    ELSE value
END
WHERE type = 12;
   
END $$;