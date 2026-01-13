-- Update recommendation_feedback action constraint to include implicit feedback actions
-- This allows tracking of user engagement signals like card_expanded, hovered_5s, clicked_source

ALTER TABLE recommendation_feedback
  DROP CONSTRAINT IF EXISTS recommendation_feedback_action_check;

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
