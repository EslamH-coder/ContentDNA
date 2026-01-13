-- Update topic definitions with additional keywords
-- Date: 2024
-- Description: Add more keywords to existing topics to improve signal matching

-- 1. Update tech_companies_analysis - add Tesla, crypto keywords
UPDATE topic_definitions
SET keywords = keywords || '["tesla", "تسلا", "robotaxi", "crypto", "bitcoin", "بيتكوين"]'::jsonb
WHERE topic_id = 'tech_companies_analysis'
AND show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';

-- 2. Update currency_devaluation - add gold, Syria keywords
UPDATE topic_definitions
SET keywords = keywords || '["gold", "ذهب", "ليرة", "سوريا", "syria", "dollar", "دولار"]'::jsonb
WHERE topic_id = 'currency_devaluation'
AND show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';

-- 3. Update missiles_air_defense - add more keywords
UPDATE topic_definitions
SET keywords = keywords || '["venezuela", "chinese military", "air defense", "دفاع جوي"]'::jsonb
WHERE topic_id = 'missiles_air_defense'
AND show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';

-- 4. Update us_china_relations - add tariff keywords
UPDATE topic_definitions
SET keywords = keywords || '["tariff", "tariffs", "رسوم جمركية", "india", "الهند", "trade war"]'::jsonb
WHERE topic_id = 'us_china_relations'
AND show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';

-- Verify updates
SELECT 
  topic_id,
  topic_name_ar,
  topic_name_en,
  keywords,
  array_length(keywords::text::text[], 1) as keyword_count
FROM topic_definitions
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'
AND topic_id IN (
  'tech_companies_analysis',
  'currency_devaluation',
  'missiles_air_defense',
  'us_china_relations'
)
ORDER BY topic_id;


