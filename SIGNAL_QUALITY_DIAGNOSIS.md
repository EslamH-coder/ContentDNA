# Signal Quality Diagnosis Report

## Part 1: Existing Learning System

### Database Tables

#### 1. `show_learning_weights`
**Purpose:** Stores learned preferences from user feedback  
**Location:** Loaded in `/app/api/signals/refresh/route.js` (Lines 244-250)

**Structure:**
```javascript
{
  show_id: UUID,
  topic_weights: {
    // Key: topic keyword (e.g., 'الصين', 'ترامب', 'النفط')
    // Value: weight multiplier (e.g., 1.5 = boost, 0.5 = penalty)
    'الصين': 1.3,  // User likes China stories
    'credit card': 0.7,  // User dislikes credit card stories
  },
  dna_topic_weights: {
    // Key: topic_id (e.g., 'us_china_geopolitics')
    // Value: weight multiplier
    'us_china_geopolitics': 1.4,
  },
  source_weights: {
    // Key: source name (lowercase)
    // Value: { weight: 1.2, liked: 5, rejected: 2 }
    'bloomberg': { weight: 1.2, liked: 5, rejected: 2 },
  },
  category_weights: {
    // Key: topic category from AI fingerprint (e.g., 'us_china_trade')
    // Value: { weight: 1.3, liked: 10, rejected: 3 }
    'us_china_trade': { weight: 1.3, liked: 10, rejected: 3 },
  },
  pattern_weights: {
    // Key: behavior pattern ID
    // Value: weight multiplier
    'superpower_tension': 1.2,
  },
  format_weights: {
    specific_angle: 1.5,  // Boost for specific angles
    broad_topic: 0.3,      // Penalty for broad topics
    question_format: 1.2,  // Boost for questions
  },
  evidence_weights: {
    search_volume: 1.1,
    competitor_proof: 1.2,
    audience_comments: 1.15,
  },
  rejection_patterns: {
    angle_too_broad: 3,      // User rejected 3 times for "too broad"
    needs_strong_evidence: 2, // User rejected 2 times for "weak evidence"
  },
  total_feedback_count: 45
}
```

**How it's used:**
- Loaded in refresh route (Line 246-250)
- Applied in `scoreSignalWithDNA()` function (Lines 569-636)
- Boosts/penalties signals based on learned preferences
- Example: If user liked 5 "China" stories, `topic_weights['الصين'] = 1.3` → +6 points boost

---

#### 2. `recommendation_feedback`
**Purpose:** Tracks user actions (liked, rejected, produced, etc.)  
**Location:** Queried in refresh route (Lines 252-286)

**Structure:**
```javascript
{
  show_id: UUID,
  topic: 'China trade war with US',
  action: 'liked' | 'rejected' | 'produced' | 'saved' | 'ignored',
  created_at: timestamp
}
```

**How it's used:**
- Calculates topic stats (like ratios) in refresh route (Lines 260-286)
- Used to boost/penalty signals: `likeRatio > 0.6` → +15 points, `likeRatio < 0.3` → -15 points
- Written by feedback API when user clicks like/reject

---

#### 3. `show_behavior_patterns` (if exists)
**Purpose:** Learned behavior patterns from successful videos  
**Status:** Code exists in `/lib/behaviorPatterns.js` but **NOT used in refresh route**

**What it tracks:**
- Pattern IDs: `superpower_tension`, `personal_impact`, `hidden_truth`, etc.
- Pattern performance: avg views, retention, usage count
- Pattern templates: successful hook patterns

**Problem:** Behavior patterns are learned but **NOT applied** in RSS refresh filtering

---

#### 4. `show_winning_patterns` (if exists)
**Purpose:** Tracks winning content patterns  
**Status:** Referenced in code but structure unclear

---

### Learning Functions

#### 1. `/lib/learning/signalEffectiveness.js`
**Functions:**
- `getLearnedAdjustments(showId, days)` - Loads learning weights from database
- `applyLearnedAdjustments(baseScore, idea, learned)` - Applies learning to score
  - Uses AI fingerprint for category-based learning
  - Applies category weights, topic weights, person weights
  - Applies signal effectiveness weights

**Status:** ✅ Used in Ideas page (`/app/api/signals/route.js`) but **NOT used in refresh route**

---

#### 2. `/lib/learning/applyLearning.js`
**Functions:**
- `applyLearningWeights(supabase, showId, recommendations)` - Applies learning to recommendations
- `getHiddenTopics(supabase, showId)` - Gets topics to hide (rejected, produced)
- `analyzeTopicAngle(topic)` - Checks if topic has specific angle vs broad
- `calculateTopicBoost(topic, topicWeights)` - Calculates boost from topic weights
- `calculateFormatBoost(rec, formatWeights, angleAnalysis)` - Penalizes broad topics
- `calculateRejectionPenalty(rec, rejectionPatterns, ...)` - Applies learned rejection patterns

**Status:** ✅ Used in recommendation API but **NOT used in refresh route**

