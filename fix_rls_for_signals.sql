-- Step 1: Check current RLS status
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'signals';

-- Step 2: Check existing policies
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'signals';

-- Step 3: Drop existing SELECT policy if it exists (to recreate it)
DROP POLICY IF EXISTS "Allow all reads on signals" ON signals;

-- Step 4: Create a new SELECT policy that allows all reads
CREATE POLICY "Allow all reads on signals" 
ON signals 
FOR SELECT 
USING (true);

-- Step 5: Verify the policy was created
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'signals' AND cmd = 'SELECT';

-- Step 6: Test query (should work now)
SELECT 
  id,
  show_id,
  title,
  score,
  status
FROM signals
WHERE show_id = '00000000-0000-0000-0000-000000000004'
LIMIT 5;

