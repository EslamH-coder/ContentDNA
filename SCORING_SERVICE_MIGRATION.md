# Scoring Service Migration Guide

## Overview

A unified scoring service has been created to consolidate scoring logic from both Ideas and Studio routes. This eliminates duplication and ensures consistency.

## Files Created

1. **`/lib/scoring/signalScoringService.js`** - Unified scoring service
2. **`CREATE_SIGNAL_FEEDBACK_PATTERNS_TABLE.sql`** - Database migration for learning patterns
3. **Updated `/app/api/feedback/route.js`** - Now uses `learnFromFeedback` function

## Database Migration

**Run this first:**
```sql
-- Execute CREATE_SIGNAL_FEEDBACK_PATTERNS_TABLE.sql in Supabase SQL Editor
```

This creates the `signal_feedback_patterns` table for storing learned patterns from user feedback.

## How the Service Works

### 1. AI Fingerprint Generation
- Automatically generates AI fingerprint for every signal
- 2-second timeout to avoid blocking
- Falls back gracefully if AI fails

### 2. Multi-Signal Scoring
- Competitor breakouts
- DNA matching (with AI fingerprint support)
- Saturation checks
- All existing scoring signals

### 3. Behavior Pattern Matching
- Automatically loads behavior patterns if not provided
- Applies learned pattern weights
- Adds boost to score

### 4. Learned Adjustments
- Applies learned weights from `show_learning_weights` table
- Category-based learning
- Topic-based learning
- Entity-based learning

### 5. Feedback Pattern Learning (NEW)
- Learns from like/reject actions
- Stores patterns in `signal_feedback_patterns` table
- Automatically boosts/penalizes similar signals

## Usage Example

### Basic Usage

```javascript
import { scoreSignal, scoreSignals } from '@/lib/scoring/signalScoringService';

// Score a single signal
const result = await scoreSignal(signal, {
  showId: 'your-show-id',
  dnaTopics: dnaTopics,
  competitorVideos: competitorVideos,
  userVideos: userVideos,
  supabase: supabaseAdmin
});

// Score multiple signals
const results = await scoreSignals(signals, {
  showId: 'your-show-id',
  dnaTopics: dnaTopics,
  competitorVideos: competitorVideos,
  userVideos: userVideos,
  supabase: supabaseAdmin
});
```

### Full Context Options

```javascript
const result = await scoreSignal(signal, {
  showId: 'your-show-id',
  dnaTopics: dnaTopics,
  competitorVideos: competitorVideos,
  userVideos: userVideos,
  learningWeights: learnedWeights, // Optional - will fetch if not provided
  behaviorPatterns: patterns, // Optional - will fetch if not provided
  supabase: supabaseAdmin, // Required for feedback pattern learning
  excludedNames: ['channel name'], // Optional - names to exclude from matching
  sourceUrl: signal.url, // Optional
  sourceTitle: signal.source, // Optional
  sourceCount: 1 // Optional
});
```

### Result Structure

```javascript
{
  score: 75, // Final score (0-100)
  signals: [...], // All scoring signals
  competitorBreakdown: {...},
  strategicLabel: 'high_priority',
  aiFingerprint: {...}, // AI-extracted entities
  patternMatches: [...], // Behavior pattern matches
  adjustments: [ // All adjustments applied
    { type: 'behavior_pattern', value: 5, details: '...' },
    { type: 'learned_adjustment', value: 10, details: '...' },
    { type: 'feedback_pattern', value: 10, details: '...' }
  ],
  learnedAdjustment: 10, // Total learned adjustment
  scoringMethod: 'unified_v1'
}
```

## Migration Steps

### Step 1: Update Ideas Route (`/app/api/signals/route.js`)

**Find this section (around line 1190):**
```javascript
const scoring = await calculateIdeaScore(signal, {
  competitorVideos: normalizedCompetitorVideos,
  userVideos: normalizedUserVideos,
  dnaTopics,
  // ... other params
}, excludedNames);
```

**Replace with:**
```javascript
import { scoreSignal } from '@/lib/scoring/signalScoringService';

// ... in the loop where signals are scored ...

const scoring = await scoreSignal(signal, {
  showId: showId,
  dnaTopics: dnaTopics,
  competitorVideos: normalizedCompetitorVideos,
  userVideos: normalizedUserVideos,
  supabase: supabaseAdmin,
  excludedNames: excludedNames,
  sourceUrl: sourceUrl,
  sourceTitle: sourceTitle,
  sourceCount: sourceCount
});
```

**Note:** The result structure is the same, so existing code should work with minimal changes.

### Step 2: Update Studio Route (`/app/api/studio/signals/route.js`)

