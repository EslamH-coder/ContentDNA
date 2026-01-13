-- Add description column to competitor_videos table
-- This allows keyword matching on video descriptions for better accuracy

ALTER TABLE competitor_videos 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add comment for documentation
COMMENT ON COLUMN competitor_videos.description IS 'Video description from YouTube (truncated to 500 chars for storage)';

-- Optional: Add index for full-text search (can be useful for keyword matching)
-- CREATE INDEX IF NOT EXISTS idx_competitor_videos_description_search 
-- ON competitor_videos USING gin(to_tsvector('english', description));
