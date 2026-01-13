-- Update recommendation_feedback action constraint to include all feedback actions
-- This includes both explicit feedback and implicit engagement signals

-- Drop the old constraint if it exists
ALTER TABLE recommendation_feedback 
  DROP CONSTRAINT IF EXISTS recommendation_feedback_action_check;

-- Add new constraint with all actions included
ALTER TABLE recommendation_feedback 
  ADD CONSTRAINT recommendation_feedback_action_check 
  CHECK (action IN (
    -- Explicit feedback
    'liked',
    'rejected',
    'saved',
    'produced',
    'skipped',
    'undo',
    -- Implicit feedback (engagement signals)
    'card_expanded',
    'hovered_5s',
    'clicked_source',
    'generate_pitch',
    'ignored'
  ));



