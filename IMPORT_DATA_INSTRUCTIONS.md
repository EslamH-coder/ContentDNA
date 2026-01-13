# Import JSON Data to Supabase - Instructions

## Overview
This guide will help you import JSON data from `/data/processed/` into Supabase tables for use by the Simple Intelligence Engine.

## Files Created
1. `Create_Import_Tables_SQL.sql` - SQL schema for the import tables
2. `scripts/importDataToSupabase.js` - Node.js import script
3. Updated `lib/intelligence/simpleIntelligenceEngine.js` - Now uses new tables

---

## STEP 1: Create Tables in Supabase

1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `Create_Import_Tables_SQL.sql`
3. Run the SQL script
4. Verify tables were created:
   - `search_terms`
   - `audience_videos`
   - `audience_comments`

---

## STEP 2: Set Environment Variables

Make sure you have these environment variables set:

```bash
export NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
export SUPABASE_SERVICE_KEY=your_service_role_key
```

**Important:** Use the **service role key** (not the anon key) for the import script, as it needs to bypass RLS policies.

---

## STEP 3: Run the Import

```bash
cd /Users/Hassanes_1/Documents/channelbrain/cursor
npm run import-data
```

The script will:
- Load data from `data/processed/search_terms.json`
- Load data from `data/processed/audience_videos.json`
- Load data from `data/processed/comments.json`
- Transform data to match Supabase schema
- Insert in batches of 500 records
- Show progress and final counts

**Expected output:**
```
🚀 Starting data import to Supabase...
📁 Data path: /path/to/data/processed
🎯 Show ID: 00000000-0000-0000-0000-000000000004

📊 Importing search terms...
   Found 3200 search terms
   Prepared 3200 records for import
   Inserted 3200/3200
✅ Search terms: 3200 imported

📊 Importing audience videos...
   Found 4900 videos
   Prepared 4900 records for import
   Inserted 4900/4900
✅ Audience videos: 4900 imported

📊 Importing comments...
   Found 9900 comments
   Prepared 9900 records for import
   Inserted 9900/9900
✅ Comments: 9900 imported

========================================
📊 IMPORT COMPLETE
========================================
Search Terms: 3200
Audience Videos: 4900
Comments: 9900
========================================
```

---

## STEP 4: Verify Import

Run this SQL in Supabase SQL Editor:

```sql
SELECT 
  'search_terms' as table_name, 
  COUNT(*) as count 
FROM search_terms
WHERE show_id = '00000000-0000-0000-0000-000000000004'
UNION ALL
SELECT 
  'audience_videos', 
  COUNT(*) 
FROM audience_videos
WHERE show_id = '00000000-0000-0000-0000-000000000004'
UNION ALL
SELECT 
  'audience_comments', 
  COUNT(*) 
FROM audience_comments
WHERE show_id = '00000000-0000-0000-0000-000000000004';
```

**Expected counts:**
- `search_terms`: ~3,200
- `audience_videos`: ~4,900
- `audience_comments`: ~9,900

---

## STEP 5: Test Simple Intelligence Engine

The Simple Intelligence Engine has been updated to use the new tables:

1. It now queries `search_terms` with filters:
   - `show_id = '00000000-0000-0000-0000-000000000004'`
   - `is_branded = false`

2. It now queries `audience_videos` with filters:
   - `show_id = '00000000-0000-0000-0000-000000000004'`
   - `is_relevant = true`

3. It now queries `audience_comments` with filters:
   - `show_id = '00000000-0000-0000-0000-000000000004'`
   - `is_actionable = true`

Test it by visiting: `/intel` page in your app.

---

## Troubleshooting

### Error: "Missing Supabase credentials"
- Make sure `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are set
- Use the service role key, not the anon key

### Error: "relation does not exist"
- Make sure you ran `Create_Import_Tables_SQL.sql` in Supabase first

### Error: "duplicate key value"
- The script uses `upsert` with `onConflict`, so duplicates will be updated
- This is normal if you run the import multiple times

### Import shows 0 records
- Check that JSON files exist in `data/processed/`
- Verify JSON structure matches expected format:
  - `search_terms.json`: `{ terms: [...] }`
  - `audience_videos.json`: `{ videos: [...] }`
  - `comments.json`: `{ comments: [...] }`

---

## Schema Mapping

### search_terms.json → search_terms table
| JSON Field | Table Column | Notes |
|------------|--------------|-------|
| `term` | `term` | Search query text |
| `views` | `views` | Total views |
| `watchTimeHours` | `watch_time_hours` | Total watch time |
| `avgViewDuration` | `avg_view_duration` | Average duration |
| `topic` | `topic` | Category |
| `intent` | `intent` | Search intent |
| `personas` | `personas` | JSONB array |
| `isBranded` | `is_branded` | Boolean |
| `isOpportunity` | `is_opportunity` | Boolean |

### audience_videos.json → audience_videos table
| JSON Field | Table Column | Notes |
|------------|--------------|-------|
| `id` | `video_id` | Video identifier |
| `title` | `title` | Video title |
| `url` | `url` | Video URL |
| `platform` | `platform` | Default: 'youtube' |
| `uploadDate` | `upload_date` | ISO timestamp |
| `duration` | `duration` | Seconds |
| `creator.id` | `creator_id` | Creator ID |
| `creator.name` | `creator_name` | Creator name |
| `views` | `views` | View count |
| `engagements` | `engagements` | Engagement count |
| `relevanceScore` | `relevance_score` | Numeric |
| `audienceOverlap` | `audience_overlap` | 0-1 decimal |
| `isShort` | `is_short` | Boolean |
| `category` | `category` | YouTube category |
| `topic` | `topic` | Content topic |
| `personas` | `personas` | JSONB array |
| `isRelevant` | `is_relevant` | Boolean |

### comments.json → audience_comments table
| JSON Field | Table Column | Notes |
|------------|--------------|-------|
| `id` | `comment_id` | Comment identifier |
| `author` | `author` | Author username |
| `text` | `text` | Comment text |
| `likes` | `likes` | Like count |
| `replies` | `replies` | Reply count |
| `date` | `comment_date` | Parsed from MM/DD/YYYY |
| `videoId` | `video_id` | Video ID |
| `videoTitle` | `video_title` | Video title |
| `type` | `type` | Comment type |
| `sentiment` | `sentiment` | Sentiment analysis |
| `topic` | `topic` | Content topic |
| `question` | `question` | Extracted question |
| `request` | `request` | Extracted request |
| `isActionable` | `is_actionable` | Boolean |

---

## Next Steps

After successful import:
1. ✅ Tables created in Supabase
2. ✅ Data imported from JSON files
3. ✅ Simple Intelligence Engine updated to use new tables
4. ✅ Test the `/intel` page to see recommendations

The Simple Intelligence Engine will now use Supabase tables instead of local JSON files, making it faster and more scalable.




