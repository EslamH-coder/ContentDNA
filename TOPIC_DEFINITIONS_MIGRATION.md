# Topic Definitions Migration Guide

## Overview

The system has been refactored to use `topic_definitions` as the **single source of truth** for DNA topics, replacing the deprecated `show_dna.topics` field.

## Changes Made

### 1. New Service Function: `loadDnaTopics()`

**Location:** `/lib/scoring/signalScoringService.js`

**Function:**
```javascript
export async function loadDnaTopics(supabase, showId)
```

**What it does:**
- Loads DNA topics directly from `topic_definitions` table
- Filters for active topics only (`is_active = true`)
- Validates that topics have required fields (`topic_id`, `keywords`)
- Returns clean, validated array of topics

**Usage:**
```javascript
import { loadDnaTopics } from '@/lib/scoring/signalScoringService';

const dnaTopics = await loadDnaTopics(supabase, showId);
```

### 2. New Learning Function: `learnKeywordForTopic()`

**Location:** `/lib/scoring/signalScoringService.js`

**Function:**
```javascript
export async function learnKeywordForTopic(supabase, showId, topicId, newKeyword)
```

**What it does:**
- Adds a new keyword to a topic's `keywords` array in `topic_definitions`
- Checks for duplicates before adding
- Updates `updated_at` timestamp

**Usage:**
```javascript
import { learnKeywordForTopic } from '@/lib/scoring/signalScoringService';

// When system learns that "sanctions" is important for Iran stories
await learnKeywordForTopic(supabase, showId, 'iran_oil_sanctions', 'sanctions');
```

### 3. Updated Routes

**Both routes now load from `topic_definitions`:**

#### `/app/api/signals/route.js`
- **Before:** Complex logic to parse `show_dna.topics` in various formats
- **After:** Simple call to `loadDnaTopics()`
- **Fallback:** Still supports `show_dna.topics` for backwards compatibility

#### `/app/api/studio/signals/route.js`
- **Before:** Loaded from `show_dna.topics`
- **After:** Uses `loadDnaTopics()` from service
- **Fallback:** Still supports `show_dna.topics` for backwards compatibility

### 4. Updated Scoring Service

**`signalScoringService.js` now:**
- Automatically loads DNA topics from `topic_definitions` if not provided
- Uses `topic_definitions` structure directly (no conversion needed)
- Supports learning new keywords and writing back to `topic_definitions`

## Topic Definitions Structure

### Database Schema

```sql
CREATE TABLE topic_definitions (
  id uuid PRIMARY KEY,
  show_id uuid REFERENCES shows(id),
  topic_id text NOT NULL,           -- e.g., 'iran_oil_sanctions'
  topic_name_en text,               -- e.g., 'Iran & Oil Sanctions'
  topic_name_ar text,               -- e.g., 'إيران والنفط والعقوبات'
  keywords jsonb DEFAULT '[]',      -- ['iran', 'oil', 'sanctions', 'إيران', ...]
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz,
  updated_at timestamptz
);
```

### Expected Format

Each topic in `topic_definitions` should have:
```javascript
{
  topic_id: 'iran_oil_sanctions',
  topic_name_en: 'Iran & Oil Sanctions',
  topic_name_ar: 'إيران والنفط والعقوبات',
  keywords: ['iran', 'oil', 'sanctions', 'إيران', 'نفط', 'عقوبات'],
  description: 'Stories about Iran, oil, and sanctions',
  is_active: true
}
```

## Migration Steps

### Step 1: Verify `topic_definitions` Table Exists

```sql
SELECT COUNT(*) FROM topic_definitions WHERE show_id = 'your-show-id';
```

### Step 2: Ensure Topics Are Active

```sql
UPDATE topic_definitions 
SET is_active = true 
WHERE show_id = 'your-show-id' 
  AND is_active IS NULL;
```

### Step 3: Verify Topic Structure

```sql
SELECT 
  topic_id,
  topic_name_en,
  array_length(keywords, 1) as keyword_count,
  is_active
FROM topic_definitions
WHERE show_id = 'your-show-id'
ORDER BY topic_name_en;
```

