-- Check channel_videos table for "شعار" titles
-- Run this in Supabase SQL Editor to diagnose the issue

-- 1. Check if titles are actually "شعار" in the database
SELECT 
  id, 
  video_id, 
  title, 
  title_ar,
  thumbnail_title,
  thumbnail_elements,
  description,
  published_at,
  youtube_url,
  created_at,
  updated_at
FROM channel_videos 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'
ORDER BY published_at DESC
LIMIT 10;

-- 2. Count how many videos have "شعار" as title
SELECT 
  COUNT(*) as total_videos,
  COUNT(CASE WHEN title = 'شعار' THEN 1 END) as logo_titles,
  COUNT(CASE WHEN title = 'logo' THEN 1 END) as logo_english_titles,
  COUNT(CASE WHEN title IS NULL OR title = '' THEN 1 END) as empty_titles,
  COUNT(CASE WHEN title IS NOT NULL AND title != '' AND title != 'شعار' AND title != 'logo' THEN 1 END) as valid_titles
FROM channel_videos 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';

-- 3. Check if thumbnail_title is different from title (would indicate a mix-up)
SELECT 
  id,
  video_id,
  title,
  thumbnail_title,
  CASE 
    WHEN title = 'شعار' AND thumbnail_title IS NOT NULL AND thumbnail_title != 'شعار' THEN 'TITLE_WRONG_THUMBNAIL_HAS_REAL'
    WHEN title = 'شعار' AND thumbnail_title = 'شعار' THEN 'BOTH_LOGO'
    WHEN title != 'شعار' THEN 'TITLE_OK'
    ELSE 'OTHER'
  END as status
FROM channel_videos 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'
ORDER BY published_at DESC
LIMIT 20;

-- 4. Check when videos were last updated (might indicate when bug happened)
SELECT 
  COUNT(*) as count,
  DATE_TRUNC('day', updated_at) as update_day,
  MIN(updated_at) as first_update,
  MAX(updated_at) as last_update
FROM channel_videos 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'
GROUP BY DATE_TRUNC('day', updated_at)
ORDER BY update_day DESC
LIMIT 10;

-- 5. Check if there's a pattern - do videos with "شعار" have thumbnail_elements containing "شعار"?
SELECT 
  id,
  video_id,
  title,
  thumbnail_elements,
  CASE 
    WHEN title = 'شعار' AND thumbnail_elements::text LIKE '%شعار%' THEN 'TITLE_AND_ELEMENTS_MATCH_LOGO'
    WHEN title = 'شعار' AND (thumbnail_elements::text NOT LIKE '%شعار%' OR thumbnail_elements IS NULL) THEN 'TITLE_LOGO_BUT_ELEMENTS_DIFFERENT'
    ELSE 'NORMAL'
  END as pattern
FROM channel_videos 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'
ORDER BY published_at DESC
LIMIT 20;
