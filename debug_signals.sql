-- Check if signals exist and what show_id they have
SELECT 
  id,
  show_id,
  title,
  score,
  status,
  type,
  detected_at,
  created_at
FROM signals
ORDER BY detected_at DESC
LIMIT 20;

-- Check what shows exist
SELECT id, name, channel_id FROM shows;

-- Count signals per show
SELECT 
  show_id,
  COUNT(*) as signal_count,
  MAX(detected_at) as latest_signal
FROM signals
GROUP BY show_id;

