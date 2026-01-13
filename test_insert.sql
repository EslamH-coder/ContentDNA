-- Test insert to check if RLS is blocking
-- Run this in Supabase SQL Editor to test if you can insert manually

INSERT INTO signals (
  show_id,
  title,
  type,
  score,
  hook_potential,
  status
)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'Test Signal',
  'rss',
  5,
  '6.5',
  'new'
)
RETURNING id, title, score;

-- If this works, the issue is in the API code
-- If this fails, check RLS policies

