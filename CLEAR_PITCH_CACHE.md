# How to Clear Pitch Cache

## Problem
Cached pitches use the old evidence structure and don't show:
- Evidence sections
- Pattern variety
- Varied predictions

## Solution 1: Clear Cache via API (Recommended)

Add `clearCache: true` to your Studio API call:

```javascript
// In your Studio page or API call
const response = await fetch('/api/studio/pitches', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    showId: 'your-show-id',
    clearCache: true  // ← Add this to force regeneration
  })
});
```

## Solution 2: Clear Cache via SQL (Direct)

Run this in Supabase SQL Editor:

```sql
-- Clear all cached pitches for a specific show
DELETE FROM pitch_history 
WHERE show_id = 'YOUR_SHOW_ID' 
  AND status = 'suggested';

-- Or clear all cached pitches (all shows)
DELETE FROM pitch_history 
WHERE status = 'suggested';
```

## Solution 3: Clear Cache via Supabase Dashboard

1. Go to Supabase Dashboard → Table Editor
2. Select `pitch_history` table
3. Filter by `status = 'suggested'`
4. Select all rows
5. Click "Delete" button

## After Clearing Cache

1. Refresh the Studio page
2. Pitches will be regenerated with:
   - ✅ New evidence structure
   - ✅ Pattern variety (not all "Superpower Competition")
   - ✅ Varied predictions based on actual factors
   - ✅ Proper tier classification (Post Today, This Week, Evergreen)

## Verify Cache is Cleared

Check the console logs when loading Studio:
- Should see: `Generated X pitches total (0 cached, X new)`
- Should NOT see: `✅ Using X cached pitches for: "..."`