-- Diagnostic SQL to check AlMokhbir show_dna topics structure
-- Run this in Supabase SQL Editor

-- 1. Check show_dna record
SELECT 
  show_id,
  CASE 
    WHEN topics IS NULL THEN 'NULL'
    WHEN topics::text = 'null' THEN 'JSON null'
    WHEN topics::text = '[]' THEN 'Empty array []'
    WHEN topics::text = '{}' THEN 'Empty object {}'
    ELSE pg_typeof(topics)::text
  END as topics_type,
  CASE 
    WHEN topics IS NULL THEN NULL
    WHEN jsonb_typeof(topics) = 'array' THEN jsonb_array_length(topics)
    WHEN jsonb_typeof(topics) = 'object' THEN jsonb_object_keys(topics)::text
    ELSE topics::text
  END as topics_structure,
  topics::text as topics_raw_value,
  LENGTH(topics::text) as topics_length
FROM show_dna 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';

-- 2. Get full show_dna record to see all columns
SELECT * FROM show_dna 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';

-- 3. Check if topic_definitions table exists and has data
SELECT 
  COUNT(*) as topic_definitions_count,
  show_id,
  topic_id,
  name,
  keywords
FROM topic_definitions 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'
GROUP BY show_id, topic_id, name, keywords
LIMIT 10;

-- 4. Check expected structure - what SHOULD be in topics column
-- This shows the expected format:
SELECT jsonb_build_array(
  jsonb_build_object(
    'topic_id', 'energy_oil_gas',
    'name', 'Energy, Oil & Gas',
    'keywords', jsonb_build_array('oil', 'نفط', 'petroleum', 'غاز', 'gas', 'energy', 'طاقة', 'بترول', 'crude', 'lng')
  ),
  jsonb_build_object(
    'topic_id', 'geopolitics',
    'name', 'Geopolitics',
    'keywords', jsonb_build_array('trump', 'ترامب', 'china', 'الصين', 'war', 'حرب', 'iran', 'إيران', 'russia', 'روسيا')
  ),
  jsonb_build_object(
    'topic_id', 'economy',
    'name', 'Economy',
    'keywords', jsonb_build_array('economy', 'اقتصاد', 'inflation', 'تضخم', 'dollar', 'دولار', 'market', 'سوق')
  )
) as expected_topics_format;

-- 5. If topics column is broken, this will fix it:
-- Uncomment and run this ONLY if you want to fix the data:
/*
UPDATE show_dna 
SET topics = jsonb_build_array(
  jsonb_build_object(
    'topic_id', 'energy_oil_gas',
    'name', 'Energy, Oil & Gas',
    'keywords', jsonb_build_array('oil', 'نفط', 'petroleum', 'غاز', 'gas', 'energy', 'طاقة', 'بترول', 'crude', 'lng')
  ),
  jsonb_build_object(
    'topic_id', 'geopolitics',
    'name', 'Geopolitics',
    'keywords', jsonb_build_array('trump', 'ترامب', 'china', 'الصين', 'war', 'حرب', 'iran', 'إيران', 'russia', 'روسيا')
  ),
  jsonb_build_object(
    'topic_id', 'economy',
    'name', 'Economy',
    'keywords', jsonb_build_array('economy', 'اقتصاد', 'inflation', 'تضخم', 'dollar', 'دولار', 'market', 'سوق')
  )
)
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
*/
