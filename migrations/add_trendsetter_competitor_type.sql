-- Add 'trendsetter' as a competitor type
-- This allows marking news/media sources as trendsetters that signal growing interest

-- Check current constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'competitors_type_check';

-- Drop old constraint
ALTER TABLE competitors 
DROP CONSTRAINT IF EXISTS competitors_type_check;

-- Add new constraint with 'trendsetter' included
ALTER TABLE competitors 
ADD CONSTRAINT competitors_type_check 
CHECK (type IN ('direct', 'indirect', 'trendsetter'));

-- Update news/media sources to trendsetter
UPDATE competitors 
SET type = 'trendsetter' 
WHERE name IN (
  'الجزيرة',
  'Al Jazeera',
  'العربية', 
  'Al Arabiya',
  'BBC',
  'BBC Arabic',
  'Sky News',
  'سكاي نيوز عربية',
  'Reuters',
  'Bloomberg',
  'CNBC',
  'CNN'
);

-- Verify the update
SELECT name, type FROM competitors ORDER BY type, name;
