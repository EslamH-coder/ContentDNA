-- ============================================================
-- Add category_weights column to show_learning_weights table
-- Stores learned weights for topic categories (e.g., us_china_trade, iran_general)
-- ============================================================

ALTER TABLE show_learning_weights 
ADD COLUMN IF NOT EXISTS category_weights JSONB DEFAULT '{}';

-- Add comment explaining the structure
COMMENT ON COLUMN show_learning_weights.category_weights IS 'Learned weights for topic categories. Structure: { "category": { "liked": 0, "rejected": 0, "weight": 1.0 } }';

-- Example of what category_weights looks like:
-- {
--   "us_china_trade": { "liked": 5, "rejected": 1, "weight": 1.4 },
--   "us_domestic_finance": { "liked": 3, "rejected": 0, "weight": 1.3 },
--   "iran_general": { "liked": 1, "rejected": 4, "weight": 0.8 }
-- }
