-- Add unique constraint for topic_definitions table
-- This ensures each show can only have one topic with a given topic_id

ALTER TABLE topic_definitions 
ADD CONSTRAINT topic_definitions_show_topic_unique 
UNIQUE (show_id, topic_id);

-- Add comment
COMMENT ON CONSTRAINT topic_definitions_show_topic_unique ON topic_definitions IS 
'Ensures unique topic_id per show_id combination';



