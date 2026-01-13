-- Migration: Add is_active, expired_at to signals, create learning profile table, and enhance clusters
-- Run this in your Supabase SQL editor

-- 1. Add is_active and status columns to signals if not exists
ALTER TABLE signals 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ;

-- Update status check to include 'expired'
ALTER TABLE signals DROP CONSTRAINT IF EXISTS signals_status_check;
ALTER TABLE signals ADD CONSTRAINT signals_status_check 
CHECK (status IN ('new', 'liked', 'rejected', 'saved', 'produced', 'expired'));

-- 2. Create learning profile table
CREATE TABLE IF NOT EXISTS show_learning_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id UUID REFERENCES shows(id) ON DELETE CASCADE,
  topic_weights JSONB DEFAULT '{}',
  topic_stats JSONB DEFAULT '{}',
  format_preferences JSONB DEFAULT '{}',
  source_preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(show_id)
);

-- 3. Add health score to clusters
ALTER TABLE topic_clusters
ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'stale', 'archived'));

-- 4. Create index for faster active signal queries
CREATE INDEX IF NOT EXISTS idx_signals_active 
ON signals(show_id, is_active, status) 
WHERE is_active = true;

-- 5. Create index for learning profile lookups
CREATE INDEX IF NOT EXISTS idx_learning_profile_show 
ON show_learning_profile(show_id);

-- Verify the changes
SELECT 
  column_name, 
  data_type, 
  column_default
FROM information_schema.columns
WHERE table_name = 'signals' 
  AND column_name IN ('is_active', 'expired_at')
ORDER BY column_name;

SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'show_learning_profile'
ORDER BY ordinal_position;

SELECT 
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'topic_clusters'
  AND column_name IN ('health_score', 'status')
ORDER BY column_name;



