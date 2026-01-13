-- Create videos table for storing video performance data

CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  show_id UUID REFERENCES shows(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  view_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  duration_seconds INTEGER,
  format TEXT CHECK (format IN ('long_form', 'short_form')) DEFAULT 'long_form',
  published_at TIMESTAMP WITH TIME ZONE NOT NULL,
  age_days INTEGER,
  performance_classification TEXT CHECK (performance_classification IN ('over_performing', 'average', 'under_performing', 'unknown')) DEFAULT 'unknown',
  ratio_vs_median DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_videos_show_id ON videos(show_id);
CREATE INDEX IF NOT EXISTS idx_videos_format ON videos(format);
CREATE INDEX IF NOT EXISTS idx_videos_performance ON videos(performance_classification);
CREATE INDEX IF NOT EXISTS idx_videos_published_at ON videos(published_at DESC);

-- Enable RLS
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Allow all reads on videos" ON videos;
CREATE POLICY "Allow all reads on videos" 
ON videos 
FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Allow all inserts on videos" ON videos;
CREATE POLICY "Allow all inserts on videos" 
ON videos 
FOR INSERT 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all updates on videos" ON videos;
CREATE POLICY "Allow all updates on videos" 
ON videos 
FOR UPDATE 
USING (true);