### Step 4: Test Loading

Check terminal logs when loading signals:
```
📚 Loaded X DNA topics from topic_definitions (Y invalid filtered out)
```

## Benefits

### 1. Single Source of Truth
- **Before:** Data duplicated in `show_dna.topics` and `topic_definitions`
- **After:** Only `topic_definitions` is used

### 2. Automatic Learning
- System can learn new keywords and write them back
- No manual updates needed

### 3. Better Validation
- Topics are validated when loaded
- Invalid topics are filtered out automatically

### 4. Easier Maintenance
- Update topics in one place (`topic_definitions`)
- No need to sync `show_dna.topics`

## Backwards Compatibility

Both routes still support `show_dna.topics` as a fallback:
- If `topic_definitions` is empty, falls back to `show_dna.topics`
- Logs a warning when using deprecated source
- Allows gradual migration

## DNA Matching

The `findDnaMatch()` function in `multiSignalScoring.js` now works directly with `topic_definitions` structure:

```javascript
// Each topic from topic_definitions has:
for (const dnaTopic of dnaTopics) {
  const topicId = dnaTopic.topic_id;           // 'iran_oil_sanctions'
  const topicNameEn = dnaTopic.topic_name_en;  // 'Iran & Oil Sanctions'
  const topicNameAr = dnaTopic.topic_name_ar;  // 'إيران والنفط والعقوبات'
  const keywords = dnaTopic.keywords || [];     // ['iran', 'oil', ...]
  
  // Match against AI fingerprint or keywords
}
```

## Learning Keywords

When the system learns a new keyword association:

```javascript
// Example: User likes an Iran story that mentions "sanctions"
// System learns: "sanctions" is important for "iran_oil_sanctions" topic

await learnKeywordForTopic(
  supabase,
  showId,
  'iran_oil_sanctions',
  'sanctions'
);
```

This adds "sanctions" to the `keywords` array in `topic_definitions`, making future matching more accurate.

## Testing

### 1. Verify Topics Load
```bash
# Check terminal logs for:
📚 Loaded X DNA topics from topic_definitions
```

### 2. Verify Matching Works
```bash
# Test with a signal that should match:
# Signal: "Iran sanctions news"
# Should match: topic "iran_oil_sanctions"
# Check logs for DNA match
```

### 3. Test Learning
```javascript
// Like a signal about Iran
// Check if system learns new keywords
// Verify in database:
SELECT keywords FROM topic_definitions 
WHERE topic_id = 'iran_oil_sanctions';
```

## Troubleshooting

### Issue: "No DNA topics found"
**Solution:**
1. Check `topic_definitions` table exists
2. Verify `show_id` matches
3. Check `is_active = true`
4. Verify topics have `topic_id` and `keywords`

### Issue: "Invalid topics filtered out"
**Solution:**
1. Check topic structure in database
2. Ensure `keywords` is a JSON array
3. Ensure `topic_id` is not null
4. Check logs for specific validation errors

### Issue: "Falling back to show_dna.topics"
**Solution:**
1. This is expected during migration
2. Migrate topics from `show_dna.topics` to `topic_definitions`
3. Verify topics are active in `topic_definitions`

## Next Steps

1. ✅ Service functions created
2. ✅ Routes updated to use `topic_definitions`
3. ⏳ Migrate existing topics from `show_dna.topics` to `topic_definitions`
4. ⏳ Test DNA matching with new structure
5. ⏳ Enable keyword learning in production
6. ⏳ Remove `show_dna.topics` dependency (optional, after migration complete)

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Source** | `show_dna.topics` (deprecated) | `topic_definitions` (single source) |
| **Loading** | Complex parsing logic | Simple `loadDnaTopics()` call |
| **Learning** | Manual updates | Automatic via `learnKeywordForTopic()` |
| **Validation** | Inconsistent | Automatic validation on load |
| **Maintenance** | Update two places | Update one place |
