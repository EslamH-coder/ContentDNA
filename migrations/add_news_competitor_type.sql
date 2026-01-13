-- Add 'news' as a valid competitor type
-- This allows marking competitors like الجزيرة as news sources rather than direct/indirect competitors

-- First, check the current constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'competitors_type_check';

-- Drop the old constraint
ALTER TABLE competitors 
DROP CONSTRAINT IF EXISTS competitors_type_check;

-- Add new constraint with 'news' included
ALTER TABLE competitors 
ADD CONSTRAINT competitors_type_check 
CHECK (type IN ('direct', 'indirect', 'news'));

-- Update الجزيرة to 'news' type
UPDATE competitors 
SET type = 'news' 
WHERE name = 'الجزيرة';

-- Verify the changes
SELECT name, type FROM competitors ORDER BY type, name;
