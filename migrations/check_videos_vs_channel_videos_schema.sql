-- ============================================================
-- Videos Table vs Channel Videos Table - Schema Analysis
-- Run these queries in Supabase SQL Editor to understand the tables
-- ============================================================

-- 1. Check videos table schema
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'videos' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check channel_videos table schema
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'channel_videos' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Count videos with placeholder titles in videos table
-- Replace 'YOUR_SHOW_ID' with actual show_id
SELECT 
  COUNT(*) as total_videos,
  COUNT(CASE WHEN title = 'شعار' OR title = 'logo' THEN 1 END) as placeholder_count,
  COUNT(CASE WHEN title IS NULL OR title = '' OR title = ' ' THEN 1 END) as empty_count,
  COUNT(CASE WHEN title NOT IN ('شعار', 'logo') AND title IS NOT NULL AND title != '' AND title != ' ' THEN 1 END) as valid_count,
  ROUND(100.0 * COUNT(CASE WHEN title = 'شعار' OR title = 'logo' THEN 1 END) / NULLIF(COUNT(*), 0), 2) as placeholder_percentage
FROM videos
WHERE show_id = 'YOUR_SHOW_ID';  -- Replace with actual show_id

-- 4. Sample videos table data (first 10 rows)
SELECT 
  id,
  show_id,
  title,
  url,
  view_count,
  published_at,
  performance_classification,
  topic_id,
  created_at
FROM videos
WHERE show_id = 'YOUR_SHOW_ID'  -- Replace with actual show_id
ORDER BY created_at DESC
LIMIT 10;

-- 5. Sample channel_videos table data (first 10 rows)
SELECT 
  id,
  show_id,
  video_id,
  title,
  publish_date,
  youtube_url,
  description,
  topic_id,
  created_at
FROM channel_videos
WHERE show_id = 'YOUR_SHOW_ID'  -- Replace with actual show_id
ORDER BY publish_date DESC
LIMIT 10;

-- 6. Check for "شعار" titles in channel_videos (should be none if sync is working)
SELECT 
  COUNT(*) as total_channel_videos,
  COUNT(CASE WHEN title = 'شعار' OR title = 'logo' THEN 1 END) as placeholder_count_channel,
  COUNT(CASE WHEN title IS NULL OR title = '' THEN 1 END) as empty_count_channel,
  COUNT(CASE WHEN title NOT IN ('شعار', 'logo') AND title IS NOT NULL AND title != '' THEN 1 END) as valid_count_channel
FROM channel_videos
WHERE show_id = 'YOUR_SHOW_ID';  -- Replace with actual show_id

-- 7. Check if videos table has any valid data (non-placeholder titles)
SELECT 
  show_id,
  COUNT(*) as total,
  COUNT(CASE WHEN title != 'شعار' AND title != 'logo' AND title IS NOT NULL AND title != '' THEN 1 END) as valid_titles,
  COUNT(CASE WHEN title = 'شعار' OR title = 'logo' THEN 1 END) as placeholder_titles,
  MIN(created_at) as oldest_import,
  MAX(created_at) as latest_import
FROM videos
GROUP BY show_id
ORDER BY total DESC;

-- 8. Compare: videos vs channel_videos for same show_id
-- Replace 'YOUR_SHOW_ID' with actual show_id
SELECT 
  'videos' as table_name,
  COUNT(*) as total_rows,
  COUNT(CASE WHEN title = 'شعار' OR title = 'logo' THEN 1 END) as placeholder_titles,
  COUNT(CASE WHEN title IS NOT NULL AND title != '' AND title != 'شعار' AND title != 'logo' THEN 1 END) as valid_titles,
  MIN(created_at) as oldest_record,
  MAX(created_at) as latest_record
FROM videos
WHERE show_id = 'YOUR_SHOW_ID'  -- Replace with actual show_id

UNION ALL

SELECT 
  'channel_videos' as table_name,
  COUNT(*) as total_rows,
  COUNT(CASE WHEN title = 'شعار' OR title = 'logo' THEN 1 END) as placeholder_titles,
  COUNT(CASE WHEN title IS NOT NULL AND title != '' AND title != 'شعار' AND title != 'logo' THEN 1 END) as valid_titles,
  MIN(created_at) as oldest_record,
  MAX(created_at) as latest_record
FROM channel_videos
WHERE show_id = 'YOUR_SHOW_ID';  -- Replace with actual show_id

-- 9. Check date column names
SELECT 
  'videos' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'videos' 
  AND column_name LIKE '%publish%' OR column_name LIKE '%date%'
  
UNION ALL

SELECT 
  'channel_videos' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'channel_videos'
  AND (column_name LIKE '%publish%' OR column_name LIKE '%date%')
  
ORDER BY table_name, column_name;

-- 10. Find all shows that have data in videos table
SELECT DISTINCT show_id, COUNT(*) as video_count
FROM videos
GROUP BY show_id
ORDER BY video_count DESC;

-- 11. Find all shows that have data in channel_videos table
SELECT DISTINCT show_id, COUNT(*) as video_count
FROM channel_videos
GROUP BY show_id
ORDER BY video_count DESC;
