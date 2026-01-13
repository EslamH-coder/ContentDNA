# Debug: "شعار" Title Issue

## Problem
All 72 user videos show `title: "شعار"` (logo placeholder) instead of real video titles.

## Where "شعار" Appears in Codebase

After searching the entire codebase for "شعار":
1. ✅ **Legitimate uses** (NOT the problem):
   - `/lib/contentDNA/index.js` line 442, 446: Recommended thumbnail element for economic/tech topics
   - `/lib/ai/thumbnail-analyzer.js` line 19: Element type that can be detected in thumbnails
   - These are for analyzing thumbnails, NOT for video titles

2. ❌ **NOT found anywhere as default title value**
   - No hardcoded "شعار" as a default title
   - No code that sets `title = 'شعار'`
   - Sync jobs correctly use `item.snippet?.title` from YouTube API

## Data Flow Analysis

### Sync Job: `/app/api/sync-new-videos/route.js`
```javascript
// Line 94: Correctly gets title from YouTube API
title: item.snippet?.title,
```
✅ This is correct - gets real title from YouTube API

### YouTube Import: `/app/api/youtube/import/route.js`
```javascript
// Line 113: Correctly gets title from YouTube API
title: video.snippet.title,
```
✅ This is correct - gets real title from YouTube API

### Onboarding Analyze: `/app/api/onboarding/analyze/route.js`
```javascript
// Line 67: Only updates thumbnail_title, NOT title
thumbnail_title: result.thumbnail_title,
```
✅ This is correct - only updates thumbnail fields, not title

### Query in Signals Route: `/app/api/signals/route.js`
```javascript
// Line 784: Correctly selects 'title' column
.select('id, video_id, title, description, published_at, publish_date, topic_id, youtube_url')
```
✅ This is correct - selects the right column

## Possible Root Causes

### 1. Database Has Wrong Data (Most Likely)
The `title` column in `channel_videos` table actually contains "شعار" for all videos.

**Possible reasons:**
- Initial sync/import had a bug (now fixed)
- Manual data import with wrong data
- Database migration/trigger that overwrote titles
- Thumbnail analyzer somehow overwrote titles (but code doesn't show this)

**Check with SQL:**
```sql
SELECT id, video_id, title, thumbnail_title, description, published_at 
FROM channel_videos 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'
ORDER BY published_at DESC
LIMIT 10;
```

### 2. Database View or Trigger (Less Likely)
There might be a database view that aliases `thumbnail_title` as `title`, or a trigger that replaces titles.

**Check with SQL:**
```sql
-- Check for views
SELECT table_name, view_definition 
FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name LIKE '%channel_videos%';

-- Check for triggers
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'channel_videos';
```

### 3. Column Name Confusion (Less Likely)
Maybe there's a column alias or join that's selecting the wrong column.

**Check:** The query explicitly selects `title`, so this is unlikely.

## Diagnostic Steps

### Step 1: Check Actual Database Values
Run the SQL query in `/migrations/check_channel_videos_titles.sql` to see:
- What's actually in the database
- If `thumbnail_title` is different from `title`
- When videos were last updated
- Pattern analysis

### Step 2: Check Server Console
After refreshing Ideas page, check console for:
```
📹 DIAGNOSTIC: Sample raw channel_videos data (first 3 videos):
   📹 Video 1:
     - title: "شعار"  ← This will show actual database value
     - thumbnail_title: "..."  ← Compare with title
```

### Step 3: Verify YouTube API
If titles in database are "شعار", check if YouTube API actually returns this:
- Use one `video_id` from database
- Check YouTube API directly or visit `youtube_url` in browser
- Verify if YouTube actually has "شعار" as title (unlikely)

## Fix Strategy

### If Database Has Wrong Titles:
1. **Re-sync from YouTube** (Recommended):
   - Trigger `/api/sync-new-videos` endpoint
   - This will upsert videos with correct titles from YouTube API
   - `onConflict: 'show_id,video_id'` with `ignoreDuplicates: false` will update existing records

2. **Manual SQL Fix** (If re-sync doesn't work):
   ```sql
   -- This would require getting real titles from YouTube API
   -- But better to just re-sync
   UPDATE channel_videos 
   SET title = 'Real Title Here'
   WHERE video_id = '...';
   ```

### If Query Issue:
- Check for column aliases
- Verify SELECT statement
- Check for database views

## Quick Fix: Re-sync Videos

The fastest fix is to trigger a re-sync:
```bash
curl -X POST http://localhost:3000/api/sync-new-videos \
  -H "Content-Type: application/json" \
  -d '{"showId": "a7982c70-2b0e-46af-a0ad-c78f4f69cd56"}'
```

This will:
1. Fetch latest videos from YouTube API
2. Get real titles from `item.snippet?.title`
3. Upsert to database (updates existing records)
4. Should fix all titles
