# Competitor Data Diagnostic

## Problem
The `competitor_videos` table is empty, so competitor signals (breakout, volume) are not working in the Ideas feature.

---

## 1. Check Database Status

### Check if competitor_videos table is empty:
```sql
SELECT COUNT(*) FROM competitor_videos;
```

### Check if competitors are configured:
```sql
SELECT 
  id,
  name,
  youtube_channel_id,
  tracking_enabled,
  show_id,
  last_checked,
  created_at
FROM competitors 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
```

### Check competitor_videos for your show:
```sql
SELECT COUNT(*) 
FROM competitor_videos 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
```

---

## 2. Where Competitor Data Comes From

### Source: `/app/api/competitors/sync/route.js`

**This is the endpoint that populates `competitor_videos` table.**

**Flow:**
1. User triggers sync via `POST /api/competitors/sync` with `{ competitorId: "..." }`
2. System fetches competitor from `competitors` table
3. Validates:
   - `youtube_channel_id` is set
   - `tracking_enabled` is `true`
4. Resolves YouTube channel ID (handles URLs, handles, etc.)
5. Fetches videos from YouTube Data API
6. Inserts/updates `competitor_videos` table

**Key Code Location:**
- File: `/app/api/competitors/sync/route.js`
- Lines 138-211: Video insertion logic
- Lines 368-504: YouTube API fetching logic

---

## 3. Is There a Cron Job?

### Current Status: **NO AUTOMATIC CRON JOB**

The sync is **manually triggered** via API call. There's no automatic job running.

### To Set Up Automatic Sync:

**Option 1: Vercel Cron (if deployed on Vercel)**
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/competitors/sync-all",
      "schedule": "0 0 * * *"  // Daily at midnight
    }
  ]
}
```

**Option 2: External Cron Service**
- Use cron-job.org or similar
- Call: `POST https://your-domain.com/api/competitors/sync` with `{ competitorId: "..." }`

**Option 3: Manual Trigger**
- Use the UI (Competitors page → Sync button)
- Or call API directly

---

## 4. Competitor Fetching Logic

### Code Location:
- **File**: `/app/api/competitors/sync/route.js`
- **Function**: `fetchYouTubeVideos(channelId, maxResults = 50)`
- **Lines**: 368-504

### Process:
1. **Get Channel Details** (lines 373-397)
   - Fetches channel's uploads playlist ID
   - Uses: `channels.list` API

2. **Get Video IDs** (lines 401-446)
   - Fetches video IDs from uploads playlist
   - Uses: `playlistItems.list` API
   - Fetches up to 50 videos (configurable)

3. **Get Video Details** (lines 454-494)
   - Fetches views, likes, comments, duration
   - Uses: `videos.list` API
   - Processes in batches of 50

4. **Save to Database** (lines 138-211)
   - Checks if video exists (by `youtube_video_id`)
   - Updates existing or inserts new
   - Detects topic using DNA keywords
   - Sets `show_id` from competitor's `show_id`

### Requirements:
- ✅ `YOUTUBE_API_KEY` environment variable
- ✅ Competitor must have `youtube_channel_id` set
- ✅ Competitor must have `tracking_enabled = true`
- ✅ User must be authenticated
- ✅ Rate limit: Daily limit per user (configurable)

---

## 5. For AlMokhbir Channel Specifically

### Check Competitors:
```sql
SELECT 
  id,
  name,
  channel_name,
  youtube_channel_id,
  type,
  tracking_enabled,
  last_checked,
  created_at
FROM competitors 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'
ORDER BY created_at DESC;
```

### Expected Results:
- If empty: No competitors configured → Need to add competitors
- If has rows: Check `tracking_enabled` and `youtube_channel_id`

### Common Issues:
1. **No competitors configured**
   - Solution: Add competitors via UI or API

2. **Competitors exist but `tracking_enabled = false`**
   - Solution: Enable tracking via UI or SQL:
     ```sql
     UPDATE competitors 
     SET tracking_enabled = true 
     WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
     ```

3. **Competitors exist but `youtube_channel_id` is NULL**
   - Solution: Add YouTube channel ID via UI or SQL:
     ```sql
     UPDATE competitors 
     SET youtube_channel_id = 'UC...' 
     WHERE id = 'competitor-id-here';
     ```

4. **Competitors exist but never synced**
   - Solution: Trigger sync manually (see below)

---

## 6. How to Trigger Sync

### Option 1: Via UI (Recommended)
1. Go to `/studio/competitors` page
2. Find a competitor
3. Click "Sync" button
4. Wait for completion

### Option 2: Via API Call
```bash
curl -X POST http://localhost:3000/api/competitors/sync \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "competitorId": "competitor-uuid-here"
  }'
```

### Option 3: Via SQL (Check Status Only)
```sql
-- Check last sync time
SELECT 
  name,
  last_checked,
  tracking_enabled,
  youtube_channel_id
FROM competitors 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
```

---

## 7. Quick Fix Steps

### Step 1: Check if competitors exist
```sql
SELECT COUNT(*) FROM competitors 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
```

### Step 2: If 0 competitors, add one:
```sql
INSERT INTO competitors (
  show_id,
  name,
  channel_name,
  youtube_channel_id,
  type,
  tracking_enabled
) VALUES (
  'a7982c70-2b0e-46af-a0ad-c78f4f69cd56',
  'Example Competitor',
  'Example Channel',
  'UC...',  -- YouTube channel ID
  'direct',
  true
);
```

### Step 3: Trigger sync via API or UI

### Step 4: Verify videos were added:
```sql
SELECT COUNT(*) FROM competitor_videos 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
```

---

## 8. Expected Data Flow

```
1. User adds competitor
   ↓
2. Competitor saved to `competitors` table
   ↓
3. User clicks "Sync" button
   ↓
4. POST /api/competitors/sync called
   ↓
5. System fetches videos from YouTube API
   ↓
6. Videos saved to `competitor_videos` table
   ↓
7. Ideas feature can now detect competitor signals
```

---

## 9. Troubleshooting

### Issue: "No YouTube channel ID/URL set"
- **Cause**: `youtube_channel_id` is NULL
- **Fix**: Add YouTube channel ID to competitor

### Issue: "Tracking is disabled"
- **Cause**: `tracking_enabled = false`
- **Fix**: Enable tracking:
  ```sql
  UPDATE competitors SET tracking_enabled = true WHERE id = '...';
  ```

### Issue: "YouTube API error"
- **Cause**: Invalid API key or quota exceeded
- **Fix**: Check `YOUTUBE_API_KEY` environment variable

### Issue: "Rate limit exceeded"
- **Cause**: Daily sync limit reached
- **Fix**: Wait until next day or increase limit in rate limiter config

### Issue: "No videos found"
- **Cause**: Channel has no videos or channel ID is wrong
- **Fix**: Verify channel ID is correct

---

## 10. Next Steps

1. **Run diagnostic queries** to check current state
2. **Add competitors** if none exist
3. **Enable tracking** if disabled
4. **Trigger sync** for each competitor
5. **Verify videos** were added to `competitor_videos`
6. **Test Ideas feature** - should now show competitor signals

---

## Summary

- **Table**: `competitor_videos` is empty
- **Source**: `/app/api/competitors/sync` endpoint
- **Trigger**: Manual (no automatic cron)
- **Requirements**: Competitors must exist, have `youtube_channel_id`, and `tracking_enabled = true`
- **Action**: Add competitors and trigger sync manually
