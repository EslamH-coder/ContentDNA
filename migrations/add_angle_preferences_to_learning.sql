-- Add angle_preferences column to show_learning_weights table
-- This tracks which story angles users prefer (market_reaction, explainer, specific_numbers, etc.)

ALTER TABLE show_learning_weights 
ADD COLUMN IF NOT EXISTS angle_preferences JSONB DEFAULT '{}';

-- Verify column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'show_learning_weights' 
AND column_name = 'angle_preferences';


