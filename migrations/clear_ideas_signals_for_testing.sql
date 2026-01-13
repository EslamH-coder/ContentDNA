-- ============================================================
-- CLEAR IDEAS/SIGNALS DATA FOR TESTING
-- Show ID: a7982c70-2b0e-46af-a0ad-c78f4f69cd56
-- ============================================================
-- This script clears all ideas/signals data for a specific show
-- to allow fresh testing with clean data.
-- ============================================================

-- Set the show_id (UUID format)
-- IMPORTANT: Replace with your actual show_id if different
DO $$
DECLARE
  target_show_id UUID := 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
  signals_count INTEGER;
  feedback_count INTEGER;
  pitches_count INTEGER;
  saved_ideas_count INTEGER;
BEGIN
  -- ============================================================
  -- STEP 1: Check what we're about to delete (SAFETY CHECK)
  -- ============================================================
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CLEARING IDEAS/SIGNALS DATA FOR SHOW: %', target_show_id;
  RAISE NOTICE '========================================';
  
  -- Count records before deletion
  SELECT COUNT(*) INTO signals_count FROM signals WHERE show_id = target_show_id;
  SELECT COUNT(*) INTO feedback_count FROM recommendation_feedback WHERE show_id = target_show_id;
  SELECT COUNT(*) INTO pitches_count FROM pitches WHERE show_id = target_show_id;
  SELECT COUNT(*) INTO saved_ideas_count FROM saved_ideas WHERE show_id = target_show_id;
  
  RAISE NOTICE 'Found records to delete:';
  RAISE NOTICE '  - Signals: %', signals_count;
  RAISE NOTICE '  - Feedback: %', feedback_count;
  RAISE NOTICE '  - Pitches: %', pitches_count;
  RAISE NOTICE '  - Saved Ideas: %', saved_ideas_count;
  RAISE NOTICE '========================================';
  
  -- ============================================================
  -- STEP 2: Delete signals/ideas data
  -- ============================================================
  
  -- Delete pitches (cached pitches for signals)
  DELETE FROM pitches WHERE show_id = target_show_id;
  RAISE NOTICE '✅ Deleted % pitches', pitches_count;
  
  -- Delete saved ideas (different from signals)
  DELETE FROM saved_ideas WHERE show_id = target_show_id;
  RAISE NOTICE '✅ Deleted % saved ideas', saved_ideas_count;
  
  -- Delete signals (main ideas/signals table)
  DELETE FROM signals WHERE show_id = target_show_id;
  RAISE NOTICE '✅ Deleted % signals', signals_count;
  
  -- ============================================================
  -- STEP 3: Delete feedback data (OPTIONAL - see recommendations below)
  -- ============================================================
  
  -- UNCOMMENT TO DELETE FEEDBACK (not recommended for testing)
  -- DELETE FROM recommendation_feedback WHERE show_id = target_show_id;
  -- RAISE NOTICE '✅ Deleted % feedback records', feedback_count;
  
  -- ============================================================
  -- STEP 4: Reset computed/cached scores (OPTIONAL)
  -- ============================================================
  
  -- Note: These columns are computed on-the-fly, but we can reset them if they exist
  -- The API will recompute them on next request
  -- UPDATE signals SET is_visible = NULL, relevance_score = NULL WHERE show_id = target_show_id;
  -- (Already deleted above, so not needed)
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CLEARING COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Clear localStorage: localStorage.removeItem("seenSignals_a7982c70-2b0e-46af-a0ad-c78f4f69cd56");';
  RAISE NOTICE '2. Trigger fresh sync: GET /api/rss-processor?show_id=...';
  RAISE NOTICE '3. Or use UI: Go to /studio and click "Refresh Signals"';
  RAISE NOTICE '========================================';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ Error clearing data: %', SQLERRM;
    RAISE;
END $$;

-- ============================================================
-- ALTERNATIVE: Manual deletion (if DO block doesn't work)
-- ============================================================
-- Run these one by one if the DO block above fails:

-- 1. Delete pitches (cached pitches)
-- DELETE FROM pitches WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';

-- 2. Delete saved ideas
-- DELETE FROM saved_ideas WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';

-- 3. Delete signals (main ideas/signals)
-- DELETE FROM signals WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';

-- 4. Delete feedback (OPTIONAL - see recommendations)
-- DELETE FROM recommendation_feedback WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';

-- ============================================================
-- VERIFY DELETION
-- ============================================================
-- Run after deletion to verify:

SELECT 
  'signals' as table_name,
  COUNT(*) as remaining_count
FROM signals 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'

UNION ALL

SELECT 
  'recommendation_feedback' as table_name,
  COUNT(*) as remaining_count
FROM recommendation_feedback 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'

UNION ALL

SELECT 
  'pitches' as table_name,
  COUNT(*) as remaining_count
FROM pitches 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'

UNION ALL

SELECT 
  'saved_ideas' as table_name,
  COUNT(*) as remaining_count
FROM saved_ideas 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
