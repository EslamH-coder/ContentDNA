-- Simple fix: Check column type and insert show

-- Step 1: Check what type channel_id is
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'shows' AND column_name = 'channel_id';

-- Step 2: Fix RLS first
DROP POLICY IF EXISTS "Allow all reads on shows" ON shows;
CREATE POLICY "Allow all reads on shows" 
ON shows 
FOR SELECT 
USING (true);

-- Step 3: Insert show (try UUID first for channel_id)
INSERT INTO shows (id, name, channel_id) 
VALUES (
  '00000000-0000-0000-0000-000000000004'::uuid,
  'Test Show',
  '00000000-0000-0000-0000-000000000001'::uuid
)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
RETURNING id, name, channel_id;

-- If that fails with UUID error, channel_id is probably TEXT, so use:
-- INSERT INTO shows (id, name, channel_id) 
-- VALUES (
--   '00000000-0000-0000-0000-000000000004'::uuid,
--   'Test Show',
--   'test-channel-123'
-- )
-- ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
-- RETURNING id, name, channel_id;

