# Competitor Schema Analysis - Actual Database Structure

## 📊 Schema Inspection Results

### 1. competitor_videos Table Columns

**16 columns total:**

1. `id` (UUID) - Primary key
2. `competitor_id` (UUID) - **Foreign key to competitors.id**
3. `youtube_video_id` (string) - YouTube video ID
4. `title` (string) - Video title
5. `published_at` (timestamp) - Publication date
6. `views` (number) - View count
7. `likes` (number) - Like count
8. `comments` (number) - Comment count
9. `duration_seconds` (number) - Video duration
10. `detected_topic` (string) - Detected topic ID
11. `relevance_score` (number) - Relevance score
12. `created_at` (timestamp) - Creation timestamp
13. `performance_ratio` (number) - Performance ratio
14. `is_success` (boolean) - Success flag
15. `is_failure` (boolean) - Failure flag
16. `topics` (null/array) - Topics array

**❌ NO `show_id` column!**

---

### 2. competitors Table Columns

**10 columns total:**

1. `id` (UUID) - Primary key
2. `show_id` (UUID) - **Foreign key to shows.id** ✅
3. `youtube_channel_id` (string) - YouTube channel ID
4. `name` (string) - Competitor name
5. `type` (string) - Type (direct/indirect)
6. `notes` (string/null) - Notes
7. `tracking_enabled` (boolean) - Tracking enabled flag
8. `last_checked` (timestamp) - Last sync timestamp
9. `created_at` (timestamp) - Creation timestamp
10. `is_relevant_for_matching` (boolean) - Relevance flag

**✅ HAS `show_id` column!**

---

### 3. Relationship Structure

```
competitor_videos
  ├─ competitor_id → competitors.id
  └─ (no show_id)

competitors
  ├─ id (primary key)
  └─ show_id → shows.id

shows
  └─ id (primary key)
```

**Relationship Path:**
```
competitor_videos.competitor_id → competitors.id → competitors.show_id → shows.id
```

---

### 4. Sample Data

**competitor_videos sample:**
```json
{
  "id": "9adea233-bb89-421a-9251-8ab8abc05dc4",
  "competitor_id": "ed64b127-24e6-4264-9377-ec250635392d",
  "youtube_video_id": "WBaYZKcFEq4",
  "title": "نشتري ذهب ولا لأ؟ الذهب رايح على فين في 2026؟",
  "published_at": "2025-12-31T17:57:48+00:00",
  "views": 255072,
  "likes": 12872,
  "comments": 241,
  "duration_seconds": 170,
  "detected_topic": "other_stories"
}
```

**competitors sample:**
```json
{
  "id": "ed64b127-24e6-4264-9377-ec250635392d",
  "show_id": "a7982c70-2b0e-46af-a0ad-c78f4f69cd56",
  "youtube_channel_id": "UC4kRorAXuIkyIX6vwXKaLWg",
  "name": "المخبر الاقتصادي",
  "type": "direct",
  "tracking_enabled": true
}
```

---

## 🔧 Correct Query Pattern

### ❌ WRONG (What was happening):
```javascript
// This fails because competitor_videos has no show_id column
.from('competitor_videos')
.eq('show_id', showId)  // ❌ Column doesn't exist!
```

### ✅ CORRECT (Fixed version):
```javascript
// Step 1: Get competitor IDs for this show
const { data: showCompetitors } = await supabaseAdmin
  .from('competitors')
  .select('id')
  .eq('show_id', showId);

const competitorIds = showCompetitors?.map(c => c.id) || [];

// Step 2: Query videos using competitor IDs
const { data: competitorVideos } = await supabaseAdmin
  .from('competitor_videos')
  .select(`
    *,
    competitors!inner (
      id,
      name,
      channel_name,
      youtube_channel_id,
      show_id
    )
  `)
  .in('competitor_id', competitorIds)  // ✅ Correct!
  .gte('published_at', ...)
  .order('views', { ascending: false })
  .limit(200);
```

---

## 📋 Summary

### Key Findings:

1. **competitor_videos** has NO `show_id` column
   - Only has `competitor_id` (foreign key)

2. **competitors** HAS `show_id` column
   - Links competitors to shows

3. **Relationship:**
   - `competitor_videos.competitor_id` → `competitors.id`
   - `competitors.show_id` → `shows.id`

4. **Current Status:**
   - ✅ 662 competitor videos in database
   - ✅ 11 competitors configured
   - ✅ Fix applied to `/app/api/signals/route.js`

### The Fix:

The signals route was trying to query `competitor_videos` with `.eq('show_id', showId)` which doesn't work because that column doesn't exist.

**Fixed by:**
1. First getting competitor IDs for the show
2. Then querying `competitor_videos` with `.in('competitor_id', competitorIds)`

This should now correctly fetch competitor videos for scoring!
