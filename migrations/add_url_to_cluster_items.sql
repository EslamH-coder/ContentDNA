-- Migration: Add URL column to cluster_items and populate from signals
-- Date: 2024
-- Description: Adds URL column to cluster_items and populates it from signals table

-- Add url column if missing
ALTER TABLE cluster_items ADD COLUMN IF NOT EXISTS url TEXT;

-- Update cluster_items with URLs from signals
UPDATE cluster_items ci
SET url = s.url
FROM signals s
WHERE ci.signal_id = s.id AND ci.url IS NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_cluster_items_url ON cluster_items(url) WHERE url IS NOT NULL;



