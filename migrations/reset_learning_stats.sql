-- Reset Learning Stats - Start Fresh
-- This script resets all learning weights and feedback data
-- Run this in your Supabase SQL editor

-- ============================================
-- OPTION 1: Reset for a specific show
-- ============================================
-- Replace 'YOUR_SHOW_ID' with your actual show_id (UUID or BIGINT)

-- Reset learning weights for a specific show
UPDATE show_learning_weights
SET 
  topic_weights = '{}'::jsonb,
  dna_topic_weights = '{}'::jsonb,
  source_weights = '{}'::jsonb,
  format_weights = '{}'::jsonb,
  rejection_patterns = '{}'::jsonb,
  evidence_weights = '{}'::jsonb,
  angle_preferences = '{}'::jsonb,
  total_feedback_count = 0,
  last_feedback_at = NULL,
  last_learning_update_at = NULL,
  updated_at = NOW()
WHERE show_id = 'YOUR_SHOW_ID'; -- Replace with your show_id

-- Delete all feedback records for a specific show
DELETE FROM recommendation_feedback
WHERE show_id = 'YOUR_SHOW_ID'; -- Replace with your show_id

-- ============================================
-- OPTION 2: Reset ALL learning data (all shows)
-- ============================================
-- WARNING: This will reset learning for ALL shows!

-- Reset all learning weights
UPDATE show_learning_weights
SET 
  topic_weights = '{}'::jsonb,
  dna_topic_weights = '{}'::jsonb,
  source_weights = '{}'::jsonb,
  format_weights = '{}'::jsonb,
  rejection_patterns = '{}'::jsonb,
  evidence_weights = '{}'::jsonb,
  angle_preferences = '{}'::jsonb,
  total_feedback_count = 0,
  last_feedback_at = NULL,
  last_learning_update_at = NULL,
  updated_at = NOW();

-- Delete all feedback records
DELETE FROM recommendation_feedback;

-- ============================================
-- OPTION 3: Delete and recreate (nuclear option)
-- ============================================
-- WARNING: This completely removes learning data!

-- Delete all learning weights (they will be recreated on next feedback)
-- DELETE FROM show_learning_weights WHERE show_id = 'YOUR_SHOW_ID';

-- Delete all feedback records
-- DELETE FROM recommendation_feedback WHERE show_id = 'YOUR_SHOW_ID';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check current learning weights for a show
SELECT 
  show_id,
  topic_weights,
  dna_topic_weights,
  source_weights,
  total_feedback_count,
  last_feedback_at
FROM show_learning_weights
WHERE show_id = 'YOUR_SHOW_ID'; -- Replace with your show_id

-- Count feedback records for a show
SELECT COUNT(*) as feedback_count
FROM recommendation_feedback
WHERE show_id = 'YOUR_SHOW_ID'; -- Replace with your show_id

-- Check all shows with learning data
SELECT 
  show_id,
  total_feedback_count,
  last_feedback_at
FROM show_learning_weights
ORDER BY last_feedback_at DESC;


