-- Migration: Add support for hiding rejected/seen topics
-- Date: 2024
-- Description: Adds indexes and views to support filtering of rejected/seen topics

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_feedback_topic_action 
ON recommendation_feedback(show_id, topic, action);

-- View to get rejected/seen topics
CREATE OR REPLACE VIEW hidden_topics AS
SELECT DISTINCT 
  show_id,
  topic,
  action,
  MAX(created_at) as last_seen
FROM recommendation_feedback
WHERE action IN ('rejected', 'liked', 'saved', 'produced')
GROUP BY show_id, topic, action;



