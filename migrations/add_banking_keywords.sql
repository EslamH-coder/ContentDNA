-- ============================================================
-- Add Banking Keywords to Economic Topics
-- ============================================================
-- Run this in Supabase SQL Editor
-- 
-- This adds banking-related keywords to economic topics so that
-- signals about "World Bank", "banking", "IMF" etc. match correctly

-- Add banking keywords to economic topics
UPDATE topic_definitions
SET keywords = keywords || ARRAY['bank', 'banking', 'بنك', 'world bank', 'imf', 'صندوق', 'central bank', 'بنك مركزي', 'federal reserve', 'fed', 'reserve bank']
WHERE topic_id IN ('economic_mistakes_crises', 'us_debt_treasuries', 'currency_devaluation', 'global_economy')
AND show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';

-- Verify the update
SELECT topic_id, topic_name_en, keywords 
FROM topic_definitions 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'
AND topic_id IN ('economic_mistakes_crises', 'us_debt_treasuries', 'currency_devaluation', 'global_economy')
ORDER BY topic_id;
