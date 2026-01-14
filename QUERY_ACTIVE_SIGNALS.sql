-- ============================================================
-- SQL QUERIES TO FIND ACTIVE SIGNALS (THOSE SHOWN IN UI)
-- ============================================================
--
-- IMPORTANT: The API applies tier limits that reduce the number shown:
--   - post_today: 5 signals max
--   - this_week: 7 signals max
--   - backlog: 15 signals max
--   - Protected signals (score >= 70) bypass tier limits
--   - Overall limit: 50 (but tier limits apply first)
--
-- So even if you have 50 signals with is_visible=true, the UI may show fewer
-- because of these tier limits!
--
-- ============================================================

-- PRIMARY QUERY: Get all active/visible signals for a specific show
-- The `is_visible` column is updated by the API based on scoring and filtering
-- NOTE: urgency_tier is calculated dynamically in the API, not stored in the database
SELECT 
  id,
  title,
  score,
  status,
  is_visible,
  created_at,
  updated_at,
  show_id,
  type,
  source_name,
  description,
  url,
  hook_potential,
  raw_data
FROM signals
WHERE 
  show_id = 'YOUR_SHOW_ID_HERE'  -- Replace with your actual show_id
  AND is_visible = true
  AND (status IS NULL OR status != 'rejected')  -- Exclude explicitly rejected
ORDER BY 
  created_at DESC,
  score DESC
LIMIT 50;

-- ============================================================
-- ALTERNATIVE: If is_visible column is not reliable, use this query
-- This matches the filtering logic in the API
-- ============================================================

SELECT 
  id,
  title,
  score,
  status,
  is_visible,
  created_at,
  updated_at,
  show_id,
  type,
  source_name,
  description,
  url,
  hook_potential
FROM signals
WHERE 
  show_id = 'YOUR_SHOW_ID_HERE'  -- Replace with your actual show_id
  AND (status IS NULL OR status != 'rejected')  -- Not rejected
  AND (is_visible = true OR is_visible IS NULL)  -- Visible or not yet processed
ORDER BY 
  created_at DESC,
  score DESC
LIMIT 50;

-- ============================================================
-- QUERY: Count active signals by score ranges
-- This helps estimate which tier they might be in
-- NOTE: urgency_tier is calculated in the API, not stored in DB
-- ============================================================

SELECT 
  status,
  COUNT(*) as count,
  AVG(score) as avg_score,
  MIN(score) as min_score,
  MAX(score) as max_score,
  -- Count by score ranges (helps estimate tier distribution)
  COUNT(*) FILTER (WHERE score >= 70) as high_score_count,
  COUNT(*) FILTER (WHERE score >= 50 AND score < 70) as medium_score_count,
  COUNT(*) FILTER (WHERE score < 50) as low_score_count
FROM signals
WHERE 
  show_id = 'YOUR_SHOW_ID_HERE'  -- Replace with your actual show_id
  AND is_visible = true
  AND (status IS NULL OR status != 'rejected')
GROUP BY status
ORDER BY count DESC;

-- ============================================================
-- QUERY: See which signals would be limited by tier limits
-- This shows signals sorted by score to see which would be cut
-- ============================================================

-- Top 5 by score (post_today tier limit)
SELECT 
  'POST_TODAY (top 5)' as tier_limit,
  id,
  title,
  score,
  status,
  created_at
FROM signals
WHERE 
  show_id = 'YOUR_SHOW_ID_HERE'
  AND is_visible = true
  AND (status IS NULL OR status != 'rejected')
  AND score >= 50  -- Approximate filter for post_today tier
ORDER BY score DESC, created_at DESC
LIMIT 5;

-- Next 7 by score (this_week tier limit)
SELECT 
  'THIS_WEEK (next 7)' as tier_limit,
  id,
  title,
  score,
  status,
  created_at
FROM signals
WHERE 
  show_id = 'YOUR_SHOW_ID_HERE'
  AND is_visible = true
  AND (status IS NULL OR status != 'rejected')
  AND score >= 30 AND score < 70  -- Approximate filter for this_week tier
ORDER BY score DESC, created_at DESC
LIMIT 7;

-- Remaining (backlog tier limit - max 15)
SELECT 
  'BACKLOG (max 15)' as tier_limit,
  id,
  title,
  score,
  status,
  created_at
FROM signals
WHERE 
  show_id = 'YOUR_SHOW_ID_HERE'
  AND is_visible = true
  AND (status IS NULL OR status != 'rejected')
  AND score < 50  -- Approximate filter for backlog tier
ORDER BY score DESC, created_at DESC
LIMIT 15;

