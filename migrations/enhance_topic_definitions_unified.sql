-- ============================================================
-- Enhance topic_definitions for Unified Taxonomy System
-- ============================================================
-- Run this in Supabase SQL Editor
-- 
-- This migration adds columns to topic_definitions to support:
-- - Auto-learned keywords
-- - Performance tracking
-- - Learning statistics
-- - Match tracking

-- ===========================================
-- Add Columns
-- ===========================================
ALTER TABLE topic_definitions 
ADD COLUMN IF NOT EXISTS learned_keywords jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS keyword_sources jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS performance_stats jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS liked_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS rejected_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS produced_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_score float DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_matched_at timestamptz,
ADD COLUMN IF NOT EXISTS match_count integer DEFAULT 0;

-- ===========================================
-- Add Comments for Documentation
-- ===========================================
COMMENT ON COLUMN topic_definitions.learned_keywords IS 'Keywords auto-learned from user feedback';
COMMENT ON COLUMN topic_definitions.keyword_sources IS 'Source of each keyword: {keyword: "manual"|"learned"|"ai"}';
COMMENT ON COLUMN topic_definitions.performance_stats IS 'Performance metrics: {totalViews, totalEngagement, videoCount, avgViews, lastUpdated}';
COMMENT ON COLUMN topic_definitions.liked_count IS 'Count of liked signals matching this topic';
COMMENT ON COLUMN topic_definitions.rejected_count IS 'Count of rejected signals matching this topic';
COMMENT ON COLUMN topic_definitions.produced_count IS 'Count of produced content from this topic';
COMMENT ON COLUMN topic_definitions.avg_score IS 'Average score of signals matching this topic';
COMMENT ON COLUMN topic_definitions.last_matched_at IS 'Timestamp of last signal match';
COMMENT ON COLUMN topic_definitions.match_count IS 'Total number of signals matched to this topic';

-- ===========================================
-- Create Indexes for Performance
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_topic_definitions_show_active 
ON topic_definitions(show_id, is_active);

CREATE INDEX IF NOT EXISTS idx_topic_definitions_topic_id 
ON topic_definitions(topic_id);

CREATE INDEX IF NOT EXISTS idx_topic_definitions_match_count 
ON topic_definitions(match_count DESC);

CREATE INDEX IF NOT EXISTS idx_topic_definitions_last_matched 
ON topic_definitions(last_matched_at DESC);

-- ===========================================
-- SQL Functions
-- ===========================================

-- Function to increment topic match count
CREATE OR REPLACE FUNCTION increment_topic_match_count(
  p_show_id uuid,
  p_topic_id text
)
RETURNS void AS $$
BEGIN
  UPDATE topic_definitions
  SET 
    match_count = COALESCE(match_count, 0) + 1,
    last_matched_at = NOW()
  WHERE show_id = p_show_id AND topic_id = p_topic_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get topic performance
CREATE OR REPLACE FUNCTION get_topic_performance(p_show_id uuid)
RETURNS TABLE (
  topic_id text,
  topic_name text,
  match_count integer,
  liked_count integer,
  rejected_count integer,
  produced_count integer,
  success_rate float
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    td.topic_id,
    td.topic_name_en as topic_name,
    COALESCE(td.match_count, 0)::integer,
    COALESCE(td.liked_count, 0)::integer,
    COALESCE(td.rejected_count, 0)::integer,
    COALESCE(td.produced_count, 0)::integer,
    CASE 
      WHEN COALESCE(td.match_count, 0) > 0 
      THEN (COALESCE(td.liked_count, 0) + COALESCE(td.produced_count, 0))::float / td.match_count * 100
      ELSE 0
    END as success_rate
  FROM topic_definitions td
  WHERE td.show_id = p_show_id AND td.is_active = true
  ORDER BY td.match_count DESC;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- Verify Migration
-- ===========================================
-- Run this to verify columns were added:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'topic_definitions'
-- ORDER BY ordinal_position;
