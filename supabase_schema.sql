-- Supabase schema for Channel Brain Dashboard
-- Run this SQL in your Supabase SQL editor to create the necessary tables

-- Shows table (channels/shows)
CREATE TABLE IF NOT EXISTS shows (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  channel_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Signals table (top signals with scores)
CREATE TABLE IF NOT EXISTS signals (
  id BIGSERIAL PRIMARY KEY,
  show_id BIGINT REFERENCES shows(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  source TEXT,
  score DECIMAL(3,1) NOT NULL CHECK (score >= 0 AND score <= 10),
  hook_potential DECIMAL(3,1) CHECK (hook_potential >= 0 AND hook_potential <= 10),
  type TEXT NOT NULL,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'approved')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance history table (for charts)
CREATE TABLE IF NOT EXISTS performance_history (
  id BIGSERIAL PRIMARY KEY,
  show_id BIGINT REFERENCES shows(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  views INTEGER DEFAULT 0,
  videos_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(show_id, date)
);

-- Signal sources table (RSS feeds to monitor)
CREATE TABLE IF NOT EXISTS signal_sources (
  id BIGSERIAL PRIMARY KEY,
  show_id BIGINT REFERENCES shows(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  item_limit INTEGER DEFAULT 20,
  dna_topics JSONB, -- Array of topic IDs that match this show's DNA
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for signal_sources
CREATE INDEX IF NOT EXISTS idx_signal_sources_show_id ON signal_sources(show_id);
CREATE INDEX IF NOT EXISTS idx_signal_sources_enabled ON signal_sources(enabled);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_signals_show_id ON signals(show_id);
CREATE INDEX IF NOT EXISTS idx_signals_score ON signals(score DESC);
CREATE INDEX IF NOT EXISTS idx_performance_show_id ON performance_history(show_id);
CREATE INDEX IF NOT EXISTS idx_performance_date ON performance_history(date);

-- Enable Row Level Security (RLS) - adjust policies as needed
ALTER TABLE shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_history ENABLE ROW LEVEL SECURITY;

-- Example RLS policies (allow all reads for now - customize based on your auth needs)
CREATE POLICY "Allow all reads on shows" ON shows FOR SELECT USING (true);
CREATE POLICY "Allow all reads on signals" ON signals FOR SELECT USING (true);
CREATE POLICY "Allow all reads on performance_history" ON performance_history FOR SELECT USING (true);
CREATE POLICY "Allow all reads on signal_sources" ON signal_sources FOR SELECT USING (true);

-- Sample data (optional - remove if you have real data)
INSERT INTO shows (name, channel_id) VALUES 
  ('Show 1', 'channel1'),
  ('Show 2', 'channel2')
ON CONFLICT (channel_id) DO NOTHING;

