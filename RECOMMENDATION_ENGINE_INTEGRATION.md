# Recommendation Engine Integration

The RSS processor now uses the DNA-based recommendation engine instead of generic angle generation.

## How It Works

1. **Fetches RSS items** from your configured sources
2. **Runs recommendation engine** (classify → filter → enrich → generate)
3. **Saves only HIGH/MEDIUM priority** recommendations to signals table
4. **Stores recommended titles** (not raw RSS titles)
5. **Falls back to old scoring** if DNA is not available

## What Changed

### Before:
- Generic "Arab angle" generation
- Simple DNA scoring (0-10 scale)
- Saved items with score >= 7.0

### After:
- DNA-based topic classification
- Multi-stage filtering (topic match, regional relevance, hook signals)
- Confidence scoring (0-100 scale)
- Only saves HIGH/MEDIUM priority items
- Uses recommended titles from DNA hook patterns

## How to Use

### 1. Process RSS Feeds (Same as Before)

```bash
# Process for a specific show
GET http://localhost:3000/api/rss-processor?show_id=YOUR_SHOW_ID

# Process all shows
GET http://localhost:3000/api/rss-processor?all=true
```

### 2. Check Results

The response now includes:
- `recommended`: Items that passed DNA filters
- `rejected`: Items that didn't match DNA
- `priority`: HIGH, MEDIUM, or LOW
- `recommended_title`: DNA-based title (not raw RSS title)

### 3. View in Signals Page

Go to `/signals` page - you'll see:
- **Recommended titles** (DNA-based, not raw RSS)
- **Priority badges** (HIGH/MEDIUM)
- **Confidence scores** (0-100)
- **Topic classifications**

## What Gets Stored

Each signal now includes in `raw_data.recommendation`:
- `priority`: HIGH, MEDIUM, or LOW
- `topic`: DNA topic ID
- `hook_type`: Recommended hook pattern
- `format`: long_form, short_form, or both
- `confidence`: 0-100 score
- `arab_angle`: Regional relevance angle
- `classification`: Topic, entities, signals
- `decisions`: Hook, format, triggers decisions
- `output`: Generated title, hook script, thumbnail text

## Fallback Behavior

If DNA is not available or recommendation engine fails:
- Falls back to old scoring method
- Uses simple DNA scoring (0-10 scale)
- Saves items with score >= 7.0

## Console Output

You'll see logs like:
```
🎯 Using recommendation engine for 40 items...
✅ Recommendations: 12 recommended, 28 rejected
   HIGH: 5, MEDIUM: 7, LOW: 0
✅ Recommended: "5,000 سيارة | دبي في خطر..." | Priority: HIGH | Confidence: 85.2 | Topic: ai_automation_jobs
  ✅ Saved: "5,000 سيارة | دبي في خطر..." (Priority: HIGH, Score: 85)
```

## Next Steps

1. **Run RSS processor** to see recommendations
2. **Check signals page** to see DNA-based titles
3. **Review recommendations** - HIGH priority items are ready to produce
4. **Adjust DNA** if needed (recalculate DNA from videos)

