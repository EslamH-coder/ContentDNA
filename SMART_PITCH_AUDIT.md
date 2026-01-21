# Smart Pitch System Audit Report

**Date:** 2025-01-XX  
**Purpose:** Understand existing smart pitch implementation for enhancement

---

## Executive Summary

A **smart pitch system exists** with the following components:
- **Main implementation:** `/lib/smartPitch.js` (1,109 lines)
- **API endpoint:** `/app/api/smart-pitch/route.js`
- **Studio page:** `/app/studio/page.jsx`
- **Database tables:** `show_winning_patterns`, `pitch_history`

The system generates pitches based on **winning patterns** from channel's successful videos, but **does NOT currently use**:
- ❌ Why Now evidence
- ❌ DNA match evidence  
- ❌ Competitor coverage (direct/indirect/trendsetter)
- ❌ Last covered by channel
- ❌ Proper evidence scoring

---

## File Inventory

### 1. `/lib/smartPitch.js` (Main Implementation)

**What it does:**
- Generates smart pitches for signals using winning patterns
- Uses OpenAI GPT-4o-mini to generate title variations
- Selects best pattern for each signal based on signal characteristics
- Predicts views and confidence based on pattern performance
- Saves pitches to `pitch_history` table

**What data it uses:**
- ✅ **Behavior patterns** (from `getShowWinningPatterns`)
- ✅ **Signal data** (title, description, score)
- ✅ **Similar successful videos** (from channel history)
- ✅ **Show data** (avg views, video count)
- ✅ **Topic fingerprints** (for matching)
- ⚠️ **Limited competitor data** (extracts from `signal.multi_signal_scoring.signals` but minimal)
- ❌ **No DNA match evidence**
- ❌ **No "Why Now" evidence**
- ❌ **No last covered timestamp**

**What it generates:**
- Title (Arabic)
- Angle (pattern formula)
- Reasoning (why this pattern)
- Content type (long_form/short_form)
- Predicted views
- Prediction confidence
- Similar video reference
- Evidence object (partial - only pattern + similar video)

**Key Functions:**
- `generateSmartPitches()` - Main entry point
- `generatePitchForPattern()` - Generate pitch using specific pattern
- `extractEvidenceFromSignal()` - Extract evidence (limited)
- `predictViews()` - Predict performance
- `calculateConfidence()` - Calculate prediction confidence

---

### 2. `/app/api/smart-pitch/route.js` (API Endpoint)

**What it does:**
- Handles POST requests for pitch generation
- Actions: `generate`, `analyze`, `getPatterns`
- Routes to `generateSmartPitches()` function

**Inputs:**
- `action`: 'generate' | 'analyze' | 'getPatterns'
- `showId`: UUID
- `signal`: Signal object
- `options`: Configuration options

**Outputs:**
- Pitches array with titles, patterns, predictions
- Pattern analysis results
- Winning patterns list

---

### 3. `/app/api/generate-pitch/route.js` (Alternative Pitch Generator)

**What it does:**
- **Different system** - Uses OpenAI directly
- Generates pitches from signal data
- Saves to `pitches` table (different from `pitch_history`)
- Uses prompt templates from `@/lib/pitchTemplates`

**What data it uses:**
- Signal (title, description, source)
- Show profile
- Topic definitions (DNA topics)
- Top performing videos (for style learning)

**What it generates:**
- Full pitch content (text)
- Pitch type (news/analysis/short)
- Saves to `pitches` table

**Note:** This is a **simpler system** that doesn't use patterns or evidence.

---

### 4. `/app/studio/page.jsx` (Studio Page)

**What it does:**
- Displays signals organized by urgency tier
- Shows three tiers: Post Today, This Week, Evergreen
- Fetches signals from `/api/studio/signals`

**What it shows:**
- Tier sections with signals
- Signal cards (via `StudioCard` component)
- Refresh button

**Current state:** Basic UI, no pitch generation visible here

---

### 5. `/app/api/studio/signals/route.js` (Studio Signals API)

**What it does:**
- Fetches signals for Studio page
- Applies scoring and tiering
- Returns signals grouped by urgency tier

