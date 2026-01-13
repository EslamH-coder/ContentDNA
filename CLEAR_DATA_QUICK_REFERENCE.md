# Quick Reference: Clear Ideas/Signals Data

**Show ID:** `a7982c70-2b0e-46af-a0ad-c78f4f69cd56`

---

## ✅ EXACT COMMANDS TO RUN

### 1. Check Current Data (Before Clearing)

**Run in Supabase SQL Editor:**
```sql
-- Quick count check
SELECT 
  'signals' as table_name,
  COUNT(*) as count
FROM signals 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'
UNION ALL
SELECT 'pitches', COUNT(*) FROM pitches WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'
UNION ALL
SELECT 'saved_ideas', COUNT(*) FROM saved_ideas WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'
UNION ALL
SELECT 'feedback', COUNT(*) FROM recommendation_feedback WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
```

---

### 2. Clear Data (Choose Option)

#### Option A: Clear Signals Only (Recommended)
```sql
DELETE FROM signals WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
```

#### Option B: Clear Signals + Pitches + Saved Ideas (Keep Feedback)
```sql
DELETE FROM pitches WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
DELETE FROM saved_ideas WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
DELETE FROM signals WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
```

#### Option C: Complete Reset (Everything)
```sql
DELETE FROM pitches WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
DELETE FROM saved_ideas WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
DELETE FROM signals WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
DELETE FROM recommendation_feedback WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
```

---

### 3. Clear Browser Cache

**Run in browser console (F12):**
```javascript
localStorage.removeItem('seenSignals_a7982c70-2b0e-46af-a0ad-c78f4f69cd56');
console.log('✅ Cleared localStorage');
```

---

### 4. Trigger Fresh Sync

**Option A: API Endpoint (Recommended)**
```bash
curl "http://localhost:3000/api/rss-processor?show_id=a7982c70-2b0e-46af-a0ad-c78f4f69cd56"
```

**Option B: UI Button**
1. Go to: `http://localhost:3000/studio?showId=a7982c70-2b0e-46af-a0ad-c78f4f69cd56`
2. Click "🔄 Refresh Signals" button (top right)

**Option C: Refresh Signals Endpoint**
```bash
curl "http://localhost:3000/api/signals/refresh?show_id=a7982c70-2b0e-46af-a0ad-c78f4f69cd56"
```

---

## 📊 TABLES SUMMARY

| Table | Purpose | Clear? | Recommendation |
|-------|---------|--------|----------------|
| **`signals`** | Main ideas/signals | ✅ YES | **Clear for fresh start** |
| **`pitches`** | Cached pitches | ✅ YES | Clear to regenerate |
| **`saved_ideas`** | Saved ideas | ✅ YES | Clear if needed |
| **`recommendation_feedback`** | User feedback | ⚠️ OPTIONAL | **Keep for learning** |
| **`signal_sources`** | RSS feed config | ❌ NO | **Keep - needed** |
| **`show_dna`** | DNA topics | ❌ NO | **Keep - needed for scoring** |
| **`show_behavior_patterns`** | Behavior patterns | ❌ NO | **Keep - needed for matching** |
| **`show_learning_weights`** | Learned weights | ❌ NO | **Keep - improves scoring** |
| **`competitors`** + **`competitor_videos`** | Competitor data | ❌ NO | **Keep - needed for competitor signals** |
| **`channel_videos`** | User's videos | ❌ NO | **Keep - needed for freshness signals** |

---

## 🔍 CACHED DATA LOCATIONS

### ✅ Client-Side (Browser):
- **localStorage**: `seenSignals_${showId}`
- **Clear**: `localStorage.removeItem('seenSignals_a7982c70-2b0e-46af-a0ad-c78f4f69cd56');`

### ✅ Server-Side (Database):
- **`pitches` table**: Cached generated pitches
- **`signals.is_visible`**: Computed on-the-fly (no cache)
- **`signals.relevance_score`**: Computed on-the-fly (no cache)

### ❌ No External Cache:
- No Redis
- No server-side cache
- All scores computed on-the-fly

---

## 🎯 RECOMMENDED WORKFLOW

```bash
# Step 1: Clear database (run in Supabase SQL Editor)
DELETE FROM signals WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
DELETE FROM pitches WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';

# Step 2: Clear browser cache (run in browser console)
localStorage.removeItem('seenSignals_a7982c70-2b0e-46af-a0ad-c78f4f69cd56');

# Step 3: Trigger fresh sync (run in terminal)
curl "http://localhost:3000/api/rss-processor?show_id=a7982c70-2b0e-46af-a0ad-c78f4f69cd56"

# Step 4: Verify (run in Supabase SQL Editor)
SELECT COUNT(*) as new_signals FROM signals WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
```

---

## 📝 NOTES

- **Feedback**: Keep `recommendation_feedback` unless you want to reset learning system
- **DNA/Patterns**: Keep `show_dna`, `show_behavior_patterns`, `show_learning_weights` - needed for scoring
- **Competitors**: Keep competitor tables - needed for competitor signals
- **Videos**: Keep `channel_videos` - needed for "You haven't covered this" signals

---

## 🚨 AFTER CLEARING

**New keyword matching rules apply:**
- ✅ Requires **2+ meaningful keywords** (not 1)
- ✅ Filters out stop words ("about", "week", "says", etc.)
- ✅ Validates topic relevance
- ✅ Prioritizes topic-specific keywords

**Expected results:**
- Fewer but more relevant signals
- Better topic matching
- No false matches on generic words
