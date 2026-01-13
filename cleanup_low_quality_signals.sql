-- Clean up low-quality signals (below threshold of 7.0)

-- Step 1: Preview what will be deleted (check first!)
SELECT 
  id,
  title,
  score,
  status,
  created_at
FROM signals 
WHERE score < 7.0
ORDER BY score;

-- Step 2: Count how many will be deleted
SELECT 
  COUNT(*) as signals_to_delete,
  MIN(score) as min_score,
  MAX(score) as max_score,
  AVG(score) as avg_score
FROM signals 
WHERE score < 7.0;

-- Step 3: Actually delete low-quality signals (uncomment to run)
-- DELETE FROM signals 
-- WHERE score < 7.0;

-- Step 4: Verify remaining signals
SELECT 
  COUNT(*) as total_signals,
  MIN(score) as min_score,
  MAX(score) as max_score,
  AVG(score) as avg_score
FROM signals;

-- Step 5: See remaining high-quality signals
SELECT 
  id,
  title,
  score,
  status,
  hook_potential,
  created_at
FROM signals
WHERE score >= 7.0
ORDER BY score DESC
LIMIT 20;

