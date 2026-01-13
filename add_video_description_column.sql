-- Add description column to audience_videos table
-- This allows better context matching for videos

ALTER TABLE audience_videos 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add index for faster text searches
CREATE INDEX IF NOT EXISTS idx_audience_videos_description 
ON audience_videos USING gin(to_tsvector('arabic', description));

-- Mark irrelevant الدحيح videos (entertainment, not economic)
UPDATE audience_videos 
SET is_relevant = false,
    category = 'entertainment'
WHERE title LIKE '%الدحيح%'
  AND title NOT LIKE '%اقتصاد%'
  AND title NOT LIKE '%بوتين%'
  AND title NOT LIKE '%حرب%'
  AND title NOT LIKE '%روسيا%'
  AND title NOT LIKE '%صين%'
  AND title NOT LIKE '%أمريكا%'
  AND title NOT LIKE '%ترامب%'
  AND title NOT LIKE '%بغداد%'
  AND title NOT LIKE '%تاريخ%'
  AND title NOT LIKE '%جيوسياسة%'
  AND title NOT LIKE '%عقوبات%'
  AND title NOT LIKE '%نفط%'
  AND title NOT LIKE '%تجارة%';

-- Keep relevant الدحيح videos (geopolitics, history, economics)
UPDATE audience_videos 
SET is_relevant = true,
    category = 'geopolitics'
WHERE title LIKE '%بوتين%' 
  AND title LIKE '%الدحيح%';

UPDATE audience_videos 
SET is_relevant = true,
    category = 'history'
WHERE title LIKE '%بغداد%' 
  AND title LIKE '%الدحيح%';

UPDATE audience_videos 
SET is_relevant = true,
    category = 'geopolitics'
WHERE title LIKE '%روسيا%' 
  AND title LIKE '%الدحيح%';

UPDATE audience_videos 
SET is_relevant = true,
    category = 'geopolitics'
WHERE title LIKE '%حرب%' 
  AND title LIKE '%الدحيح%'
  AND (title LIKE '%أوكرانيا%' OR title LIKE '%روسيا%' OR title LIKE '%أمريكا%');

-- Mark other clearly non-economic videos
UPDATE audience_videos 
SET is_relevant = false,
    category = 'entertainment'
WHERE (
  title LIKE '%الشباب والجمال%'
  OR title LIKE '%جمال%' AND title LIKE '%جراحة%'
  OR title LIKE '%رياضة%'
  OR title LIKE '%كرة قدم%'
  OR title LIKE '%موسيقى%'
  OR title LIKE '%أغاني%'
  OR title LIKE '%فن%' AND title NOT LIKE '%اقتصاد%'
  OR title LIKE '%ترفيه%'
  OR title LIKE '%كوميديا%'
  OR title LIKE '%مشاهير%' AND title NOT LIKE '%ملياردير%'
);

-- Verify changes
SELECT 
  category,
  COUNT(*) as count,
  SUM(CASE WHEN is_relevant THEN 1 ELSE 0 END) as relevant_count
FROM audience_videos
GROUP BY category
ORDER BY count DESC;




