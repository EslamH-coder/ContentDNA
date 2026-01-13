-- Delete signals below the new threshold (7.0)

-- Step 1: Preview what will be deleted
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
  ROUND(AVG(score), 2) as avg_score
FROM signals 
WHERE score < 7.0;

-- Step 3: DELETE low-quality signals (score < 7.0)
DELETE FROM signals 
WHERE score < 7.0;

-- Step 4: Verify remaining high-quality signals
SELECT 
  COUNT(*) as total_signals,
  MIN(score) as min_score,
  MAX(score) as max_score,
  ROUND(AVG(score), 2) as avg_score
FROM signals;

-- Step 5: Show remaining signals
SELECT 
  id,
  title,
  score,
  status,
  hook_potential,
  created_at
FROM signals
ORDER BY score DESC;

