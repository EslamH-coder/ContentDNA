-- ============================================================
-- ADD ARABIC RSS FEEDS TO SIGNAL_SOURCES
-- ============================================================
-- This script adds Arabic RSS feeds for better economic and 
-- geopolitical news coverage.
--
-- IMPORTANT: Replace '00000000-0000-0000-0000-000000000004' 
-- with your actual show_id UUID
-- ============================================================

-- ========================================
-- GOOGLE NEWS - BY TOPIC (Arabic)
-- ========================================

-- 1. الاقتصاد العربي
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'Google News - اقتصاد عربي',
  'https://news.google.com/rss/search?q=اقتصاد+عربي&hl=ar&gl=SA&ceid=SA:ar',
  true,
  20,
  '["us_china_geopolitics", "currency_devaluation", "inflation_prices", "energy_oil_gas_lng"]'::jsonb
);

-- 2. النفط والطاقة
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'Google News - النفط والطاقة',
  'https://news.google.com/rss/search?q=النفط+أسعار+الطاقة&hl=ar&gl=SA&ceid=SA:ar',
  true,
  20,
  '["energy_oil_gas_lng", "currency_devaluation"]'::jsonb
);

-- 3. الذهب والاستثمار
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'Google News - الذهب والاستثمار',
  'https://news.google.com/rss/search?q=الذهب+الدولار+استثمار&hl=ar&gl=SA&ceid=SA:ar',
  true,
  20,
  '["currency_devaluation", "inflation_prices"]'::jsonb
);

-- 4. السعودية اقتصاد
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'Google News - السعودية اقتصاد',
  'https://news.google.com/rss/search?q=السعودية+اقتصاد+استثمار&hl=ar&gl=SA&ceid=SA:ar',
  true,
  20,
  '["energy_oil_gas_lng", "currency_devaluation"]'::jsonb
);

-- 5. الإمارات اقتصاد
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'Google News - الإمارات اقتصاد',
  'https://news.google.com/rss/search?q=الإمارات+اقتصاد+دبي&hl=ar&gl=SA&ceid=SA:ar',
  true,
  20,
  '["currency_devaluation", "inflation_prices"]'::jsonb
);

-- 6. مصر اقتصاد
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'Google News - مصر اقتصاد',
  'https://news.google.com/rss/search?q=مصر+اقتصاد+جنيه&hl=ar&gl=SA&ceid=SA:ar',
  true,
  20,
  '["currency_devaluation", "inflation_prices"]'::jsonb
);

-- 7. الصين وأمريكا (جيوسياسة)
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'Google News - الصين وأمريكا',
  'https://news.google.com/rss/search?q=الصين+أمريكا+حرب+تجارية&hl=ar&gl=SA&ceid=SA:ar',
  true,
  20,
  '["us_china_geopolitics", "sanctions_econ_war"]'::jsonb
);

-- 8. ترامب
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'Google News - ترامب',
  'https://news.google.com/rss/search?q=ترامب+اقتصاد&hl=ar&gl=SA&ceid=SA:ar',
  true,
  20,
  '["us_china_geopolitics", "sanctions_econ_war", "us_debt_treasuries"]'::jsonb
);

-- 9. الذكاء الاصطناعي
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'Google News - الذكاء الاصطناعي',
  'https://news.google.com/rss/search?q=الذكاء+الاصطناعي+تقنية&hl=ar&gl=SA&ceid=SA:ar',
  true,
  20,
  '[]'::jsonb
);

-- 10. تسلا وماسك
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'Google News - تسلا وماسك',
  'https://news.google.com/rss/search?q=تسلا+إيلون+ماسك&hl=ar&gl=SA&ceid=SA:ar',
  true,
  20,
  '[]'::jsonb
);

-- 11. العملات الرقمية
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'Google News - العملات الرقمية',
  'https://news.google.com/rss/search?q=بيتكوين+عملات+رقمية&hl=ar&gl=SA&ceid=SA:ar',
  true,
  20,
  '["currency_devaluation"]'::jsonb
);

-- 12. أزمات اقتصادية
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'Google News - أزمات اقتصادية',
  'https://news.google.com/rss/search?q=أزمة+اقتصادية+انهيار&hl=ar&gl=SA&ceid=SA:ar',
  true,
  20,
  '["us_debt_treasuries", "consumer_credit_cards"]'::jsonb
);

-- 13. البنوك المركزية
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'Google News - البنوك المركزية',
  'https://news.google.com/rss/search?q=الفيدرالي+فائدة+بنك+مركزي&hl=ar&gl=SA&ceid=SA:ar',
  true,
  20,
  '["us_debt_treasuries", "currency_devaluation", "inflation_prices"]'::jsonb
);

-- 14. التضخم والأسعار
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'Google News - التضخم والأسعار',
  'https://news.google.com/rss/search?q=تضخم+أسعار+غلاء&hl=ar&gl=SA&ceid=SA:ar',
  true,
  20,
  '["inflation_prices", "currency_devaluation"]'::jsonb
);

-- 15. رواد الأعمال
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'Google News - رواد الأعمال',
  'https://news.google.com/rss/search?q=رائد+أعمال+ملياردير+ثروة&hl=ar&gl=SA&ceid=SA:ar',
  true,
  20,
  '[]'::jsonb
);

-- ========================================
-- GOOGLE NEWS - BY SOURCE (Arabic Media)
-- ========================================

-- 16. الجزيرة نت - اقتصاد
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'الجزيرة نت - اقتصاد',
  'https://news.google.com/rss/search?q=site:aljazeera.net+اقتصاد&hl=ar&gl=SA&ceid=SA:ar',
  true,
  20,
  '["us_china_geopolitics", "currency_devaluation", "inflation_prices", "energy_oil_gas_lng"]'::jsonb
);

