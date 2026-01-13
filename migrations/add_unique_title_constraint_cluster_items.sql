-- Migration: Add unique constraint on cluster_id + title for cluster_items
-- Date: 2024
-- Description: Prevents same title appearing twice in the same cluster

-- Add unique index on cluster_id + title (case-insensitive comparison)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cluster_items_unique_title 
ON cluster_items (cluster_id, LOWER(TRIM(title)));

-- Add comment
COMMENT ON INDEX idx_cluster_items_unique_title IS 'Prevents duplicate titles in the same cluster (case-insensitive)';