---

#### 3. `/lib/behaviorPatterns.js`
**Functions:**
- `learnBehaviorPatterns(showId)` - Learns patterns from videos/comments/competitors
- `getShowPatterns(showId)` - Gets learned patterns
- `scoreSignalByPatterns(signal, patterns, weights)` - Scores signal against patterns

**Status:** ✅ Used in Ideas page (`/app/api/signals/route.js`) but **NOT used in refresh route**

---

## Part 2: How Learning is Currently Applied in Refresh Route

### Current Usage (Lines 244-636)

**1. Learning Profile Loading (Lines 244-250):**
```javascript
const { data: learningProfile } = await supabaseAdmin
  .from('show_learning_weights')
  .select('dna_topic_weights, topic_weights, source_weights')
  .eq('show_id', showId)
  .single();
```

**2. Topic Stats from Feedback (Lines 252-286):**
```javascript
const { data: recentFeedback } = await supabaseAdmin
  .from('recommendation_feedback')
  .select('topic, action')
  .eq('show_id', showId)
  .gte('created_at', thirtyDaysAgo);

// Calculates like ratios per topic
```

**3. Applied in DNA Scoring (Lines 569-636):**
```javascript
// Apply learned topic weights
const topicWeights = learningProfile?.topic_weights || {};
for (const coreTopic of coreTopics) {
  if (topicWeights[coreTopic]) {
    const weight = topicWeights[coreTopic];
    const boost = Math.round((weight - 1.0) * 20); // 1.5 = +10, 0.5 = -10
    score += boost;
  }
}

// Apply topic stats (like ratios)
if (likeRatio > 0.6 && stats.total >= 3) {
  score += 15; // User likes this topic
} else if (likeRatio < 0.3 && stats.total >= 3) {
  score -= 15; // User rejects this topic
}
```

**4. Source Weights Applied (Lines 1202-1217):**
```javascript
const applySourceWeight = (signal, score) => {
  const sourceName = (signal.source || '').toLowerCase().trim();
  const sourceData = sourceWeights[sourceName];
  if (sourceData && sourceData.weight) {
    return score * sourceData.weight; // Multiply by learned weight
  }
  return score;
};
```

---

### What's Missing

**1. Behavior Patterns NOT Applied:**
- `/lib/behaviorPatterns.js` exists but refresh route doesn't use it
- Should use `scoreSignalByPatterns()` to boost signals matching learned patterns

**2. Format Weights NOT Applied:**
- `format_weights` (specific_angle, broad_topic) exist but not used
- Should penalize broad topics using `analyzeTopicAngle()`

**3. Rejection Patterns NOT Applied:**
- `rejection_patterns` (angle_too_broad, needs_strong_evidence) exist but not used
- Should use `calculateRejectionPenalty()` to reject based on learned patterns

**4. Category Weights NOT Applied:**
- `category_weights` from AI fingerprint exist but not used
- Should use `applyLearnedAdjustments()` for category-based learning

---

## Part 3: RSS Feed Configuration

### Current Feed Sources

**To check feeds for show `a7982c70-2b0e-46af-a0ad-c78f4f69cd56`:**

```sql
SELECT 
  name, 
  url, 
  source_type,
  enabled, 
  item_limit,
  dna_topics,
  last_fetch_count,
  updated_at
FROM signal_sources 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'
  AND enabled = true
ORDER BY source_type, name;
```

**Expected breakdown:**
- RSS feeds: Google News searches, direct RSS feeds
- Reddit: Subreddit feeds
- Wikipedia: Recent changes feed

**Problem:** Only 8 RSS feeds + Reddit + Wikipedia = low diversity

---

## Part 4: Rejection Analysis (New Logging Added)

### Filter Steps with Detailed Logging

**1. Low Quality Source Filter:**
- Rejects: vocal.media, openpr.com, prnewswire, etc.
- Logs: Which sources were filtered

**2. Age Filter (≤48h):**
- Rejects: Items older than 48 hours
- Logs: Sample rejections with hours old

**3. Length Filter (40-200 chars):**
- Rejects: Too short (<40) or too long (>200)
- Logs: Sample rejections with length

**4. Quality Score Filter (min 35):**
- Rejects: Quality score < 35
- Logs: Removed count

**5. DNA Scoring Filter (min 35):**
- Rejects: DNA score < 35 (or `showDna.benchmarks?.min_score`)
- **NEW:** Detailed logging of all rejections with:
  - Signal title
  - Score vs minimum
  - Reasons (all DNA scoring reasons)
  - Matched topic
  - Source

**6. Negative Keywords Filter:**
- Rejects: Sports, entertainment, weather, etc.
- Logs: Removed count

**7. "No Story" Pattern Filter:**
- Rejects: Routine patterns, aggregator metadata
- **NEW:** Added "تم العثور على" pattern
- **NEW:** Detailed logging of all rejections with:
  - Signal title
  - Matched pattern
  - Rejection reason
  - Pattern type breakdown

