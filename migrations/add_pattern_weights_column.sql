-- Add pattern_weights column to show_learning_weights table
ALTER TABLE show_learning_weights 
ADD COLUMN IF NOT EXISTS pattern_weights JSONB DEFAULT '{}';

-- Add comment explaining the structure
COMMENT ON COLUMN show_learning_weights.pattern_weights IS 'Learned weights for behavior patterns. Structure: { "pattern_id": { "liked": 0, "rejected": 0, "weight": 1.0 } }';


