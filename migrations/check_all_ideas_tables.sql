-- ============================================================
-- CHECK ALL IDEAS/SIGNALS RELATED TABLES
-- Show ID: a7982c70-2b0e-46af-a0ad-c78f4f69cd56
-- ============================================================
-- Run this to see what data exists before clearing
-- ============================================================

-- Set show_id
\set show_id 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'

-- Check signals table
SELECT 
  'signals' as table_name,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7d,
  MIN(created_at) as oldest,
  MAX(created_at) as newest,
  AVG(score) as avg_score,
  MIN(score) as min_score,
  MAX(score) as max_score
FROM signals 
WHERE show_id = :'show_id';

-- Check recommendation_feedback table
SELECT 
  'recommendation_feedback' as table_name,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE action = 'liked') as liked,
  COUNT(*) FILTER (WHERE action = 'rejected') as rejected,
  COUNT(*) FILTER (WHERE action = 'saved') as saved,
  COUNT(*) FILTER (WHERE action = 'produced') as produced,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM recommendation_feedback 
WHERE show_id = :'show_id';

-- Check pitches table
SELECT 
  'pitches' as table_name,
  COUNT(*) as total_rows,
  COUNT(DISTINCT signal_id) as unique_signals,
  COUNT(*) FILTER (WHERE pitch_type = 'news') as news_pitches,
  COUNT(*) FILTER (WHERE pitch_type = 'analysis') as analysis_pitches,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM pitches 
WHERE show_id = :'show_id';

-- Check saved_ideas table
SELECT 
  'saved_ideas' as table_name,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE status = 'new') as new_status,
  COUNT(*) FILTER (WHERE status = 'approved') as approved_status,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM saved_ideas 
WHERE show_id = :'show_id';

-- Check show_learning_profile (if exists)
SELECT 
  'show_learning_profile' as table_name,
  COUNT(*) as total_rows,
  CASE WHEN COUNT(*) > 0 THEN 'Has learning data' ELSE 'No learning data' END as status
FROM show_learning_profile 
WHERE show_id = :'show_id';

-- Check show_learning_weights (if exists)
SELECT 
  'show_learning_weights' as table_name,
  COUNT(*) as total_rows,
  CASE WHEN COUNT(*) > 0 THEN 'Has learning weights' ELSE 'No learning weights' END as status
FROM show_learning_weights 
WHERE show_id = :'show_id';

-- Check show_behavior_patterns (if exists)
SELECT 
  'show_behavior_patterns' as table_name,
  COUNT(*) as total_rows,
  CASE WHEN COUNT(*) > 0 THEN 'Has behavior patterns' ELSE 'No behavior patterns' END as status
FROM show_behavior_patterns 
WHERE show_id = :'show_id';

-- Summary: All tables in one view
SELECT 
  'SUMMARY' as section,
  (SELECT COUNT(*) FROM signals WHERE show_id = :'show_id') as signals,
  (SELECT COUNT(*) FROM recommendation_feedback WHERE show_id = :'show_id') as feedback,
  (SELECT COUNT(*) FROM pitches WHERE show_id = :'show_id') as pitches,
  (SELECT COUNT(*) FROM saved_ideas WHERE show_id = :'show_id') as saved_ideas,
  (SELECT COUNT(*) FROM show_learning_profile WHERE show_id = :'show_id') as learning_profile,
  (SELECT COUNT(*) FROM show_learning_weights WHERE show_id = :'show_id') as learning_weights,
  (SELECT COUNT(*) FROM show_behavior_patterns WHERE show_id = :'show_id') as behavior_patterns;
