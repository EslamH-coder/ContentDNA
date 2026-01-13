-- Add audience demand columns to signals table
-- These columns store the audience demand score and evidence calculated from show's YouTube data

ALTER TABLE signals ADD COLUMN IF NOT EXISTS audience_demand_score INTEGER DEFAULT 0;
ALTER TABLE signals ADD COLUMN IF NOT EXISTS audience_evidence JSONB DEFAULT '[]';
ALTER TABLE signals ADD COLUMN IF NOT EXISTS demand_summary TEXT;

-- Add index for filtering/sorting by demand score
CREATE INDEX IF NOT EXISTS idx_signals_audience_demand ON signals(show_id, audience_demand_score) WHERE audience_demand_score > 0;

-- Add comments for documentation
COMMENT ON COLUMN signals.audience_demand_score IS 'Score calculated from show''s own YouTube data (topic performance, audience questions, competitor coverage, content gaps)';
COMMENT ON COLUMN signals.audience_evidence IS 'JSON array of evidence objects explaining the demand score';
COMMENT ON COLUMN signals.demand_summary IS 'Human-readable summary of demand level (e.g., "Very High Demand", "High Demand")';


