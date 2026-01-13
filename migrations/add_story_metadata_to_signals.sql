-- Add story metadata columns to signals table for story-level deduplication
-- This allows tracking which signals belong to the same story cluster

ALTER TABLE signals 
ADD COLUMN IF NOT EXISTS story_id TEXT,
ADD COLUMN IF NOT EXISTS story_rank INTEGER,
ADD COLUMN IF NOT EXISTS story_size INTEGER;

-- Index for querying signals by story
CREATE INDEX IF NOT EXISTS idx_signals_story ON signals(story_id) WHERE story_id IS NOT NULL;

-- Index for querying story clusters (signals with same story_id)
CREATE INDEX IF NOT EXISTS idx_signals_story_rank ON signals(story_id, story_rank) WHERE story_id IS NOT NULL;

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'signals' 
AND column_name IN ('story_id', 'story_rank', 'story_size');


