-- ============================================================
-- Create Tables for Importing JSON Data to Supabase
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Search Terms Table
CREATE TABLE IF NOT EXISTS search_terms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  views BIGINT DEFAULT 0,
  watch_time_hours NUMERIC(12, 4) DEFAULT 0,
  avg_view_duration TEXT,
  topic TEXT,
  intent TEXT,
  personas JSONB DEFAULT '[]'::jsonb,
  is_branded BOOLEAN DEFAULT false,
  is_opportunity BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(show_id, term)
);

CREATE INDEX IF NOT EXISTS idx_search_terms_show_id ON search_terms(show_id);
CREATE INDEX IF NOT EXISTS idx_search_terms_views ON search_terms(views DESC);
CREATE INDEX IF NOT EXISTS idx_search_terms_is_branded ON search_terms(is_branded);
CREATE INDEX IF NOT EXISTS idx_search_terms_topic ON search_terms(topic);

-- 2. Audience Videos Table
CREATE TABLE IF NOT EXISTS audience_videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  platform TEXT DEFAULT 'youtube',
  upload_date TIMESTAMPTZ,
  duration INTEGER DEFAULT 0,
  creator_id TEXT,
  creator_name TEXT,
  views BIGINT DEFAULT 0,
  engagements BIGINT DEFAULT 0,
  relevance_score NUMERIC(10, 6) DEFAULT 0,
  audience_overlap NUMERIC(5, 4) DEFAULT 0,
  is_short BOOLEAN DEFAULT false,
  category TEXT,
  topic TEXT,
  personas JSONB DEFAULT '[]'::jsonb,
  is_relevant BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(show_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_audience_videos_show_id ON audience_videos(show_id);
CREATE INDEX IF NOT EXISTS idx_audience_videos_views ON audience_videos(views DESC);
CREATE INDEX IF NOT EXISTS idx_audience_videos_is_relevant ON audience_videos(is_relevant);
CREATE INDEX IF NOT EXISTS idx_audience_videos_topic ON audience_videos(topic);

-- 3. Audience Comments Table
CREATE TABLE IF NOT EXISTS audience_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  comment_id TEXT NOT NULL,
  author TEXT,
  text TEXT NOT NULL,
  likes INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  comment_date DATE,
  video_id TEXT,
  video_title TEXT,
  type TEXT,
  sentiment TEXT,
  topic TEXT,
  question TEXT,
  request TEXT,
  is_actionable BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(show_id, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_audience_comments_show_id ON audience_comments(show_id);
CREATE INDEX IF NOT EXISTS idx_audience_comments_is_actionable ON audience_comments(is_actionable);
CREATE INDEX IF NOT EXISTS idx_audience_comments_type ON audience_comments(type);
CREATE INDEX IF NOT EXISTS idx_audience_comments_topic ON audience_comments(topic);

-- Enable Row Level Security (RLS)
ALTER TABLE search_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE audience_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE audience_comments ENABLE ROW LEVEL SECURITY;

-- Create policies (allow service role to insert/read)
CREATE POLICY "Service role can manage search_terms" ON search_terms
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage audience_videos" ON audience_videos
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage audience_comments" ON audience_comments
  FOR ALL USING (auth.role() = 'service_role');

-- Add updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers
CREATE TRIGGER update_search_terms_updated_at
  BEFORE UPDATE ON search_terms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audience_videos_updated_at
  BEFORE UPDATE ON audience_videos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audience_comments_updated_at
  BEFORE UPDATE ON audience_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();




