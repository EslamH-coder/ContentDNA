-- ============================================================
-- Create Table for Learned Feedback Patterns
-- ============================================================
-- Run this in Supabase SQL Editor
-- 
-- This table stores patterns learned from user feedback (like/reject)
-- to automatically boost or penalize similar signals in the future.

-- ===========================================
-- Table: signal_feedback_patterns
-- ===========================================
CREATE TABLE IF NOT EXISTS signal_feedback_patterns (
  id text PRIMARY KEY, -- Composite key hash: showId-countries-topics-patterns
  show_id uuid NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  pattern_type text NOT NULL CHECK (pattern_type IN ('positive', 'negative')),
  
  -- Extracted entities from signals
  countries jsonb DEFAULT '[]'::jsonb, -- e.g., ['iran', 'china']
  topics jsonb DEFAULT '[]'::jsonb,    -- e.g., ['politics', 'oil']
  title_patterns jsonb DEFAULT '[]'::jsonb, -- e.g., ['signs agreement', 'found news']
  
  -- Source information
  source text,
  
  -- Scoring adjustments
  score_boost integer DEFAULT 0,      -- Points to add for positive patterns
  score_penalty integer DEFAULT 0,     -- Points to subtract for negative patterns
  
  -- Metadata
  match_count integer DEFAULT 1,       -- How many times this pattern was seen
  last_signal_title text,              -- Last signal that matched this pattern
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ===========================================
-- Indexes
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_signal_feedback_patterns_show 
  ON signal_feedback_patterns(show_id);

CREATE INDEX IF NOT EXISTS idx_signal_feedback_patterns_type 
  ON signal_feedback_patterns(pattern_type);

CREATE INDEX IF NOT EXISTS idx_signal_feedback_patterns_updated 
  ON signal_feedback_patterns(updated_at DESC);

-- Index for country matching (GIN index for jsonb)
CREATE INDEX IF NOT EXISTS idx_signal_feedback_patterns_countries 
  ON signal_feedback_patterns USING GIN (countries);

-- Index for topic matching (GIN index for jsonb)
CREATE INDEX IF NOT EXISTS idx_signal_feedback_patterns_topics 
  ON signal_feedback_patterns USING GIN (topics);

-- Index for title pattern matching (GIN index for jsonb)
CREATE INDEX IF NOT EXISTS idx_signal_feedback_patterns_title_patterns 
  ON signal_feedback_patterns USING GIN (title_patterns);

-- ===========================================
-- Function: Update updated_at timestamp
-- ===========================================
CREATE OR REPLACE FUNCTION update_signal_feedback_patterns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- Trigger: Auto-update updated_at
-- ===========================================
DROP TRIGGER IF EXISTS trigger_update_signal_feedback_patterns_updated_at ON signal_feedback_patterns;
CREATE TRIGGER trigger_update_signal_feedback_patterns_updated_at
  BEFORE UPDATE ON signal_feedback_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_signal_feedback_patterns_updated_at();

-- ===========================================
-- Example Queries
-- ===========================================

-- View all positive patterns for a show
-- SELECT * FROM signal_feedback_patterns 
-- WHERE show_id = 'your-show-id' AND pattern_type = 'positive'
-- ORDER BY match_count DESC;

-- View all negative patterns for a show
-- SELECT * FROM signal_feedback_patterns 
-- WHERE show_id = 'your-show-id' AND pattern_type = 'negative'
-- ORDER BY match_count DESC;

-- Find patterns matching a country
-- SELECT * FROM signal_feedback_patterns 
-- WHERE show_id = 'your-show-id' 
--   AND countries @> '["iran"]'::jsonb;

-- Find patterns matching a title pattern
-- SELECT * FROM signal_feedback_patterns 
-- WHERE show_id = 'your-show-id' 
--   AND title_patterns @> '["signs agreement"]'::jsonb;
