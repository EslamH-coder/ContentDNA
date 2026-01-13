# Clear Ideas/Signals Data - Complete Guide

**Show ID:** `a7982c70-2b0e-46af-a0ad-c78f4f69cd56`

---

## 1. Tables That Store Ideas/Signals Data

### Primary Tables:
1. **`signals`** - Main ideas/signals table
   - Stores: RSS items processed and scored
   - Columns: `id`, `show_id`, `title`, `source`, `score`, `hook_potential`, `relevance_score`, `is_visible`, `status`, `type`, `raw_data`, `created_at`, `updated_at`
   - **This is the main table to clear**

2. **`recommendation_feedback`** - User feedback on signals
   - Stores: Liked, rejected, saved, produced actions
   - Columns: `id`, `show_id`, `topic` (signal title), `action`, `rejection_reason`, `created_at`
   - **Recommendation: Keep for testing (useful for learning system)**

3. **`pitches`** - Cached generated pitches
   - Stores: Pre-generated pitches to save tokens
   - Columns: `id`, `signal_id`, `show_id`, `pitch_type`, `content`, `created_at`
   - **Clear if you want fresh pitch generation**

4. **`saved_ideas`** - Saved ideas (separate from signals)
   - Stores: User-saved ideas
   - Columns: `id`, `show_id`, `title`, `pitch`, `status`, `created_at`
   - **Clear if you want fresh saved ideas**

