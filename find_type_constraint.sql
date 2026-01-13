-- Find the CHECK constraint on the type column
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'signals'::regclass
  AND contype = 'c'  -- 'c' = check constraint
ORDER BY conname;

-- Alternative: Check if there's a constraint on type column specifically
SELECT 
  tc.constraint_name,
  tc.constraint_type,
  cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc 
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'signals'
  AND tc.constraint_type = 'CHECK';

