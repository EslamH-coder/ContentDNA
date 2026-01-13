# Debug: Timing & Format Decisions Not Showing

## Quick Check

1. **Check if signals have timing_format in database:**
   ```sql
   SELECT 
     id, 
     title,
     raw_data->'recommendation'->'timing_format' as timing_format
   FROM signals 
   WHERE show_id = 'YOUR_SHOW_ID'
   LIMIT 5;
   ```

2. **Check browser console:**
   - Open `/signals` page
   - Open browser DevTools (F12)
   - Check Console for any errors
   - Check if `signal.raw_data.recommendation.timing_format` exists

3. **Check if decisions are being generated:**
   - Run RSS update
   - Check server console logs for:
     ```
     ✅ Recommended: "..."
        Timing: 🔴 URGENT
        Format: 📺 LONG
     ```

## Common Issues

### Issue 1: Old Signals (Created Before Feature)
**Solution:** Run a new RSS update to create signals with timing_format decisions.

### Issue 2: raw_data is NULL or Empty
**Solution:** Check if `raw_data` column exists and has data:
```sql
SELECT id, title, raw_data IS NULL as is_null, raw_data::text
FROM signals 
WHERE show_id = 'YOUR_SHOW_ID'
LIMIT 1;
```

### Issue 3: Timing Format Not in Expected Structure
**Solution:** Check the actual structure:
```sql
SELECT 
  id,
  title,
  raw_data->'recommendation'->'timing_format'->'timing'->>'decision' as timing_decision,
  raw_data->'recommendation'->'timing_format'->'format'->>'decision' as format_decision
FROM signals 
WHERE show_id = 'YOUR_SHOW_ID'
LIMIT 5;
```

## Expected Structure

```json
{
  "raw_data": {
    "recommendation": {
      "timing_format": {
        "timing": {
          "decision": "URGENT",
          "deadline": "This week",
          "icon": "🔴"
        },
        "format": {
          "decision": "LONG",
          "duration": "25-30 min",
          "icon": "📺"
        },
        "action": {
          "priority": "HIGH",
          "recommendation": "Produce this week - full long-form"
        }
      }
    }
  }
}
```

## Force Regenerate Decisions

If signals exist but don't have timing_format, you can:

1. **Delete old signals and re-run RSS update:**
   ```sql
   DELETE FROM signals WHERE show_id = 'YOUR_SHOW_ID';
   ```
   Then click "🔄 Update RSS Feeds" on `/signals` page.

2. **Or update existing signals** (if you have a migration script)

## Test in Browser Console

On `/signals` page, open console and run:
```javascript
// Check first signal
const firstSignal = document.querySelector('[data-signal-id]');
console.log('Signal data:', firstSignal);

// Or check via React DevTools
// Look for signals array in component state
```

