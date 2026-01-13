-- Step 1: Check if shows exist
SELECT id, name, channel_id FROM shows;

-- Step 2: Check RLS status on shows table
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'shows';

-- Step 3: Check existing SELECT policies on shows
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'shows' AND cmd = 'SELECT';

-- Step 4: Drop existing SELECT policy if it exists
DROP POLICY IF EXISTS "Allow all reads on shows" ON shows;

-- Step 5: Create a new SELECT policy that allows all reads
CREATE POLICY "Allow all reads on shows" 
ON shows 
FOR SELECT 
USING (true);

-- Step 6: Verify the policy was created
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'shows' AND cmd = 'SELECT';

-- Step 7: If no shows exist, create one (use the show_id from your signals)
-- Note: channel_id might be TEXT or UUID - check your schema first
-- If channel_id is UUID, use: '00000000-0000-0000-0000-000000000001'::uuid
-- If channel_id is TEXT, use: 'test-channel-123'

-- First, check the column type:
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'shows' AND column_name = 'channel_id';

-- Then insert (adjust based on column type):
-- Option A: If channel_id is UUID
INSERT INTO shows (id, name, channel_id) 
VALUES (
  '00000000-0000-0000-0000-000000000004'::uuid,
  'Test Show',
  '00000000-0000-0000-0000-000000000001'::uuid
)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
RETURNING id, name, channel_id;

-- Option B: If channel_id is TEXT (uncomment if needed)
-- INSERT INTO shows (id, name, channel_id) 
-- VALUES (
--   '00000000-0000-0000-0000-000000000004'::uuid,
--   'Test Show',
--   'test-channel-123'
-- )
-- ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
-- RETURNING id, name, channel_id;

-- Step 8: Verify shows can be read
SELECT id, name, channel_id FROM shows;

