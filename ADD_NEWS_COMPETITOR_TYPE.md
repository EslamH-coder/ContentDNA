# Add 'news' Competitor Type

## Overview

Add 'news' as a valid competitor type to differentiate news sources from direct/indirect competitors.

## SQL Migration

Run this SQL in your Supabase SQL Editor:

```sql
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
```

## Migration File

The migration file has been created at:
- `/migrations/add_news_competitor_type.sql`

## Next Steps

After running the migration:

1. **Update scoring logic** (if needed):
   - News competitors might be treated differently in scoring
   - They could be considered similar to indirect competitors
   - Or they could have their own scoring weight

2. **Update UI** (if needed):
   - Add visual distinction for news sources
   - Or treat them the same as indirect competitors

## Notes

- 'news' type is for news sources that aren't direct competitors but provide trending topics
- This allows better categorization of different competitor types
- The scoring system will need to handle 'news' type appropriately
