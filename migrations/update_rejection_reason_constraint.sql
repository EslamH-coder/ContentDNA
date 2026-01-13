-- Update recommendation_feedback rejection_reason constraint
-- This allows all rejection reasons used in the application

-- Drop the old constraint if it exists
ALTER TABLE recommendation_feedback 
  DROP CONSTRAINT IF EXISTS recommendation_feedback_rejection_reason_check;

-- Add new constraint with all valid rejection reasons
-- NULL is allowed (rejection_reason is optional, only used when action = 'rejected')
ALTER TABLE recommendation_feedback 
  ADD CONSTRAINT recommendation_feedback_rejection_reason_check 
  CHECK (
    rejection_reason IS NULL OR 
    rejection_reason IN (
      'not_relevant',
      'bad_source',
      'bad_timing',
      'low_interest',
      'already_covered',
      'angle_too_broad',
      'weak_evidence',
      'other'
    )
  );

-- Verify the constraint was added
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'recommendation_feedback'::regclass
  AND conname = 'recommendation_feedback_rejection_reason_check';