-- 17. الجزيرة نت - سياسة
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'الجزيرة نت - سياسة',
  'https://news.google.com/rss/search?q=site:aljazeera.net+سياسة+دولية&hl=ar&gl=SA&ceid=SA:ar',
  true,
  20,
  '["us_china_geopolitics", "sanctions_econ_war"]'::jsonb
);

-- 18. العربية - اقتصاد
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'العربية - اقتصاد',
  'https://news.google.com/rss/search?q=site:alarabiya.net+اقتصاد&hl=ar&gl=SA&ceid=SA:ar',
  true,
  20,
  '["us_china_geopolitics", "currency_devaluation", "inflation_prices", "energy_oil_gas_lng"]'::jsonb
);

-- 19. الشرق بلومبرج
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'الشرق بلومبرج',
  'https://news.google.com/rss/search?q=site:asharqbusiness.com&hl=ar&gl=SA&ceid=SA:ar',
  true,
  20,
  '["us_china_geopolitics", "currency_devaluation", "inflation_prices", "energy_oil_gas_lng", "us_debt_treasuries"]'::jsonb
);

-- 20. سكاي نيوز عربية - اقتصاد
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'سكاي نيوز عربية - اقتصاد',
  'https://news.google.com/rss/search?q=site:skynewsarabia.com+اقتصاد&hl=ar&gl=SA&ceid=SA:ar',
  true,
  20,
  '["us_china_geopolitics", "currency_devaluation", "inflation_prices"]'::jsonb
);

-- 21. CNN عربي - اقتصاد
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'CNN عربي - اقتصاد',
  'https://news.google.com/rss/search?q=site:arabic.cnn.com+اقتصاد&hl=ar&gl=SA&ceid=SA:ar',
  true,
  20,
  '["us_china_geopolitics", "currency_devaluation", "inflation_prices"]'::jsonb
);

-- 22. BBC عربي - اقتصاد
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'BBC عربي - اقتصاد',
  'https://news.google.com/rss/search?q=site:bbc.com/arabic+اقتصاد&hl=ar&gl=SA&ceid=SA:ar',
  true,
  20,
  '["us_china_geopolitics", "currency_devaluation", "inflation_prices"]'::jsonb
);

-- 23. الشرق الأوسط
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'الشرق الأوسط',
  'https://news.google.com/rss/search?q=site:aawsat.com+اقتصاد&hl=ar&gl=SA&ceid=SA:ar',
  true,
  20,
  '["us_china_geopolitics", "currency_devaluation", "inflation_prices"]'::jsonb
);

-- 24. فرانس 24 عربي
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'فرانس 24 عربي',
  'https://news.google.com/rss/search?q=site:france24.com/ar+اقتصاد&hl=ar&gl=SA&ceid=SA:ar',
  true,
  20,
  '["us_china_geopolitics", "currency_devaluation", "inflation_prices"]'::jsonb
);

-- 25. الاقتصادية (السعودية)
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'الاقتصادية',
  'https://news.google.com/rss/search?q=site:aleqt.com&hl=ar&gl=SA&ceid=SA:ar',
  true,
  20,
  '["currency_devaluation", "inflation_prices", "energy_oil_gas_lng"]'::jsonb
);

-- 26. أرقام
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'أرقام',
  'https://news.google.com/rss/search?q=site:argaam.com&hl=ar&gl=SA&ceid=SA:ar',
  true,
  20,
  '["currency_devaluation", "inflation_prices", "us_debt_treasuries"]'::jsonb
);

-- 27. مباشر
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'مباشر',
  'https://news.google.com/rss/search?q=site:mubasher.info&hl=ar&gl=SA&ceid=SA:ar',
  true,
  20,
  '["currency_devaluation", "inflation_prices", "us_debt_treasuries"]'::jsonb
);

-- ========================================
-- DIRECT RSS FEEDS (Verified Working)
-- ========================================

-- 28. Sky News Arabia (Direct RSS)
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'Sky News Arabia - RSS Direct',
  'https://www.skynewsarabia.com/rss.xml',
  true,
  20,
  '["us_china_geopolitics", "currency_devaluation", "inflation_prices"]'::jsonb
);

-- 29. Al Jazeera English (Direct RSS)
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'Al Jazeera English - RSS Direct',
  'https://www.aljazeera.com/xml/rss/all.xml',
  true,
  20,
  '["us_china_geopolitics", "currency_devaluation", "sanctions_econ_war"]'::jsonb
);

-- 30. Arab News (Direct RSS)
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'Arab News - RSS Direct',
  'https://www.arabnews.com/rss.xml',
  true,
  20,
  '["us_china_geopolitics", "currency_devaluation", "inflation_prices"]'::jsonb
);

-- ========================================
-- VERIFY FEEDS WERE ADDED
-- ========================================

-- Check all Arabic feeds
SELECT 
  id, 
  name, 
  url, 
  enabled, 
  item_limit,
  dna_topics,
  created_at
FROM signal_sources 
WHERE show_id = '00000000-0000-0000-0000-000000000004'
  AND (name LIKE '%Google News%' OR name LIKE '%الجزيرة%' OR name LIKE '%العربية%' OR name LIKE '%Sky News%' OR name LIKE '%Al Jazeera%' OR name LIKE '%Arab News%' OR name LIKE '%الشرق%' OR name LIKE '%CNN%' OR name LIKE '%BBC%' OR name LIKE '%الاقتصادية%' OR name LIKE '%أرقام%' OR name LIKE '%مباشر%')
ORDER BY created_at DESC;

-- Count total feeds for this show
SELECT COUNT(*) as total_feeds
FROM signal_sources 
WHERE show_id = '00000000-0000-0000-0000-000000000004'
  AND enabled = true;




