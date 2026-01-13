# Videos Table Analysis - Before Removal

## 1. What is the 'videos' table used for?

### Primary Uses Found:

1. **Manual CSV Import** (`/app/api/videos/import-csv/route.js`):
   - Users can upload CSV files with video performance data
   - Used to import historical video data for DNA analysis
   - Inserts into `videos` table (lines 582, 704)

2. **Manual JSON Import** (`/app/api/videos/import/route.js`):
   - Users can manually import single videos via API
   - Used for adding videos one by one
   - Inserts into `videos` table (line 129)

3. **DNA Recalculation** (`/app/api/dna/recalculate/route.js`):
   - Fetches ALL videos from `videos` table (line 269)
   - Analyzes video performance to calculate DNA patterns
   - Used for `topicSuccessRates`, `hookPatterns`, `audienceTriggers`

4. **DNA Loader** (`/lib/recommendation/dnaLoader.js`):
   - Loads videos from `videos` table to calculate DNA (line 68)
   - Used for generating topic-based DNA from video performance

5. **Fallback for Ideas Feature** (`/app/api/signals/route.js`):
   - Only used as FALLBACK if `channel_videos` is empty (line 908-950)
   - Has validation to skip if >50% placeholder titles

### Summary:
The `videos` table is used for:
- ✅ **Manual imports** (CSV/JSON) - PRIMARY USE
- ✅ **DNA analysis** (performance patterns) - PRIMARY USE  
- ⚠️ **Fallback for Ideas feature** - SECONDARY USE (only if channel_videos empty)

---

## 2. Why does it have "شعار" as titles?

### Analysis:

1. **NOT from code**: The code that imports to `videos` table uses:
   - CSV import: `video.title` from CSV file (line 341 in import-csv)
   - JSON import: `video.title` from request body (line 114 in import/route.js)
   - No hardcoded "شعار" values

2. **Likely causes**:
   - **Bad CSV import**: User uploaded a CSV file where the "title" column contained "شعار" (possibly from a thumbnail analysis export)
   - **Legacy data**: Old import that had placeholder data
   - **Data source issue**: The CSV/JSON source itself had "شعار" as titles

3. **NOT from thumbnails**: 
   - Thumbnail analysis happens AFTER videos are in database (for `channel_videos`)
   - The `videos` table is populated BEFORE any thumbnail analysis
   - "شعار" is Arabic for "logo/banner", so it might have been a placeholder in the source data

### Conclusion:
The "شعار" titles are **legacy/imported data**, not from the code itself. The data was imported this way from the source CSV/JSON file.

---

## 3. What's the relationship between tables?

### `channel_videos` Table:
- **Purpose**: User's actual YouTube videos (synced from YouTube API)
- **Source**: `/app/api/sync-new-videos/route.js` - Fetches from YouTube Data API
- **Columns**: `video_id`, `title`, `description`, `publish_date` (not `published_at`), `youtube_url`, `thumbnail_url`, `topic_id`, etc.
- **Sync**: Automatic via YouTube API sync endpoint
- **Data Quality**: Real titles from YouTube API (`item.snippet?.title`)

### `videos` Table:
- **Purpose**: Manual imports for DNA analysis + performance tracking
- **Source**: 
  - CSV import (`/app/api/videos/import-csv/route.js`)
  - JSON import (`/app/api/videos/import/route.js`)
- **Columns**: `id`, `show_id`, `title`, `url`, `view_count`, `like_count`, `comment_count`, `duration_seconds`, `format`, `published_at` (not `publish_date`), `performance_classification`, `ratio_vs_median`, `topic_id`, `hook_text`, `performance_hint`, etc.
- **Sync**: Manual (user uploads CSV/JSON)
- **Data Quality**: Depends on source - can have bad data (like "شعار")

### Relationship:
- **DIFFERENT purposes**: 
  - `channel_videos` = YouTube sync (automatic, real-time)
  - `videos` = Manual imports (user-initiated, historical data)
- **NOT duplicates**: They serve different use cases
- **Both linked to `show_id`**: Both tables reference the same `shows` table

---

## 4. Schema Comparison

