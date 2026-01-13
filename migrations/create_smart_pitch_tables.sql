-- ============================================================
-- Smart Pitch System - Database Schema
-- Creates tables for pattern analysis and pitch generation
-- ============================================================

-- 1. Store analyzed winning patterns per show
CREATE TABLE IF NOT EXISTS show_winning_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id UUID REFERENCES shows(id) ON DELETE CASCADE,
  
  -- Pattern identification
  pattern_id TEXT NOT NULL,
  pattern_name TEXT NOT NULL,
  pattern_name_ar TEXT,
  
  -- Pattern formula
  formula TEXT, -- "Trending topic + contrarian economic angle"
  formula_ar TEXT,
  
  -- Pattern type
  content_type TEXT, -- 'long_form', 'short_form', 'both'
  short_form_subtype TEXT, -- 'micro', 'mini_explainer', 'short_story' (for shorts)
  
  -- Keywords/triggers that identify this pattern
  trigger_keywords TEXT[], -- ['لماذا', 'لعنة', 'خطأ', 'سر']
  trigger_entities JSONB, -- {topics: ['oil', 'trade'], countries: ['USA']}
  
  -- Performance metrics
  video_count INTEGER DEFAULT 0,
  total_views BIGINT DEFAULT 0,
  avg_views BIGINT DEFAULT 0,
  success_rate DECIMAL(3,2), -- 0.85 = 85% above average
  avg_duration INTEGER, -- seconds for shorts, minutes for long
  
  -- Example videos that match this pattern
  example_video_ids UUID[],
  example_titles TEXT[],
  
  -- Learning weights
  confidence DECIMAL(3,2) DEFAULT 0.5,
  weight DECIMAL(3,2) DEFAULT 1.0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_analyzed_at TIMESTAMPTZ,
  
  UNIQUE(show_id, pattern_id)
);

-- 2. Track generated pitches and their outcomes
CREATE TABLE IF NOT EXISTS pitch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id UUID REFERENCES shows(id) ON DELETE CASCADE,
  
  -- Source signal
  signal_id UUID,
  signal_title TEXT,
  
  -- Generated pitch
  pitch_title TEXT NOT NULL,
  pitch_title_ar TEXT,
  pitch_angle TEXT,
  pitch_reasoning TEXT,
  
  -- Classification
  urgency TEXT, -- 'post_today', 'this_week', 'evergreen'
  content_type TEXT, -- 'long_form', 'short_form'
  short_form_subtype TEXT, -- 'micro', 'mini_explainer', 'short_story'
  
  -- Pattern used
  pattern_id TEXT,
  pattern_name TEXT,
  
  -- Prediction
  predicted_views BIGINT,
  prediction_confidence DECIMAL(3,2),
  similar_video_id UUID,
  similar_video_title TEXT,
  similar_video_views BIGINT,
  
  -- Outcome tracking
  status TEXT DEFAULT 'suggested', -- 'suggested', 'saved', 'rejected', 'produced', 'published'
  produced_video_id UUID,
  actual_views BIGINT,
  performance_ratio DECIMAL(4,2), -- actual/predicted
  
  -- User feedback
  user_feedback TEXT, -- 'liked', 'rejected', 'saved'
  feedback_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  produced_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  
  -- Fingerprint for matching
  fingerprint_id UUID
);

-- 3. Store pitch templates (reusable formulas)
CREATE TABLE IF NOT EXISTS pitch_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Template identification
  template_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_ar TEXT,
  description TEXT,
  
  -- Template formula
  formula TEXT NOT NULL, -- "Why [TOPIC] is actually bad for [COUNTRY]"
  formula_ar TEXT,
  
  -- Placeholders
  placeholders JSONB, -- ["TOPIC", "COUNTRY", "PERSON"]
  
  -- Applicable categories
  applicable_categories TEXT[], -- ['us_china_trade', 'energy']
  
  -- Content type
  content_type TEXT, -- 'long_form', 'short_form', 'both'
  
  -- Example outputs
  examples JSONB, -- [{input: {...}, output: "..."}, ...]
  
  -- Global or show-specific
  is_global BOOLEAN DEFAULT true,
  show_id UUID, -- NULL for global templates
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_winning_patterns_show ON show_winning_patterns(show_id);
CREATE INDEX IF NOT EXISTS idx_winning_patterns_type ON show_winning_patterns(content_type);
CREATE INDEX IF NOT EXISTS idx_pitch_history_show ON pitch_history(show_id);
CREATE INDEX IF NOT EXISTS idx_pitch_history_status ON pitch_history(status);
CREATE INDEX IF NOT EXISTS idx_pitch_history_pattern ON pitch_history(pattern_id);
CREATE INDEX IF NOT EXISTS idx_pitch_history_signal ON pitch_history(signal_id);
CREATE INDEX IF NOT EXISTS idx_pitch_templates_type ON pitch_templates(content_type);

-- RLS Policies
ALTER TABLE show_winning_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE pitch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE pitch_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to winning_patterns" ON show_winning_patterns FOR ALL TO authenticated, anon USING (true);
CREATE POLICY "Allow all access to pitch_history" ON pitch_history FOR ALL TO authenticated, anon USING (true);
CREATE POLICY "Allow all access to pitch_templates" ON pitch_templates FOR ALL TO authenticated, anon USING (true);

-- Update channel_videos table (if needed)
ALTER TABLE channel_videos 
ADD COLUMN IF NOT EXISTS format TEXT DEFAULT 'Long', -- 'Long', 'Short'
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
ADD COLUMN IF NOT EXISTS short_form_type TEXT, -- 'micro', 'mini_explainer', 'short_story'
ADD COLUMN IF NOT EXISTS matched_patterns TEXT[],
ADD COLUMN IF NOT EXISTS primary_pattern TEXT;
