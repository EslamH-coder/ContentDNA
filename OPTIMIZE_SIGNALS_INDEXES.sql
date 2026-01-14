-- ============================================
-- SIGNAL PAGE PERFORMANCE OPTIMIZATION
-- Add indexes to speed up signal queries
-- ============================================

-- Index 1: Fast lookup by show_id, is_visible, score, and created_at
-- This is the primary query pattern for the Ideas page
CREATE INDEX IF NOT EXISTS idx_signals_show_visible_score_created 
ON signals(show_id, is_visible, score DESC, created_at DESC);

-- Index 2: Fast lookup by show_id and created_at (for time filtering)
CREATE INDEX IF NOT EXISTS idx_signals_show_created 
ON signals(show_id, created_at DESC);

-- Index 3: Fast lookup by show_id and source_type (for filtering Reddit/Wikipedia)
CREATE INDEX IF NOT EXISTS idx_signals_show_source_type 
ON signals(show_id, source_type);

-- Index 4: Fast lookup by show_id and status (for filtering liked/rejected)
CREATE INDEX IF NOT EXISTS idx_signals_show_status 
ON signals(show_id, status);

-- Index 5: Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_signals_show_visible_status 
ON signals(show_id, is_visible, status, score DESC);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check if indexes were created
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'signals'
AND indexname LIKE 'idx_signals%'
ORDER BY indexname;

-- Test query performance (should be fast with indexes)
EXPLAIN ANALYZE
SELECT *
FROM signals
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'
AND is_visible = true
ORDER BY score DESC, created_at DESC
LIMIT 200;

-- ============================================
-- NOTES
-- ============================================
-- These indexes will speed up:
-- 1. Main signals query (show_id + is_visible + score + created_at)
-- 2. Time-based filtering (show_id + created_at)
-- 3. Source type filtering (show_id + source_type)
-- 4. Status filtering (show_id + status)
--
-- Expected improvement: 10-100x faster queries
-- Trade-off: Slightly slower INSERT/UPDATE (acceptable for read-heavy workload)
