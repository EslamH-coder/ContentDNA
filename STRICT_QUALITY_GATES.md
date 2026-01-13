# Strict Quality Gates

## Problem Solved

**Before:** 344 RSS items → Too much noise, hard to find signal

**After:** 344 items → 5-10 strong ideas (strict quality gates)

## How It Works

### 6 Quality Gates (All Must Pass)

```
344 items
  ↓
Gate 1: Topic DNA Match (reject unknown/losing topics)
  ↓ ~120 items
Gate 2: Story Clarity (reject unclear narratives)
  ↓ ~90 items
Gate 3: Arab Relevance (reject non-Arab news)
  ↓ ~45 items
Gate 4: Specificity (reject vague items)
  ↓ ~25 items
Gate 5: Hook Potential (reject weak hooks)
  ↓ ~15 items
Gate 6: Uniqueness (one per topic)
  ↓ ~10 items
Score >= 75
  ↓
5-10 strong ideas ✓
```

## Gate Details

### Gate 1: Topic DNA Match
- ✅ Must have topic match (confidence ≥ 35%)
- ✅ Topic must be in DNA (not losing topic)
- ❌ Reject: No topic, low confidence, losing topic

### Gate 2: Story Type Clarity
- ✅ Must have clear story type (confidence ≥ 25%)
- ❌ Reject: Unclear narrative angle

### Gate 3: Arab Relevance (STRICT)
- ✅ Direct Arab region mention (Saudi, UAE, Egypt, etc.)
- ✅ Global topics affecting Arabs (oil, dollar, gold, trade war)
- ✅ Major entities + numbers (Tesla, Apple, etc.)
- ❌ Reject: No Arab relevance

### Gate 4: Specificity
- ✅ Must have numbers (≥100 or billion/million) OR major entities
- ✅ Timeline/date preferred
- ❌ Reject: Too vague (score < 30)

### Gate 5: Hook Potential
- ✅ Must match high-performing hook patterns from DNA
- ✅ Story type → Hook mapping (THREAT → Threat Claim, etc.)
- ❌ Reject: No strong hook match

### Gate 6: Uniqueness
- ✅ Only best item per topic
- ✅ Keeps highest scoring item for each topic

## Configuration

### Normal (Recommended)
```javascript
{
  useStrictGates: true,
  maxResults: 10,
  minScore: 75
}
```

### Very Strict (Only Best)
```javascript
{
  useStrictGates: true,
  maxResults: 5,
  minScore: 85
}
```

### Lenient (For Testing)
```javascript
{
  useStrictGates: true,
  maxResults: 20,
  minScore: 60
}
```

## Integration

The strict gates are automatically applied when:
- Processing more than 20 items per feed
- Using the recommendation engine

You'll see logs like:
```
🎯 STRICT QUALITY GATES APPLIED:
   344 items → 8 strong ideas
   Topic DNA Match: 120 passed, 224 rejected
   Story Clarity: 90 passed, 30 rejected
   Arab Relevance: 45 passed, 45 rejected
   Specificity: 25 passed, 20 rejected
   Hook Potential: 15 passed, 10 rejected
   Uniqueness: 10 passed, 5 rejected
   Score >= 75: 8 passed, 2 rejected
```

## Files Created

- `lib/filters/qualityGates.js` - All 6 gate functions
- `lib/filters/strictPipeline.js` - Main filtering pipeline
- Integrated into `smartPipeline.js` and RSS processor

## Benefits

✅ **Signal, not noise** - Only high-quality ideas
✅ **Arab-focused** - Only relevant content
✅ **DNA-aligned** - Matches channel DNA
✅ **Specific** - Numbers, entities, timelines
✅ **Hook-optimized** - Uses high-performing hooks
✅ **Unique** - One per topic (no duplicates)

## Expected Results

**Input:** 344 RSS items

**Output:** 5-10 strong ideas

**Rejection breakdown:**
- ~224: Topic doesn't fit DNA
- ~30: Unclear story
- ~45: No Arab relevance
- ~20: Too vague
- ~10: Weak hook
- ~5: Duplicate topic
- ~2: Low score

**Final:** 8 strong ideas ✓

