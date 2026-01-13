-- Comprehensive verification script

-- 1. Check if signals exist
SELECT COUNT(*) as total_signals FROM signals;

-- 2. Check signals with their show_id and status
SELECT 
  id,
  show_id,
  title,
  score,
  status,
  type,
  created_at
FROM signals
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check what show_id the signals have
SELECT 
  show_id,
  COUNT(*) as count,
  array_agg(DISTINCT status) as statuses
FROM signals
GROUP BY show_id;

-- 4. Check what shows exist
SELECT id, name, channel_id FROM shows;

-- 5. Verify RLS is enabled
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'signals';

-- 6. Check SELECT policies
SELECT 
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'signals' AND cmd = 'SELECT';

-- 7. Test query with the exact show_id
SELECT 
  id,
  show_id,
  title,
  score,
  status
FROM signals
WHERE show_id = '00000000-0000-0000-0000-000000000004'::uuid
ORDER BY score DESC
LIMIT 5;

-- 8. If no SELECT policy exists, create it:
-- DROP POLICY IF EXISTS "Allow all reads on signals" ON signals;
-- CREATE POLICY "Allow all reads on signals" ON signals FOR SELECT USING (true);

