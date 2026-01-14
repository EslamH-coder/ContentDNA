# Competitor Videos Diagnostic Guide

## Problem
Competitor videos are showing as empty (0 videos) in the signals API, causing competitor boost to always be 0.

## Root Causes (Potential)

1. **No competitors configured** - Show has no competitors in the `competitors` table
2. **No videos in database** - Competitors exist but `competitor_videos` table is empty
3. **Videos too old** - Videos exist but none in last 7 days (query filter)
4. **Join query failing** - Foreign key relationship broken between tables
5. **Date format issues** - `published_at` field has incorrect format

## Diagnostic Tools

### 1. API Endpoint (Recommended)

Run the diagnostic via API:

```bash
# Replace YOUR_SHOW_ID with actual show ID
curl "http://localhost:3000/api/diagnostics/competitors?showId=YOUR_SHOW_ID"
```

Or in browser:
```
http://localhost:3000/api/diagnostics/competitors?showId=YOUR_SHOW_ID
```

**Response includes:**
- ✅/❌ Status for each check
- Count of competitors configured
- Count of videos in database
- Count of videos in last 7 days
- Sample videos and dates
- Specific error messages
- Recommendations for fixes

### 2. Enhanced Logging (Automatic)

The `/api/signals` route now automatically logs diagnostics when competitor videos are empty:

```
⚠️ ===== COMPETITOR VIDEOS DIAGNOSTIC =====
   Show ID: xxx
   Competitor IDs: [1, 2, 3]
   ❌ No competitor videos found in database at all
   💡 Possible causes:
      1. Competitor video sync job is not running
      2. YouTube channel IDs are incorrect in competitors table
      3. Competitors have not posted any videos yet
```

### 3. Manual Database Check

Run these SQL queries in Supabase:

```sql
-- Check 1: Are competitors configured?
SELECT id, name, type, youtube_channel_id, is_active 
FROM competitors 
WHERE show_id = 'YOUR_SHOW_ID';

-- Check 2: Do videos exist?
SELECT COUNT(*) as total_videos,
       COUNT(CASE WHEN published_at >= NOW() - INTERVAL '7 days' THEN 1 END) as last_7_days
FROM competitor_videos
WHERE competitor_id IN (
  SELECT id FROM competitors WHERE show_id = 'YOUR_SHOW_ID'
);

-- Check 3: Sample videos
SELECT cv.id, cv.title, cv.published_at, cv.views, c.name as competitor_name
FROM competitor_videos cv
JOIN competitors c ON cv.competitor_id = c.id
WHERE c.show_id = 'YOUR_SHOW_ID'
ORDER BY cv.published_at DESC
LIMIT 10;
```

## Common Issues & Fixes

### Issue 1: No Competitors Configured

**Symptoms:**
- Diagnostic shows: `❌ FAIL: No active competitors configured`
- `competitorIds.length === 0` in logs

**Fix:**
1. Go to `/competitors` page
2. Add competitors with correct YouTube channel IDs
3. Ensure `is_active` is `true`

### Issue 2: No Videos in Database

**Symptoms:**
- Diagnostic shows: `❌ FAIL: No competitor videos found in database`
- Competitors exist but `competitor_videos` table is empty

**Possible Causes:**
1. **Sync job not running** - Check if competitor video sync job is scheduled/running
2. **Wrong YouTube channel IDs** - Verify channel IDs in `competitors` table
3. **API quota exceeded** - Check YouTube API quota/limits
4. **Sync job errors** - Check job logs for errors

**Fix:**
1. Check sync job status/logs
2. Verify YouTube channel IDs are correct
3. Manually trigger sync if needed
4. Check YouTube API quota

### Issue 3: Videos Too Old

**Symptoms:**
- Diagnostic shows: `❌ FAIL: No videos in last 7 days`
- Videos exist but older than 7 days

**Fix Options:**
1. **Increase time window** (in `/app/api/signals/route.js`):
   ```javascript
   // Change from 7 days to 14 days
   .gte('published_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
   ```

2. **Check sync frequency** - Ensure sync job runs frequently enough

### Issue 4: Join Query Failing

**Symptoms:**
- Diagnostic shows: `❌ ERROR: Join query failed`
- Error mentions "foreign key" or "relationship"

**Fix:**
1. Check foreign key relationship in Supabase:
   ```sql
   -- Verify foreign key exists
   SELECT 
     tc.constraint_name, 
     tc.table_name, 
     kcu.column_name,
     ccu.table_name AS foreign_table_name,
     ccu.column_name AS foreign_column_name 
   FROM information_schema.table_constraints AS tc 
   JOIN information_schema.key_column_usage AS kcu
     ON tc.constraint_name = kcu.constraint_name
   JOIN information_schema.constraint_column_usage AS ccu
     ON ccu.constraint_name = tc.constraint_name
   WHERE tc.table_name = 'competitor_videos'
     AND tc.constraint_type = 'FOREIGN KEY';
   ```

2. If missing, create foreign key:
   ```sql
   ALTER TABLE competitor_videos
   ADD CONSTRAINT competitor_videos_competitor_id_fkey
   FOREIGN KEY (competitor_id) REFERENCES competitors(id);
   ```

### Issue 5: Date Format Issues

**Symptoms:**
- Diagnostic shows dates that can't be parsed
- Videos exist but date filter doesn't work

**Fix:**
1. Check `published_at` format in database
2. Ensure dates are in ISO format (YYYY-MM-DDTHH:mm:ssZ)
3. Update sync job to use correct date format

## Testing the Fix

After fixing an issue, test by:

1. **Run diagnostic again:**
   ```bash
   curl "http://localhost:3000/api/diagnostics/competitors?showId=YOUR_SHOW_ID"
   ```

2. **Check signals API logs:**
   - Should see: `📊 Competitor videos fetched: X videos in last 7 days`
   - Should NOT see diagnostic warnings

3. **Verify competitor boost in scoring:**
   - Signals should show `competitor_count > 0`
   - Competitor boost should be > 0

## Quick Test

Run diagnostic for the show you're actually using (from signals API logs):
```bash
# Replace with your actual show ID from the signals API
GET /api/diagnostics/competitors?showId=a7982c70-2b0e-46af-a0ad-c78f4f69cd56
```

## Next Steps

Once root cause is identified:

1. **If no competitors:** Add them via UI
2. **If sync job broken:** Fix sync job or trigger manually
3. **If time window too short:** Increase window or fix sync frequency
4. **If database issue:** Fix foreign keys or date formats

## Related Files

- `/app/api/signals/route.js` - Main signals API (lines 705-763)
- `/lib/diagnostics/competitorDiagnostics.js` - Diagnostic tool
- `/app/api/diagnostics/competitors/route.js` - Diagnostic API endpoint
- `/app/competitors/page.js` - Competitor management UI
