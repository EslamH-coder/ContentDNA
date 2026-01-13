-- Check if signals already exist (deduplication check)
SELECT 
  COUNT(*) as total_signals,
  COUNT(DISTINCT title) as unique_titles,
  MIN(score) as min_score,
  MAX(score) as max_score,
  AVG(score) as avg_score
FROM signals 
WHERE show_id = '00000000-0000-0000-0000-000000000004';

-- Check recent signals
SELECT 
  id,
  title,
  score,
  source_id,
  detected_at,
  created_at
FROM signals 
WHERE show_id = '00000000-0000-0000-0000-000000000004'
ORDER BY detected_at DESC NULLS LAST, created_at DESC
LIMIT 10;