**What data it uses:**
- Signals from database
- DNA topics
- Competitor videos (fetches but may not use in pitch)
- User videos (for saturation check)
- Behavior patterns

**Output:**
- Signals grouped by tier (postToday, thisWeek, evergreen)

---

### 6. `/lib/pitchLearning.js` (Pitch Learning)

**What it does:**
- Records user feedback on pitches
- Updates pattern weights based on feedback
- Marks pitches as produced

**Functions:**
- `recordPitchFeedback()` - Record like/reject/save
- `markPitchProduced()` - Mark pitch as produced video

---

### 7. Database Tables

#### `show_winning_patterns`
- Stores analyzed winning patterns per show
- Fields: pattern_id, pattern_name, formula, success_rate, avg_views, example_titles
- Used to select best pattern for signal

#### `pitch_history`
- Tracks generated pitches and outcomes
- Fields: signal_id, pitch_title, pattern_id, predicted_views, actual_views, status
- Used for learning and feedback

---

## Current Evidence System (Limited)

### What EXISTS in `extractEvidenceFromSignal()`:

```javascript
evidence = {
  signal: {
    title, score, source
  },
  pattern: {
    reason, avgViews, videoCount, successRate
  },
  competitors: [...], // From multi_signal_scoring.signals
  competitorBoost: number,
  audienceDemand: {
    score, comments
  },
  similarVideo: {...}
}
```

### What's MISSING:

1. **Why Now evidence:**
   - ❌ No recency/urgency scoring
   - ❌ No time-sensitive indicators
   - ❌ No trending status

2. **DNA match evidence:**
   - ❌ No DNA keyword matching
   - ❌ No topic relevance scores
   - ❌ No matched topics list

3. **Competitor coverage:**
   - ⚠️ Partial - extracts from `signal.multi_signal_scoring.signals`
   - ❌ No distinction between direct/indirect/trendsetter
   - ❌ No competitor video details (titles, views, dates)
   - ❌ No coverage count

4. **Last covered by channel:**
   - ❌ No timestamp of last coverage
   - ❌ No days since last post
   - ❌ No saturation check result

5. **Evidence scoring:**
   - ❌ No proper scoring for each evidence type
   - ❌ No weighted evidence scores
   - ❌ No evidence strength indicators

---

## Answers to Specific Questions

### 1. Does smart pitch already exist? Where?

**YES** - Main implementation in `/lib/smartPitch.js`

### 2. What inputs does it take?

- `signal`: Signal object (title, description, score, etc.)
- `showId`: UUID
- `options`: { maxPitches, includeShortForm, includeLongForm, patternUsage }

### 3. What outputs does it generate?

- `title`: Arabic title
- `title_ar`: Same as title
- `angle`: Pattern formula
- `reasoning`: Why this pattern
- `contentType`: 'long_form' | 'short_form'
- `pattern`: Pattern info (id, name, successRate, avgViews)
- `predictedViews`: Predicted view count
- `predictionConfidence`: Confidence (0-1)
- `similarVideo`: Reference successful video
- `evidence`: Evidence object (limited)
- `whyThisWorks`: Array of reasons

### 4. Does it use:

- ✅ **Behavior patterns?** YES - `getShowWinningPatterns()`
- ⚠️ **Audience interests?** PARTIAL - extracts from signal but minimal
- ⚠️ **Competitor data?** PARTIAL - extracts from `multi_signal_scoring.signals` but limited
- ❌ **DNA matching?** NO - uses topic fingerprints but not DNA keywords
- ✅ **Video performance data?** YES - uses channel videos for pattern analysis

### 5. Where is the Studio page? What does it show?

**Location:** `/app/studio/page.jsx`

**What it shows:**
- Three tier sections: Post Today, This Week, Evergreen
- Signal cards with basic info
- Refresh button
- Show selector

**Current state:** Does NOT show pitches - only signals organized by tier

---

## Data Structures

### Pitch Object (from `smartPitch.js`):

