# Fix Feedback Action Constraint

## Problem

The `recommendation_feedback` table has a constraint that only allows these actions:
- `'liked'`, `'rejected'`, `'saved'`, `'produced'`, `'skipped'`, `'undo'`

But the code is trying to save implicit feedback actions:
- `'card_expanded'` - When user expands an idea card
- `'hovered_5s'` - When user hovers over a card for 5+ seconds
- `'clicked_source'` - When user clicks the source link
- `'generate_pitch'` - When user generates a pitch
- `'ignored'` - When user ignores an idea

This causes the error:
```
new row for relation "recommendation_feedback" violates constraint "recommendation_feedback_action_check"
```

## Solution

Update the database constraint to include all feedback actions.

### Option 1: Run SQL in Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run this SQL:

```sql
-- Drop the old constraint
ALTER TABLE recommendation_feedback 
  DROP CONSTRAINT IF EXISTS recommendation_feedback_action_check;

-- Add new constraint with all actions
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
```

### Option 2: Use Migration File

The migration file has been updated:
- `/migrations/update_recommendation_feedback_action_constraint.sql`

Run it using your migration tool or copy the SQL to Supabase SQL Editor.

## Verification

After running the migration, test by:
1. Expanding an idea card (should track `card_expanded`)
2. Hovering over a card for 5+ seconds (should track `hovered_5s`)
3. Clicking a source link (should track `clicked_source`)

All should work without errors now!
