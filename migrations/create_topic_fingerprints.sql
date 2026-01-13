-- Create topic_fingerprints table for caching
-- This table stores topic fingerprints to avoid regenerating them

CREATE TABLE IF NOT EXISTS topic_fingerprints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL,
  item_type VARCHAR(50) NOT NULL,
  fingerprint_str TEXT,
  entities JSONB,
  topic_category VARCHAR(100),
  language VARCHAR(10),
  extraction_method VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(item_id, item_type)
);

-- Add indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_fingerprints_category ON topic_fingerprints(topic_category);
CREATE INDEX IF NOT EXISTS idx_fingerprints_lookup ON topic_fingerprints(item_id, item_type);
CREATE INDEX IF NOT EXISTS idx_fingerprints_updated ON topic_fingerprints(updated_at);

-- Enable RLS
ALTER TABLE topic_fingerprints ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow all access to fingerprints" ON topic_fingerprints;

-- Create policy to allow access
CREATE POLICY "Allow all access to fingerprints"
ON topic_fingerprints FOR ALL
TO authenticated, anon, service_role
USING (true)
WITH CHECK (true);

-- Add comment
COMMENT ON TABLE topic_fingerprints IS 'Caches topic fingerprints to avoid regenerating them. Fingerprints include entities, topic categories, and language detection.';
