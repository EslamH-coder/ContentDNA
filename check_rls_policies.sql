-- Check RLS policies on signals table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'signals';

-- Check if RLS is enabled
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'signals';

-- Test query to see if we can read signals
SELECT 
  id,
  show_id,
  title,
  score,
  status
FROM signals
WHERE show_id = '00000000-0000-0000-0000-000000000004'
LIMIT 5;