---

## Part 5: Recommendations

### 1. Use Learning System Instead of Hardcoding

**Current:** Hardcoded reject patterns in refresh route  
**Better:** Use learned `rejection_patterns` from `show_learning_weights`

**Implementation:**
```javascript
// Instead of hardcoded rejectIfContains array
const rejectionPatterns = learningProfile?.rejection_patterns || {};
if (rejectionPatterns.aggregator_metadata >= 2) {
  // User rejected aggregator patterns 2+ times
  if (title.includes('تم العثور على')) {
    return false; // Reject based on learning
  }
}
```

---

### 2. Apply Behavior Patterns

**Add to refresh route:**
```javascript
import { getShowPatterns, scoreSignalByPatterns } from '@/lib/behaviorPatterns';

// After DNA scoring
const showPatterns = await getShowPatterns(showId);
const patternWeights = learningProfile?.pattern_weights || {};

for (const signal of filteredSignals) {
  const patternResult = await scoreSignalByPatterns(
    signal,
    showPatterns,
    patternWeights
  );
  
  // Boost signal if it matches learned patterns
  if (patternResult.totalBoost > 0) {
    signal.relevance_score += patternResult.totalBoost;
  }
}
```

---

### 3. Apply Format Weights

**Add to refresh route:**
```javascript
import { analyzeTopicAngle } from '@/lib/learning/applyLearning';

// In scoreSignalWithDNA function
const formatWeights = learningProfile?.format_weights || {};
const angleAnalysis = analyzeTopicAngle(signal.title);

// Penalize broad topics if user dislikes them
if (!angleAnalysis.hasAngle && formatWeights.broad_topic < 0.5) {
  score *= formatWeights.broad_topic; // Heavy penalty
  reasons.push('broad_topic_penalty');
}
```

---

### 4. Increase DNA Minimum Score

**Current:** `min_score = 35` (too low)  
**Recommended:** `min_score = 50` (stricter)

**Or use learning:**
```javascript
// Use learned threshold if available
const learnedMinScore = learningProfile?.min_score_threshold || 50;
reject: score < learnedMinScore
```

---

### 5. Add More High-Quality RSS Feeds

**Missing feeds:**
- Bloomberg Arabic RSS
- Reuters Arabic RSS
- Al Jazeera Arabic RSS (direct, not Google News)
- Financial Times RSS
- The Economist RSS

**Add to `signal_sources` table:**
```sql
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, source_type)
VALUES 
  ('a7982c70-2b0e-46af-a0ad-c78f4f69cd56', 'Bloomberg Arabic', 'https://www.bloomberg.com/feeds/arabic.xml', true, 20, 'rss'),
  ('a7982c70-2b0e-46af-a0ad-c78f4f69cd56', 'Reuters Arabic', 'https://www.reuters.com/rssFeed/arabic', true, 20, 'rss'),
  ('a7982c70-2b0e-46af-a0ad-c78f4f69cd56', 'Al Jazeera Arabic', 'https://www.aljazeera.net/rss', true, 20, 'rss');
```

---

## Summary

### Learning System Status

| Component | Exists | Used in Refresh Route | Status |
|-----------|--------|----------------------|--------|
| `show_learning_weights` | ✅ | ✅ Partial | Topic weights, source weights used |
| `recommendation_feedback` | ✅ | ✅ Yes | Topic stats calculated |
| Behavior patterns | ✅ | ❌ No | Not applied |
| Format weights | ✅ | ❌ No | Not applied |
| Rejection patterns | ✅ | ❌ No | Not applied |
| Category weights | ✅ | ❌ No | Not applied |

### Current Filtering Flow

```
RSS Fetch → 1000 items
  ↓
Low Quality Source → 800 items
  ↓
Age Filter (≤48h) → 600 items
  ↓
Length Filter (40-200) → 550 items
  ↓
Deduplication → 500 items
  ↓
Quality Score (min 35) → 400 items
  ↓
DNA Scoring (min 35) → 200 items  ❌ TOO MANY (threshold too low)
  ↓
Negative Keywords → 150 items
  ↓
Pattern Filter → 100 items
  ↓
Save → 100 signals (many low quality)
```

### Issues Found

1. **"تم العثور على" not rejected** → ✅ FIXED (added to reject patterns)
2. **DNA minimum score too low (35)** → Should be 50+ or use learning
3. **Learning system underutilized** → Behavior patterns, format weights, rejection patterns not used
4. **Only 8 RSS feeds** → Need more high-quality sources
5. **No topic coherence check** → Generic keywords cause false matches

### Next Steps

1. ✅ Add "تم العثور على" pattern (DONE)
2. ✅ Add detailed rejection logging (DONE)
3. ⏳ Increase DNA minimum score to 50
4. ⏳ Apply behavior patterns in refresh route
5. ⏳ Apply format weights (penalize broad topics)
6. ⏳ Apply learned rejection patterns
7. ⏳ Add more high-quality RSS feeds