-- ============================================================
-- QUERY: Get active signals with their scores
-- NOTE: urgency_tier is calculated in the API, not stored in DB
-- You can approximate tier by score ranges:
--   - High score (>= 70) = likely "post_today" or "this_week"
--   - Medium score (50-69) = likely "this_week" or "backlog"
--   - Lower score (< 50) = likely "backlog"
-- ============================================================

SELECT 
  id,
  title,
  score,
  status,
  is_visible,
  CASE 
    WHEN score >= 70 THEN 'HIGH (likely post_today/this_week)'
    WHEN score >= 50 THEN 'MEDIUM (likely this_week/backlog)'
    ELSE 'LOW (likely backlog)'
  END as estimated_tier,
  created_at,
  source_name,
  type,
  hook_potential
FROM signals
WHERE 
  show_id = 'YOUR_SHOW_ID_HERE'  -- Replace with your actual show_id
  AND is_visible = true
  AND (status IS NULL OR status != 'rejected')
ORDER BY 
  score DESC,
  created_at DESC;

-- ============================================================
-- QUERY: Check if is_visible column is being updated correctly
-- ============================================================

SELECT 
  is_visible,
  status,
  COUNT(*) as count,
  AVG(score) as avg_score
FROM signals
WHERE 
  show_id = 'YOUR_SHOW_ID_HERE'  -- Replace with your actual show_id
GROUP BY is_visible, status
ORDER BY is_visible DESC, status;

-- ============================================================
-- QUERY: Find signals that should be visible but aren't
-- (Potential data inconsistency check)
-- ============================================================

SELECT 
  id,
  title,
  score,
  status,
  is_visible,
  created_at,
  updated_at
FROM signals
WHERE 
  show_id = 'YOUR_SHOW_ID_HERE'  -- Replace with your actual show_id
  AND (status IS NULL OR status != 'rejected')
  AND score >= 50  -- High score signals
  AND (is_visible = false OR is_visible IS NULL)  -- But marked as not visible
ORDER BY score DESC, created_at DESC
LIMIT 20;

-- ============================================================
-- QUERY: Get all signals (for debugging - includes hidden ones)
-- ============================================================

SELECT 
  id,
  title,
  score,
  status,
  is_visible,
  created_at,
  updated_at,
  type,
  source_name,
  CASE 
    WHEN is_visible = true AND (status IS NULL OR status != 'rejected') THEN 'ACTIVE'
    WHEN status = 'rejected' THEN 'REJECTED'
    WHEN is_visible = false THEN 'HIDDEN'
    ELSE 'UNKNOWN'
  END as visibility_status
FROM signals
WHERE 
  show_id = 'YOUR_SHOW_ID_HERE'  -- Replace with your actual show_id
ORDER BY 
  created_at DESC
LIMIT 100;

-- ============================================================
-- NOTES:
-- ============================================================
-- 1. The `is_visible` column is the PRIMARY indicator of active signals
--    It's updated by the API route after scoring and filtering
--
-- 2. Signals are filtered out if:
--    - status = 'rejected'
--    - They don't pass scoring thresholds
--    - They exceed tier limits (post_today: 5, this_week: 7, backlog: 15)
--
-- 3. IMPORTANT: `urgency_tier` is NOT stored in the database!
--    It's calculated dynamically in the API based on:
--    - Score
--    - Competitor activity
--    - Time sensitivity
--    - DNA matches
--    To see the actual tier, you need to call the API endpoint
--
-- 4. Tier limits are applied in the API, so SQL can't perfectly replicate
--    the exact signals shown, but `is_visible = true` should match closely
--
-- 5. To get your show_id, run:
--    SELECT id, name FROM shows;
--
-- 6. If you want to see signals for ALL shows:
--    Remove the `show_id = ...` condition from the WHERE clause
--
-- 7. To see actual urgency_tier values, you need to:
--    - Call the API: GET /api/signals?show_id=YOUR_SHOW_ID
--    - Or check the API response which includes urgency_tier for each signal
--
-- 8. WHY YOU SEE 50 IN DB BUT ONLY 10 IN UI:
--    The API applies tier limits:
--      - post_today tier: max 5 signals
--      - this_week tier: max 7 signals
--      - backlog tier: max 15 signals
--    If most of your signals are in one tier (e.g., all backlog), you'll only
--    see up to 15 from that tier, even if 50 are marked is_visible=true.
--    Additionally, signals with real score < 70 are subject to tier limits,
--    while signals with real score >= 70 bypass limits.
--
--    To see which signals are being limited, check the API response stats:
--    GET /api/signals?show_id=YOUR_SHOW_ID
--    Look for: stats.by_tier and stats.per_tier_limit
