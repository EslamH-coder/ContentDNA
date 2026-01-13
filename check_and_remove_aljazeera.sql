-- Step 1: Check what RSS sources you currently have
SELECT id, name, url, enabled, show_id 
FROM signal_sources 
WHERE show_id = '00000000-0000-0000-0000-000000000004'
ORDER BY name;

-- Step 2: Remove Al Jazeera (run this after checking)
DELETE FROM signal_sources 
WHERE (url LIKE '%aljazeera%' OR name LIKE '%Al Jazeera%' OR name LIKE '%aljazeera%')
  AND show_id = '00000000-0000-0000-0000-000000000004';

-- Step 3: Verify it's removed
SELECT id, name, url, enabled 
FROM signal_sources 
WHERE show_id = '00000000-0000-0000-0000-000000000004'
ORDER BY name;

