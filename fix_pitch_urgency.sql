-- Fix Pitch Urgency Classification
-- Run this in Supabase SQL Editor
-- This will update all recent pitches to have correct urgency values

-- Step 1: Set all recent pitches (last 7 days) to 'this_week'
UPDATE pitch_history
SET urgency = 'this_week'
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'
  AND created_at > NOW() - INTERVAL '7 days'
  AND urgency != 'this_week';

-- Step 2: Set very recent high-score ones (last 2 days) to 'post_today'
-- Note: This assumes high-score signals are those with predicted_views > average
-- You may want to adjust the condition based on your scoring logic
UPDATE pitch_history
SET urgency = 'post_today'
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'
  AND created_at > NOW() - INTERVAL '2 days'
  AND (predicted_views > 500000 OR prediction_confidence > 0.75)
  AND urgency != 'post_today';

-- Step 3: Check result
SELECT urgency, COUNT(*) as count
FROM pitch_history 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY urgency
ORDER BY urgency;

-- Step 4: Show sample pitches by urgency
SELECT 
  urgency,
  pitch_title,
  predicted_views,
  prediction_confidence,
  created_at
FROM pitch_history
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY urgency, created_at DESC
LIMIT 20;
