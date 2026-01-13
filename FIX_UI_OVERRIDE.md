# Fix: UI Was Overriding Threshold Changes

## The Problem

The browser UI was calling the API with hardcoded parameters that **overrode** our fixes:
- `priority=HIGH` (we changed default to MEDIUM)
- `min_score=70` (we lowered threshold to 30)

So even though we fixed the server-side defaults, the UI was still using the old strict values!

## Fix Applied

Changed the `updateRssFeeds` function in `app/signals/page.js`:

### Before:
```javascript
const response = await fetch(`/api/rss-processor?show_id=${selectedShow}&priority=HIGH&min_score=70&items_per_feed=5&max_feeds=50`)
```

### After:
```javascript
// TESTING: Lower thresholds to allow signals through
// priority=MEDIUM (allows HIGH and MEDIUM), min_score=30 (very lenient)
const response = await fetch(`/api/rss-processor?show_id=${selectedShow}&priority=MEDIUM&min_score=30&items_per_feed=5&max_feeds=50`)
```

## Expected Results

Now when you click "🔄 Update RSS Feeds":
- **Priority filter**: MEDIUM (allows HIGH and MEDIUM priority items)
- **Score threshold**: 30 (very lenient, allows items with score >= 30)
- **Behavior boost**: +10-20 points for good behaviors
- **Result**: Should save some signals!

## Next Steps

1. **Click "🔄 Update RSS Feeds" again**
2. **Check the alert message** - it will show:
   - How many items processed
   - How many signals saved
   - Score range
   - Priority filter and min score used

3. **Check server console** (terminal where Next.js is running) for:
   ```
   🎯 Using recommendation engine for X items...
   Priority breakdown: HIGH: X, MEDIUM: Y, LOW: Z
   ⚠️  Priority filter: MEDIUM (only MEDIUM+ will be saved)
   🔍 DEBUG Summary:
      Items checked: X
      Passed priority filter: Y
      Passed score threshold: Z
      Actually saved: W
   ```

4. **If still 0 signals**, share:
   - The alert message details
   - Server console logs (especially DEBUG Summary)
   - Any error messages

## Why This Happened

The UI had hardcoded parameters that were more strict than our server-side defaults. This is a common issue when testing - always check both:
- Server-side defaults
- Client-side API calls

Now both are aligned with lenient testing thresholds!