```javascript
{
  title: string,              // Arabic title
  title_ar: string,           // Same as title
  angle: string,              // Pattern formula
  reasoning: string,          // Why this pattern
  contentType: 'long_form' | 'short_form',
  shortFormType: string | null,
  pattern: {
    id: string,
    name: string,
    name_ar: string,
    successRate: number,
    avgViews: number
  },
  predictedViews: number,
  predictionConfidence: number,  // 0-1
  similarVideo: {
    title: string,
    views: number
  } | null,
  evidence: {
    signal: {...},
    pattern: {...},
    competitors: [...],
    competitorBoost: number,
    audienceDemand: {...} | null,
    similarVideo: {...} | null
  },
  whyThisWorks: string[]
}
```

### Evidence Object (Current - Limited):

```javascript
{
  signal: {
    title: string,
    score: number,
    source: string
  },
  pattern: {
    reason: string,
    avgViews: number,
    videoCount: number,
    successRate: number
  },
  competitors: Array<{
    channel: string,
    views: number,
    multiplier: number,
    title: string,
    hoursAgo: number,
    type: 'direct' | 'trendsetter'
  }>,
  competitorBoost: number,
  audienceDemand: {
    score: number,
    comments: number
  } | null,
  similarVideo: {...} | null
}
```

---

## Gap Analysis

### What Needs to be Added:

1. **Why Now Evidence:**
   - Signal recency (hours/days old)
   - Trending indicators
   - Urgency scoring

2. **DNA Match Evidence:**
   - Matched DNA keywords
   - Topic relevance scores
   - DNA match strength

3. **Enhanced Competitor Coverage:**
   - Direct competitor videos (same topic, recent)
   - Indirect competitor videos (related topics)
   - Trendsetter videos (early coverage)
   - Competitor video details (titles, views, dates)
   - Coverage count per type

4. **Last Covered by Channel:**
   - Timestamp of last coverage
   - Days since last post
   - Saturation check (too recent?)

5. **Evidence Scoring:**
   - Score for each evidence type
   - Weighted evidence scores
   - Evidence strength (weak/moderate/strong)

---

## Recommendations for Enhancement

1. **Enhance `extractEvidenceFromSignal()` function:**
   - Add Why Now scoring
   - Add DNA match evidence
   - Enhance competitor coverage extraction
   - Add last covered timestamp
   - Add evidence scoring

2. **Update evidence structure:**
   ```javascript
   evidence: {
     whyNow: {
       score: number,
       recency: number,
       urgency: 'high' | 'medium' | 'low'
     },
     dnaMatch: {
       score: number,
       matchedKeywords: string[],
       matchedTopics: string[],
       strength: 'strong' | 'moderate' | 'weak'
     },
     competitors: {
       direct: [...],
       indirect: [...],
       trendsetter: [...],
       totalCount: number,
       totalViews: number
     },
     lastCovered: {
       timestamp: string | null,
       daysAgo: number | null,
       saturation: boolean
     },
     // ... existing fields
   }
   ```

3. **Add evidence scoring function:**
   - Calculate score for each evidence type
   - Weight evidence by importance
   - Provide overall evidence strength

4. **Update pitch generation prompts:**
   - Include Why Now reasoning
   - Include DNA match justification
   - Include competitor coverage proof
   - Include last covered context

---

## Related Files (For Reference)

- `/lib/patternAnalysis.js` - Pattern analysis (not reviewed)
- `/lib/topicIntelligence.js` - Topic fingerprinting
- `/lib/behaviorPatterns.js` - Behavior pattern matching
- `/components/studio/StudioCard.jsx` - Signal card component
- `/components/studio/TierSection.jsx` - Tier section component

---

## Conclusion

The smart pitch system exists and works with **patterns** and **similar videos**, but is **missing critical evidence types** needed for comprehensive pitch generation:
- Why Now evidence
- DNA match evidence
- Enhanced competitor coverage
- Last covered tracking
- Proper evidence scoring

**Next Steps:**
1. Enhance `extractEvidenceFromSignal()` to include all evidence types
2. Add evidence scoring logic
3. Update pitch generation prompts to use enhanced evidence
4. Update evidence structure in database/pitch objects
5. Update UI to display enhanced evidence
