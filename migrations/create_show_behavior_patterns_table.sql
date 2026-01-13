-- Create table to cache learned behavior patterns
CREATE TABLE IF NOT EXISTS show_behavior_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id UUID REFERENCES shows(id) ON DELETE CASCADE,
  patterns JSONB DEFAULT '{}',
  learned_at TIMESTAMPTZ DEFAULT NOW(),
  video_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  competitor_video_count INTEGER DEFAULT 0,
  UNIQUE(show_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_show_behavior_patterns_show_id ON show_behavior_patterns(show_id);

-- RLS
ALTER TABLE show_behavior_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to behavior patterns"
ON show_behavior_patterns FOR ALL
TO authenticated, anon
USING (true);


