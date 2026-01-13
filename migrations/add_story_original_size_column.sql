-- Add story_original_size column to signals table
-- This stores the original detected count before filtering (for transparency)

ALTER TABLE signals ADD COLUMN IF NOT EXISTS story_original_size INTEGER;

-- Add comment for clarity
COMMENT ON COLUMN signals.story_original_size IS 'Original detected count of signals in this story before filtering (story_size shows actual saved count)';