### Supporting Tables (Keep):
- **`signal_sources`** - RSS feed configuration (KEEP - don't delete)
- **`show_dna`** - DNA topics and keywords (KEEP - needed for scoring)
- **`show_behavior_patterns`** - Behavior pattern learning (KEEP - used for matching)
- **`show_learning_weights`** - Learned weights from feedback (OPTIONAL - keep for learning system)
- **`competitors`** - Competitor configuration (KEEP - needed for competitor signals)
- **`competitor_videos`** - Competitor video data (KEEP - needed for competitor signals)
- **`channel_videos`** - User's YouTube videos (KEEP - needed for freshness signals)

---

## 2. SQL to Clear Data for This Show

### Option A: Complete Clear (Recommended for Testing)

Run this in Supabase SQL Editor:

```sql
-- Set your show_id
DO $$
DECLARE
  target_show_id UUID := 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
BEGIN
  -- Delete pitches (cached pitches)
  DELETE FROM pitches WHERE show_id = target_show_id;
  
  -- Delete saved ideas
  DELETE FROM saved_ideas WHERE show_id = target_show_id;
  
  -- Delete signals (main ideas/signals)
  DELETE FROM signals WHERE show_id = target_show_id;
  
  RAISE NOTICE '✅ Cleared all ideas/signals data for show: %', target_show_id;
END $$;
```

### Option B: Manual Commands (One-by-One)

```sql
-- 1. Delete pitches (cached pitches)
DELETE FROM pitches WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';

-- 2. Delete saved ideas
DELETE FROM saved_ideas WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';

-- 3. Delete signals (main ideas/signals)
DELETE FROM signals WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
```

### Option C: Keep Feedback, Clear Everything Else

```sql
-- Clear signals, pitches, saved_ideas, but KEEP feedback
DELETE FROM pitches WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
DELETE FROM saved_ideas WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
DELETE FROM signals WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';

-- Keep recommendation_feedback (for learning system)
-- DELETE FROM recommendation_feedback WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';  -- DON'T RUN
```

### Option D: Clear Feedback Too (Full Reset)

```sql
-- Clear everything including feedback (full reset)
DELETE FROM pitches WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
DELETE FROM saved_ideas WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
DELETE FROM signals WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
DELETE FROM recommendation_feedback WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
```

---

## 3. Cached Data Elsewhere

### Client-Side (Browser localStorage):
- **Key**: `seenSignals_${showId}`
- **Location**: Browser localStorage
- **How to clear**: 
  ```javascript
  // Run in browser console:
  localStorage.removeItem('seenSignals_a7982c70-2b0e-46af-a0ad-c78f4f69cd56');
  ```

### Server-Side (Computed Columns):
- **`is_visible`** - Computed on-the-fly, no cache (will be recomputed on next API call)
- **`relevance_score`** - Computed on-the-fly, no cache
- **`hook_potential`** - Computed on-the-fly, no cache

### No Redis/Server Cache:
- ❌ No Redis cache found
- ❌ No server-side cache found
- ✅ All scores are computed on-the-fly from database data

---

## 4. How to Trigger Fresh Sync

### Option A: API Endpoint (Recommended)

**1. Process RSS Feeds:**
```bash
curl "http://localhost:3000/api/rss-processor?show_id=a7982c70-2b0e-46af-a0ad-c78f4f69cd56"
```

**2. Or use POST:**
```bash
curl -X POST http://localhost:3000/api/rss-processor \
  -H "Content-Type: application/json" \
  -d '{"show_id": "a7982c70-2b0e-46af-a0ad-c78f4f69cd56"}'
```

**3. Refresh Signals (Alternative):**
```bash
curl "http://localhost:3000/api/signals/refresh?show_id=a7982c70-2b0e-46af-a0ad-c78f4f69cd56"
```

### Option B: UI Button

1. **Go to Studio Ideas page**: `http://localhost:3000/studio?showId=a7982c70-2b0e-46af-a0ad-c78f4f69cd56`
2. **Click "🔄 Refresh Signals" button** (if available)
3. **Or go to `/signals` page** and click "🔄 Update RSS Feeds"

### Option C: Sync RSS Feeds First (If Needed)

If RSS feeds aren't synced:
```bash
curl -X POST http://localhost:3000/api/sync-rss-feeds \
  -H "Content-Type: application/json" \
  -d '{"show_id": "a7982c70-2b0e-46af-a0ad-c78f4f69cd56"}'
```

Then process:
```bash
curl "http://localhost:3000/api/rss-processor?show_id=a7982c70-2b0e-46af-a0ad-c78f4f69cd56"
```

---

## 5. Will Clearing Affect Other Features?

### ✅ Safe to Clear (No Impact):
- **Signals/Ideas** - These are generated fresh from RSS
- **Pitches** - Regenerated on-demand
- **Saved Ideas** - User-saved items only

### ⚠️ Optional to Clear (Affects Learning):
- **`recommendation_feedback`** - User feedback (liked, rejected, saved)
  - **Impact**: Loses learning from user feedback
  - **Recommendation**: **KEEP for testing** - useful to see how learning system works
  - **Clear only if**: You want to test the learning system from scratch

### ❌ DO NOT Clear (Breaks Features):
- **`signal_sources`** - RSS feed URLs (needed for processing)
- **`show_dna`** - DNA topics/keywords (needed for scoring)
- **`show_behavior_patterns`** - Behavior patterns (used for matching)
- **`show_learning_weights`** - Learned weights (used for scoring adjustment)
- **`competitors`** - Competitor configuration (needed for competitor signals)
- **`competitor_videos`** - Competitor videos (needed for competitor signals)
- **`channel_videos`** - User's videos (needed for freshness signals)

---

## 6. Complete Testing Workflow

### Step 1: Clear Data

**In Supabase SQL Editor:**
```sql
-- Run the complete clear script
\i migrations/clear_ideas_signals_for_testing.sql

-- OR run manually:
DELETE FROM pitches WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
DELETE FROM saved_ideas WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
DELETE FROM signals WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
```

### Step 2: Clear Browser Cache

**In browser console (F12):**
```javascript
localStorage.removeItem('seenSignals_a7982c70-2b0e-46af-a0ad-c78f4f69cd56');
console.log('✅ Cleared localStorage');
```

### Step 3: Trigger Fresh Sync

**In terminal:**
```bash
# Process RSS feeds (generates new signals)
curl "http://localhost:3000/api/rss-processor?show_id=a7982c70-2b0e-46af-a0ad-c78f4f69cd56"
```

**Or use UI:**
1. Go to `http://localhost:3000/studio?showId=a7982c70-2b0e-46af-a0ad-c78f4f69cd56`
2. Click "Refresh Signals" (if available)

### Step 4: Verify Fresh Data

**In Supabase SQL Editor:**
```sql
-- Check new signals were created
SELECT COUNT(*) as new_signals_count, 
       MIN(created_at) as oldest,
       MAX(created_at) as newest
FROM signals 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';

-- Check signals by score
SELECT 
  CASE 
    WHEN score >= 80 THEN 'High (80+)'
    WHEN score >= 70 THEN 'Medium (70-79)'
    WHEN score >= 60 THEN 'Low (60-69)'
    ELSE 'Very Low (<60)'
  END as score_range,
  COUNT(*) as count
FROM signals 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'
GROUP BY score_range
ORDER BY score_range DESC;
```

---

## 7. Recommendation: What to Keep

### ✅ KEEP (Needed for Features):
- **`recommendation_feedback`** - User feedback helps learning system improve
- **`signal_sources`** - RSS feed configuration
- **`show_dna`** - DNA topics (needed for scoring)
- **`show_behavior_patterns`** - Behavior patterns (used for matching)
- **`competitors`** + **`competitor_videos`** - Needed for competitor signals
- **`channel_videos`** - Needed for freshness signals ("You haven't covered this")

### ❌ CLEAR (Safe to Delete):
- **`signals`** - Main ideas/signals (regenerated from RSS)
- **`pitches`** - Cached pitches (regenerated on-demand)
- **`saved_ideas`** - Saved ideas (can be re-saved)

---

## 8. Expected Results After Clearing

**Before:**
- N signals in database (old data)
- Old scores, old feedback
- Cached pitches

**After:**
- 0 signals (fresh start)
- New RSS processing
- Fresh scores with updated keyword matching (2+ keywords required)
- Better topic relevance (validated evidence)

**After Fresh Sync:**
- 5-21 new signals (depending on RSS feeds and filters)
- Scores 0-100 (computed with new 2+ keyword requirement)
- Only topic-relevant matches (validated evidence)

---

## 9. Troubleshooting

### Issue: "No signals found after clearing"
**Solution**: Check if RSS feeds are configured:
```sql
SELECT COUNT(*) as rss_feeds_count
FROM signal_sources 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56' AND enabled = true;
```

If 0, sync RSS feeds first:
```bash
curl -X POST http://localhost:3000/api/sync-rss-feeds \
  -H "Content-Type: application/json" \
  -d '{"show_id": "a7982c70-2b0e-46af-a0ad-c78f4f69cd56"}'
```

### Issue: "Signals still showing old data"
**Solution**: 
1. Check browser localStorage (clear it)
2. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
3. Check if API cache headers are set (should be no-cache)

### Issue: "RSS processor returns 0 saved signals"
**Check**:
1. Are RSS feeds enabled? `SELECT * FROM signal_sources WHERE show_id = '...' AND enabled = true;`
2. Check server logs for filtering reasons (score threshold, priority filter, deduplication)
3. Check if signals already exist (deduplication might be blocking)

---

## 10. Quick Reference Commands

### Clear Everything (Complete Reset):
```sql
DELETE FROM pitches WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
DELETE FROM saved_ideas WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
DELETE FROM signals WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
DELETE FROM recommendation_feedback WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
```

### Clear Browser Cache:
```javascript
localStorage.removeItem('seenSignals_a7982c70-2b0e-46af-a0ad-c78f4f69cd56');
```

### Trigger Fresh Sync:
```bash
curl "http://localhost:3000/api/rss-processor?show_id=a7982c70-2b0e-46af-a0ad-c78f4f69cd56"
```

### Verify Clearing:
```sql
SELECT 
  (SELECT COUNT(*) FROM signals WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56') as signals,
  (SELECT COUNT(*) FROM pitches WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56') as pitches,
  (SELECT COUNT(*) FROM saved_ideas WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56') as saved_ideas,
  (SELECT COUNT(*) FROM recommendation_feedback WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56') as feedback;
```

All should return `0` after clearing (except feedback if you kept it).
