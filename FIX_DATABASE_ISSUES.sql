-- ============================================================
-- FIX DATABASE ISSUES FOR STUDIO PITCHES
-- Run these queries in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- ISSUE 1: Check DNA Topics Structure
-- ============================================================
-- First, check what's currently in show_dna:
SELECT 
  id, 
  show_id, 
  topics, 
  pg_typeof(topics) as topics_type,
  jsonb_typeof(topics) as jsonb_type
FROM show_dna 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';

-- If topics is empty object {} or null, fix it:
UPDATE show_dna 
SET topics = '["energy_oil_gas_lng", "geopolitics", "us_china_relations", "middle_east", "global_economy", "currency_devaluation", "inflation_prices"]'::jsonb
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';

-- Verify the update:
SELECT topics FROM show_dna WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';

-- ============================================================
-- ISSUE 2: Check Competitor Videos Table Structure
-- ============================================================
-- Check what columns exist:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'competitor_videos'
ORDER BY ordinal_position;

-- Check if there's any data:
SELECT COUNT(*) as total_videos
FROM competitor_videos 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';

-- Check sample data:
SELECT 
  id, 
  title, 
  views, 
  youtube_video_id, 
  video_id,  -- Check if this column exists
  published_at, 
  url, 
  competitor_id
FROM competitor_videos 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'
LIMIT 5;

-- ============================================================
-- OPTIONAL: If competitor_videos table is empty, check competitors table
-- ============================================================
SELECT COUNT(*) as total_competitors
FROM competitors 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';

-- ============================================================
-- DIAGNOSTIC: Check RSS Sources
-- ============================================================
SELECT 
  id,
  name,
  url,
  enabled,
  source_type,
  item_limit
FROM signal_sources
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'
ORDER BY enabled DESC, name;

-- Check if expected sources are enabled:
SELECT 
  name,
  enabled,
  CASE 
    WHEN name ILIKE '%al jazeera%' OR name ILIKE '%الجزيرة%' THEN 'Al Jazeera'
    WHEN name ILIKE '%reuters%' OR name ILIKE '%رويترز%' THEN 'Reuters'
    WHEN name ILIKE '%bloomberg%' THEN 'Bloomberg'
    ELSE 'Other'
  END as source_category
FROM signal_sources
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'
ORDER BY enabled DESC, source_category;
