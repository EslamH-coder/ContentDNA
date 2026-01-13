-- Step 1: Check if signals exist at all
SELECT COUNT(*) as total_signals FROM signals;

-- Step 2: Check signals with their show_id
SELECT 
  id,
  show_id,
  title,
  score,
  status,
  created_at
FROM signals
ORDER BY created_at DESC
LIMIT 10;

-- Step 3: Check what show_id the signals have
SELECT 
  show_id,
  COUNT(*) as count
FROM signals
GROUP BY show_id;

-- Step 4: Check what shows exist
SELECT id, name, channel_id FROM shows;

-- Step 5: Verify the show_id format
SELECT 
  '00000000-0000-0000-0000-000000000004'::uuid as test_uuid,
  show_id,
  COUNT(*) as signal_count
FROM signals
WHERE show_id = '00000000-0000-0000-0000-000000000004'::uuid
GROUP BY show_id;

-- Step 6: Check RLS policies
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'signals';

