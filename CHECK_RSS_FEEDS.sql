-- ============================================================
-- CHECK RSS FEED CONFIGURATION FOR SHOW
-- ============================================================
-- Run this in Supabase SQL Editor to see current RSS feeds
-- Replace 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56' with your show_id

-- ===========================================
-- PART 1: List All Enabled Feeds
-- ===========================================
SELECT 
  id,
  name, 
  url, 
  COALESCE(source_type, 'rss') as source_type,
  enabled, 
  item_limit,
  dna_topics,
  category,
  last_fetch_count,
  updated_at,
  created_at
FROM signal_sources 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'
  AND enabled = true
ORDER BY 
  CASE COALESCE(source_type, 'rss')
    WHEN 'rss' THEN 1
    WHEN 'reddit' THEN 2
    WHEN 'wikipedia' THEN 3
    ELSE 4
  END,
  name;

-- ===========================================
-- PART 2: Count by Source Type
-- ===========================================
SELECT 
  COALESCE(source_type, 'rss') as source_type,
  COUNT(*) as feed_count,
  SUM(CASE WHEN enabled THEN 1 ELSE 0 END) as enabled_count,
  SUM(item_limit) as total_item_limit
FROM signal_sources 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'
GROUP BY COALESCE(source_type, 'rss')
ORDER BY feed_count DESC;

-- ===========================================
-- PART 3: Check Feed Quality
-- ===========================================
-- Identify Google News feeds (may be low quality)
SELECT 
  name,
  url,
  CASE 
    WHEN url LIKE '%news.google.com%' THEN 'Google News (aggregator)'
    WHEN url LIKE '%bloomberg.com%' THEN 'Bloomberg (high quality)'
    WHEN url LIKE '%reuters.com%' THEN 'Reuters (high quality)'
    WHEN url LIKE '%aljazeera.com%' OR url LIKE '%aljazeera.net%' THEN 'Al Jazeera (high quality)'
    WHEN url LIKE '%ft.com%' THEN 'Financial Times (high quality)'
    WHEN url LIKE '%economist.com%' THEN 'The Economist (high quality)'
    WHEN url LIKE '%reddit.com%' THEN 'Reddit'
    WHEN url LIKE '%wikipedia.org%' THEN 'Wikipedia'
    ELSE 'Other'
  END as feed_quality,
  enabled,
  item_limit
FROM signal_sources 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'
  AND enabled = true
ORDER BY 
  CASE 
    WHEN url LIKE '%news.google.com%' THEN 3
    WHEN url LIKE '%reddit.com%' THEN 2
    WHEN url LIKE '%wikipedia.org%' THEN 2
    ELSE 1
  END,
  name;

-- ===========================================
-- PART 4: Check DNA Topics per Feed
-- ===========================================
SELECT 
  name,
  dna_topics,
  CASE 
    WHEN dna_topics IS NULL OR dna_topics = '[]'::jsonb THEN 'No DNA topics'
    WHEN jsonb_array_length(dna_topics) = 0 THEN 'Empty DNA topics'
    ELSE jsonb_array_length(dna_topics)::text || ' topics'
  END as dna_status
FROM signal_sources 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'
  AND enabled = true
ORDER BY name;

-- ===========================================
-- PART 5: Recent Fetch Activity
-- ===========================================
SELECT 
  name,
  last_fetch_count,
  updated_at,
  CASE 
    WHEN updated_at IS NULL THEN 'Never fetched'
    WHEN updated_at > NOW() - INTERVAL '1 day' THEN 'Fetched today'
    WHEN updated_at > NOW() - INTERVAL '7 days' THEN 'Fetched this week'
    WHEN updated_at > NOW() - INTERVAL '30 days' THEN 'Fetched this month'
    ELSE 'Fetched >30 days ago'
  END as fetch_status
FROM signal_sources 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'
  AND enabled = true
ORDER BY updated_at DESC NULLS LAST;
