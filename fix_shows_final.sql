-- Step 1: Check what type channel_id actually is
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'shows' AND column_name = 'channel_id';

-- Step 2: Fix RLS policy first
DROP POLICY IF EXISTS "Allow all reads on shows" ON shows;
CREATE POLICY "Allow all reads on shows" 
ON shows 
FOR SELECT 
USING (true);

-- Step 3: Check if show already exists
SELECT id, name, channel_id FROM shows WHERE id = '00000000-0000-0000-0000-000000000004'::uuid;

-- Step 4: Insert or update show
-- If channel_id is TEXT (most likely):
INSERT INTO shows (id, name, channel_id) 
VALUES (
  '00000000-0000-0000-0000-000000000004'::uuid,
  'Test Show',
  'test-channel-123'
)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
RETURNING id, name, channel_id;

-- If the above fails, channel_id is probably UUID, so use this instead:
-- INSERT INTO shows (id, name, channel_id) 
-- VALUES (
--   '00000000-0000-0000-0000-000000000004'::uuid,
--   'Test Show',
--   '00000000-0000-0000-0000-000000000001'::uuid
-- )
-- ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
-- RETURNING id, name, channel_id;

-- Step 5: Verify shows can be read
SELECT id, name, channel_id FROM shows;