### `videos` Table Schema:
```sql
CREATE TABLE videos (
  id UUID PRIMARY KEY,
  show_id UUID REFERENCES shows(id),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  view_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  duration_seconds INTEGER,
  format TEXT CHECK (format IN ('long_form', 'short_form')),
  published_at TIMESTAMP WITH TIME ZONE NOT NULL,  -- ⚠️ Different column name
  age_days INTEGER,
  performance_classification TEXT,
  ratio_vs_median DECIMAL(10, 2),
  topic_id TEXT,
  hook_text TEXT,
  performance_hint TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

### `channel_videos` Table Schema (inferred from sync-new-videos):
```sql
-- Based on /app/api/sync-new-videos/route.js insert (line 138-149):
CREATE TABLE channel_videos (
  id UUID PRIMARY KEY,  -- inferred
  show_id UUID REFERENCES shows(id),
  video_id TEXT,  -- YouTube video ID
  title TEXT,
  description TEXT,
  thumbnail_url TEXT,
  publish_date TIMESTAMP WITH TIME ZONE,  -- ⚠️ Different column name
  youtube_url TEXT,
  duration_seconds INTEGER,
  format TEXT,
  views INTEGER,
  likes INTEGER,
  comments INTEGER,
  topic_id TEXT DEFAULT 'other_stories',
  created_at TIMESTAMP WITH TIME ZONE
  -- unique constraint on (show_id, video_id)
);
```

### Key Differences:

| Feature | `videos` | `channel_videos` |
|---------|----------|------------------|
| **Date column** | `published_at` | `publish_date` |
| **Video ID** | `id` (UUID) | `video_id` (YouTube ID) + `id` (UUID) |
| **Performance fields** | ✅ `performance_classification`, `ratio_vs_median`, `age_days` | ❌ Not present |
| **DNA fields** | ✅ `topic_id`, `hook_text`, `performance_hint` | ✅ `topic_id` only |
| **Source** | Manual CSV/JSON import | YouTube API sync |
| **Update frequency** | Manual (one-time imports) | Automatic (periodic sync) |

---

## 5. Critical Dependencies

### `videos` Table is Used By:

1. **DNA Recalculation** (`/app/api/dna/recalculate/route.js`):
   - Fetches ALL videos: `.from('videos').select('*')` (line 269)
   - Calculates: `topicSuccessRates`, `hookPatterns`, `audienceTriggers`
   - **IMPACT**: If removed, DNA recalculation will fail

2. **DNA Loader** (`/lib/recommendation/dnaLoader.js`):
   - Fetches videos: `.from('videos').select('*')` (line 68)
   - Calculates DNA from video performance
   - **IMPACT**: If removed, DNA loading will fail

3. **Ideas Feature** (`/app/api/signals/route.js`):
   - Only used as FALLBACK (line 908-950)
   - Has validation to skip if >50% placeholder titles
   - **IMPACT**: If removed, fallback won't work (but primary `channel_videos` should work)

4. **Median Views Calculation** (`/app/api/videos/import/route.js`, `/app/api/videos/import-csv/route.js`):
   - Calculates median views from `videos` table (line 27, 110)
   - Used for performance classification during import
   - **IMPACT**: If removed, new imports won't have performance classification

---

## 6. Recommendation: DO NOT REMOVE

### Reasons to Keep:

1. **Different Purpose**: 
   - `videos` = Manual imports for DNA analysis (historical data, CSV uploads)
   - `channel_videos` = YouTube sync (real-time, API-based)
   - They serve different use cases

2. **DNA Analysis Dependency**:
   - DNA recalculation REQUIRES `videos` table (no fallback)
   - DNA loader REQUIRES `videos` table (no fallback)
   - Removing would break DNA analysis features

3. **Performance Tracking**:
   - `videos` table has performance fields (`performance_classification`, `ratio_vs_median`) that `channel_videos` doesn't have
   - These are needed for DNA pattern analysis

4. **Manual Import Workflow**:
   - Users can upload CSV files with historical video data
   - This is a separate workflow from YouTube sync
   - Removing would break this feature

### Alternative Solution: Fix the Data, Not Remove the Table

Instead of removing the `videos` table:

1. **Clean existing data**:
   ```sql
   -- Remove videos with placeholder titles
   DELETE FROM videos 
   WHERE title = 'شعار' 
      OR title = 'logo' 
      OR title IS NULL 
      OR title = '';
   ```

2. **Keep fallback validation**:
   - The existing validation (skip if >50% placeholders) already handles bad data
   - This prevents bad data from affecting matching

3. **Migrate if needed**:
   - If you want to consolidate, migrate valid `videos` data to `channel_videos`
   - But keep `videos` for manual imports and DNA analysis

---

## 7. Actual Database Schema Queries

Run these in Supabase SQL Editor to see actual schemas:

```sql
-- Check videos table schema
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'videos' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check channel_videos table schema
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'channel_videos' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Count videos with placeholder titles
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN title = 'شعار' OR title = 'logo' THEN 1 END) as placeholder_count,
  COUNT(CASE WHEN title IS NULL OR title = '' THEN 1 END) as empty_count,
  COUNT(CASE WHEN title NOT IN ('شعار', 'logo') AND title IS NOT NULL AND title != '' THEN 1 END) as valid_count
FROM videos
WHERE show_id = 'YOUR_SHOW_ID';  -- Replace with actual show_id

-- Sample videos table data
SELECT id, title, url, view_count, published_at, created_at
FROM videos
WHERE show_id = 'YOUR_SHOW_ID'  -- Replace with actual show_id
ORDER BY created_at DESC
LIMIT 10;

-- Sample channel_videos table data
SELECT id, video_id, title, publish_date, youtube_url, created_at
FROM channel_videos
WHERE show_id = 'YOUR_SHOW_ID'  -- Replace with actual show_id
ORDER BY publish_date DESC
LIMIT 10;
```

---

## 8. Summary

| Question | Answer |
|----------|--------|
| **Used elsewhere?** | ✅ Yes - DNA recalculation, DNA loader, median views calculation |
| **Why "شعار"?** | ❌ Not from code - Legacy/bad CSV import data |
| **Relationship?** | `videos` = Manual imports, `channel_videos` = YouTube sync |
| **Remove?** | ❌ **NO** - Required for DNA analysis, different purpose |

### Recommendation:
1. **Keep both tables** - They serve different purposes
2. **Clean bad data** - Remove videos with "شعار" titles
3. **Keep fallback** - The validation already handles bad data
4. **Document separation** - Clearly document that `videos` is for manual imports, `channel_videos` is for YouTube sync