**Find this section (around line 285-353):**
```javascript
// Generate AI fingerprint
const aiFingerprintPromise = generateTopicFingerprint({...});
// ... AI fingerprint logic ...

const scoringResult = await calculateIdeaScore(signal, {
  // ... params including aiFingerprint
}, excludedNames);
```

**Replace with:**
```javascript
import { scoreSignal } from '@/lib/scoring/signalScoringService';

// ... in the loop where signals are scored ...

const scoring = await scoreSignal(signal, {
  showId: showId,
  dnaTopics: dnaTopics,
  competitorVideos: normalizedCompetitorVideos,
  userVideos: normalizedUserVideos,
  supabase: supabaseAdmin,
  excludedNames: excludedNames,
  sourceUrl: signal.url || signal.source_url || signal.raw_data?.url || signal.raw_data?.link || null,
  sourceTitle: signal.source || signal.source_name || signal.raw_data?.sourceName || null,
  sourceCount: 1
});
```

**Note:** Remove the manual AI fingerprint generation code - it's now handled by the service.

### Step 3: Update Response Mapping

Both routes may need minor adjustments to map the result:

**Before:**
```javascript
const result = {
  ...signal,
  score: scoring.score,
  multi_signal_scoring: scoring,
  // ...
};
```

**After:**
```javascript
const result = {
  ...signal,
  score: scoring.score,
  final_score: scoring.score,
  multi_signal_scoring: {
    ...scoring,
    aiFingerprint: scoring.aiFingerprint, // Now included
    patternMatches: scoring.patternMatches, // Now included
    adjustments: scoring.adjustments // Now included
  },
  // ...
};
```

## Learning from Feedback

The feedback route (`/app/api/feedback/route.js`) has been updated to automatically learn from like/reject actions.

**When a user likes a signal:**
- System extracts entities (countries, topics, patterns)
- Creates/updates a "positive" pattern
- Future similar signals get +10 boost

**When a user rejects a signal:**
- System extracts entities (countries, topics, patterns)
- Creates/updates a "negative" pattern
- Future similar signals get -15 penalty

**Pattern matching:**
- Matches on countries (e.g., "Iran" → boosts all Iran stories)
- Matches on topics (e.g., "oil" → boosts all oil stories)
- Matches on title patterns (e.g., "signs agreement" → penalizes routine diplomatic news)

## Testing

### 1. Test Scoring
```bash
# Check terminal logs for:
🤖 AI extracted for "...": { countries: [...], topics: [...] }
📚 Learned feedback adjustment: +10 (1 patterns)
```

### 2. Test Learning
1. Like a few Iran stories
2. Check database: `SELECT * FROM signal_feedback_patterns WHERE show_id = '...' AND pattern_type = 'positive'`
3. New Iran stories should get +10 boost

### 3. Test Rejection Learning
1. Reject a few "signs agreement" stories
2. Check database: `SELECT * FROM signal_feedback_patterns WHERE pattern_type = 'negative' AND title_patterns @> '["signs agreement"]'`
3. New "signs agreement" stories should get -15 penalty

## Benefits

1. **Single source of truth** - No more sync issues between routes
2. **AI fingerprint always generated** - Better DNA matching
3. **Automatic learning** - System improves from user feedback
4. **Consistent scoring** - Both pages use exact same logic
5. **Easier maintenance** - Changes in one place affect both routes

## Rollback Plan

If issues occur, you can:
1. Revert route changes (keep old `calculateIdeaScore` calls)
2. Service is backward compatible - old code still works
3. Database table is additive - doesn't break existing functionality

## Next Steps

1. ✅ Run database migration
2. ⏳ Update Ideas route to use `scoreSignal`
3. ⏳ Update Studio route to use `scoreSignal`
4. ⏳ Test with real signals
5. ⏳ Monitor learning patterns in database
6. ⏳ Adjust boost/penalty values if needed

## Configuration

### Adjust Boost/Penalty Values

In `signalScoringService.js`, modify:
```javascript
score_boost: feedbackType === 'like' ? 10 : 0,  // Change 10 to desired boost
score_penalty: feedbackType === 'reject' ? -15 : 0, // Change -15 to desired penalty
```

### Add More Title Patterns

In `extractTitlePatterns()` function, add:
```javascript
{ pattern: 'your pattern', match: /your-regex/i },
```

## Support

If you encounter issues:
1. Check terminal logs for error messages
2. Verify database table exists: `SELECT * FROM signal_feedback_patterns LIMIT 1`
3. Check that `learnFromFeedback` is being called in feedback route
4. Verify AI fingerprint is being generated (check logs)
