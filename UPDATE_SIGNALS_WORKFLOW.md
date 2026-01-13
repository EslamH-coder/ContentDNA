# Complete Workflow: Update Signals After Changing RSS URLs

## Step-by-Step Guide

### Step 1: Sync RSS Feeds from Config to Database

After updating `scripts/config/rss_feeds.json`, sync it to Supabase:

```bash
curl -X POST http://localhost:3000/api/sync-rss-feeds \
  -H "Content-Type: application/json" \
  -d '{"show_id": "00000000-0000-0000-0000-000000000004"}'
```

**Expected response:**
```json
{
  "success": true,
  "synced": 27,
  "total_feeds": 27,
  "sources": [...]
}
```

### Step 2: Clear Old Signals (Optional but Recommended)

If you want fresh signals, delete old ones first:

**Option A: Delete all signals for the show**
```sql
DELETE FROM signals 
WHERE show_id = '00000000-0000-0000-0000-000000000004';
```

**Option B: Delete only low-quality signals**
```sql
DELETE FROM signals 
WHERE show_id = '00000000-0000-0000-0000-000000000004'
  AND score < 7.0;
```

**Option C: Delete signals older than X days**
```sql
DELETE FROM signals 
WHERE show_id = '00000000-0000-0000-0000-000000000004'
  AND detected_at < NOW() - INTERVAL '7 days';
```

### Step 3: Process RSS Feeds

Run the RSS processor to fetch and score new items:

```bash
curl "http://localhost:3000/api/rss-processor?show_id=00000000-0000-0000-0000-000000000004"
```

**Expected response:**
```json
{
  "success": true,
  "processed": 40,
  "saved": 15,
  "results": [...],
  "scoreStats": {
    "min": "4.00",
    "max": "9.60",
    "avg": "6.82"
  }
}
```

### Step 4: View New Signals

Go to: `http://localhost:3000/signals`

You should see the newly saved signals!

## Troubleshooting: Why 0 Signals Saved?

If you see `"saved": 0` even after processing:

### Issue 1: All items already exist (duplicates)
**Solution:** Clear old signals (Step 2 above)

### Issue 2: Score threshold too high
**Check current threshold:** Look in `app/api/rss-processor/route.js` line ~246
- Current: `7.0` (high quality only)
- Lower to `5.0` for more signals
- Lower to `2.0` for testing

**To change:** Edit the file and restart dev server

### Issue 3: No matching DNA topics
**Check:** Verify DNA topics in `signal_sources` table match your RSS content

## Quick One-Liner (All Steps)

```bash
# 1. Sync feeds
curl -X POST http://localhost:3000/api/sync-rss-feeds -H "Content-Type: application/json" -d '{"show_id": "00000000-0000-0000-0000-000000000004"}'

# 2. Process feeds
curl "http://localhost:3000/api/rss-processor?show_id=00000000-0000-0000-0000-000000000004"

# 3. Check results
curl "http://localhost:3000/api/health"
```

## Verify Everything Worked

1. **Check signals count:**
   ```sql
   SELECT COUNT(*) FROM signals 
   WHERE show_id = '00000000-0000-0000-0000-000000000004';
   ```

2. **Check latest signals:**
   ```sql
   SELECT title, score, detected_at 
   FROM signals 
   WHERE show_id = '00000000-0000-0000-0000-000000000004'
   ORDER BY detected_at DESC 
   LIMIT 10;
   ```

3. **Visit signals page:** `http://localhost:3000/signals`

