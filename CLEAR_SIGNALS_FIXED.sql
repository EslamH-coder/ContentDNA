-- ============================================
-- SAFE WAYS TO CLEAR SIGNALS
-- ============================================

-- Option 1: Find your show_id first (recommended)
SELECT id, name FROM shows;

-- Option 2: Delete all signals (if you only have one show)
DELETE FROM signals;

-- Option 3: Delete with correct UUID (no trailing spaces!)
-- Replace with your actual show_id from Option 1
DELETE FROM signals WHERE show_id = '00000000-0000-0000-0000-000000000004';

-- Option 4: Delete only low-score signals (safer - keeps good ones)
DELETE FROM signals WHERE score < 80;

-- Option 5: Delete only old signals (keeps recent ones)
DELETE FROM signals WHERE created_at < NOW() - INTERVAL '7 days';

-- Option 6: Delete by show name (if you know it)
DELETE FROM signals 
WHERE show_id IN (
  SELECT id FROM shows WHERE name = 'Your Show Name'
);

-- ============================================
-- RECOMMENDED: Safe delete with backup
-- ============================================

-- Step 1: See what you'll delete
SELECT COUNT(*) as total_signals, 
       COUNT(*) FILTER (WHERE score < 80) as low_score,
       COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '7 days') as old
FROM signals;

-- Step 2: Delete low-score signals only (safest)
DELETE FROM signals WHERE score < 80;

-- Step 3: Or delete all if you're sure
-- DELETE FROM signals;

