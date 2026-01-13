-- Add new topic definitions
-- Date: 2024
-- Description: Add three new topics: Russia-Ukraine Conflict, Banking & Finance, Gulf & Saudi Economy

-- 1. Russia/Ukraine conflict
INSERT INTO topic_definitions (show_id, topic_id, topic_name_en, topic_name_ar, keywords, is_active)
VALUES (
  'a7982c70-2b0e-46af-a0ad-c78f4f69cd56',
  'russia_ukraine_conflict',
  'Russia-Ukraine Conflict',
  'الصراع الروسي الأوكراني',
  '["ukraine", "أوكرانيا", "russia", "روسيا", "putin", "بوتين", "kyiv", "كييف"]'::jsonb,
  true
)
ON CONFLICT (show_id, topic_id) 
DO UPDATE SET
  topic_name_en = EXCLUDED.topic_name_en,
  topic_name_ar = EXCLUDED.topic_name_ar,
  keywords = EXCLUDED.keywords,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 2. Banking & Finance
INSERT INTO topic_definitions (show_id, topic_id, topic_name_en, topic_name_ar, keywords, is_active)
VALUES (
  'a7982c70-2b0e-46af-a0ad-c78f4f69cd56',
  'banking_finance',
  'Banking & Finance',
  'البنوك والتمويل',
  '["bank", "بنك", "banking", "مصرف", "dimon", "jpmorgan", "goldman", "central bank", "المركزي"]'::jsonb,
  true
)
ON CONFLICT (show_id, topic_id) 
DO UPDATE SET
  topic_name_en = EXCLUDED.topic_name_en,
  topic_name_ar = EXCLUDED.topic_name_ar,
  keywords = EXCLUDED.keywords,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 3. Gulf/Saudi Economy
INSERT INTO topic_definitions (show_id, topic_id, topic_name_en, topic_name_ar, keywords, is_active)
VALUES (
  'a7982c70-2b0e-46af-a0ad-c78f4f69cd56',
  'gulf_saudi_economy',
  'Gulf & Saudi Economy',
  'اقتصاد الخليج والسعودية',
  '["السعودية", "saudi", "الإمارات", "uae", "قطر", "qatar", "رؤية 2030", "vision 2030", "أرامكو", "aramco"]'::jsonb,
  true
)
ON CONFLICT (show_id, topic_id) 
DO UPDATE SET
  topic_name_en = EXCLUDED.topic_name_en,
  topic_name_ar = EXCLUDED.topic_name_ar,
  keywords = EXCLUDED.keywords,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Verify inserts
SELECT 
  topic_id,
  topic_name_en,
  topic_name_ar,
  keywords,
  is_active,
  created_at
FROM topic_definitions
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'
AND topic_id IN (
  'russia_ukraine_conflict',
  'banking_finance',
  'gulf_saudi_economy'
)
ORDER BY topic_id;


