-- Add DNA topic weights column for dual-layer learning
ALTER TABLE show_learning_weights
ADD COLUMN IF NOT EXISTS dna_topic_weights JSONB DEFAULT '{}';

-- Optional: quick check
-- SELECT dna_topic_weights, topic_weights, source_weights
-- FROM show_learning_weights
-- WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';



