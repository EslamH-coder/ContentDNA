-- Clean up existing duplicate signals
-- This migration removes duplicate signals (same show_id and title)
-- Keeps the oldest signal (lowest id) and deletes newer duplicates

-- First, check how many duplicates exist
SELECT 
  'Before cleanup' as status,
  COUNT(*) as total_signals,
  COUNT(*) - COUNT(DISTINCT (show_id, title)) as duplicate_count
FROM signals;

-- Delete duplicates (keep the oldest one based on id)
DELETE FROM signals a
USING signals b
WHERE a.id > b.id
  AND a.show_id = b.show_id
  AND LOWER(TRIM(a.title)) = LOWER(TRIM(b.title));

-- Check results after cleanup
SELECT 
  'After cleanup' as status,
  COUNT(*) as total_signals,
  COUNT(*) - COUNT(DISTINCT (show_id, LOWER(TRIM(title)))) as remaining_duplicates
FROM signals;

-- Optional: Add a unique index to prevent future duplicates at database level
-- Note: This uses MD5 hash of normalized title to handle long titles
-- Uncomment if you want database-level enforcement:
-- CREATE UNIQUE INDEX IF NOT EXISTS signals_show_title_unique 
-- ON signals (show_id, md5(LOWER(TRIM(title))));



