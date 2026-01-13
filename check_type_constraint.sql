-- Check what values are allowed in the type column
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'signals'::regclass
  AND conname LIKE '%type%';

