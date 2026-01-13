-- Create pitches table for caching generated pitches
-- This saves tokens by avoiding regeneration of existing pitches

CREATE TABLE IF NOT EXISTS pitches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  signal_id UUID REFERENCES signals(id) ON DELETE CASCADE,
  show_id UUID REFERENCES shows(id) ON DELETE CASCADE,
  pitch_type TEXT NOT NULL DEFAULT 'news',
  content TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique index to ensure one pitch per signal
CREATE UNIQUE INDEX IF NOT EXISTS idx_pitches_signal_unique ON pitches(signal_id);

-- Create index for faster lookups by show
CREATE INDEX IF NOT EXISTS idx_pitches_show_id ON pitches(show_id);

-- Create index for filtering by pitch type
CREATE INDEX IF NOT EXISTS idx_pitches_pitch_type ON pitches(pitch_type);

-- Add comment
COMMENT ON TABLE pitches IS 'Cached video pitches to avoid regenerating and save tokens';
