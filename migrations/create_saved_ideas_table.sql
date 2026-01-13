-- Create saved_ideas table
CREATE TABLE IF NOT EXISTS saved_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id UUID REFERENCES shows(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  pitch TEXT,
  format TEXT DEFAULT 'long', -- 'long' or 'short'
  source_type TEXT, -- 'signal', 'cluster', 'event', 'manual'
  source_id TEXT,
  status TEXT DEFAULT 'new', -- 'new', 'researching', 'approved', 'rejected', 'produced'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index
CREATE INDEX idx_saved_ideas_show ON saved_ideas(show_id);

-- Add status column to signals if not exists
ALTER TABLE signals ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new';
ALTER TABLE signals ADD COLUMN IF NOT EXISTS hook_potential NUMERIC;
ALTER TABLE signals ADD COLUMN IF NOT EXISTS suggested_duration TEXT;
ALTER TABLE signals ADD COLUMN IF NOT EXISTS matched_topic TEXT;



