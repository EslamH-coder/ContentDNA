# Full Audit: Studio Page & Smart Pitch System

**Date:** 2025-01-XX  
**Purpose:** Complete audit of existing Studio page and Smart Pitch implementation  
**Status:** READ-ONLY - No changes made

---

## 1. FILE INVENTORY

### Studio Page Files

#### `/app/studio/page.jsx` (187 lines)
**What it does:**
- Main Studio page component
- Displays signals organized by urgency tier (Post Today, This Week, Evergreen)
- Fetches signals from `/api/studio/signals`
- Has show selector and refresh button
- NO pitch generation UI visible

**What components it renders:**
- `TierSection` (3 instances: Post Today, This Week, Evergreen)
- Show selector dropdown
- Refresh button
- Loading/error states

**What data it fetches:**
- Shows list (from `/api/shows`)
- Signals by tier (from `/api/studio/signals?showId=...`)
- Data structure: `{ postToday: [], thisWeek: [], evergreen: [] }`

**Tabs/sections:**
- NO tabs - just three tier sections displayed vertically
- Post Today section (red)
- This Week section (yellow)
- Evergreen section (green)

**Pitch display:**
- ❌ **NO pitches are displayed**
- Only signals are shown
- Has "Generate Script" button on cards (via `onAction` handler)
- Handler is placeholder: `handleAction` logs action but doesn't implement pitch generation

---

#### `/app/api/studio/signals/route.js` (987 lines)
**What it does:**
- GET endpoint for Studio page signals
- Fetches signals (last 14 days)
- Calculates REAL scores using `calculateIdeaScore`
- Applies tiering using `getUrgencyTier`
- Filters and limits signals by tier
- Returns signals grouped by tier

**Endpoints:**
- `GET /api/studio/signals?showId=...`

**How it filters signals:**
1. Fetches signals (last 14 days, limit 100)
2. Ensures source diversity (max 2 per source, round-robin)
3. Calculates REAL scores (not DB scores)
4. Quality filter: score >= 20
5. High-score protection: signals with score >= 70 bypass tier limits
6. Tier limits (for regular signals only):
   - Post Today: 5
   - This Week: 7
   - Backlog: 15

**How many signals go in:**
- Input: Up to 100 signals (last 14 days)
- After diversity: Up to 20 diverse signals
- After scoring: All scored signals
- After quality filter: Signals with real score >= 20
- Output: Protected signals (score >= 70) + limited regular signals (5/7/15 per tier)

**What data it returns:**
```javascript
{
  success: true,
  data: {
    postToday: [...],      // Signals with tier='post_today'
    thisWeek: [...],       // Signals with tier='this_week'
    evergreen: [...]       // Signals with tier='backlog' or 'evergreen'
  },
  meta: {
    totalSignals: number,
    diverseSignalsCount: number,
    sources: {...},
    finalSourceDistribution: {...},
    dnaTopics: [...],
    competitorVideosCount: number
  }
}
```

**Signal object structure (returned):**
```javascript
{
  id: UUID,
  title: string,
  description: string,
  source: string,
  sourceUrl: string | null,
  score: number,              // REAL calculated score
  final_score: number,        // Same as score
  dbScore: number,            // Original DB score (for reference)
  createdAt: ISO string,
  tier: 'post_today' | 'this_week' | 'backlog',
  tierInfo: {...},            // Full tier object
  urgency_tier: {...},        // Same as tierInfo
  hoursOld: number,
  competitors: [...],         // Array of competitor videos
  competitor_count: number,
  competitor_evidence: [...], // Formatted for UI
  competitor_boost: number | undefined,
  dnaMatch: string | null,    // Topic name (English)
  dnaMatchId: string | null,  // Topic ID
  hasEvidence: boolean,
  scoringSignals: [...],      // What contributed to score
  multi_signal_scoring: {...}, // Full scoring result
  strategicLabel: {...} | null,
  competitorBreakout: {...} | null,
  competitorBreakdown: {...},
  lastCoveredVideo: {...} | null,
  daysSinceLastPost: number | null,
  matchedKeywords: [...],
  aiEntities: {...},
  aiExtractionMethod: string | null,
  patternMatches: [...],
  patternBoost: number
}
```

---

#### `/components/studio/StudioCard.jsx` (380 lines)
**What it does:**
- Displays individual signal card in Studio
- Shows "WHY NOW" section with evidence
- Displays competitor coverage, DNA matches, pattern matches
- Has action buttons (Like, Reject, Save, Generate Script)
- Expandable score breakdown

**What it displays:**
- Signal title, source, hours old
- Score badge
- "WHY NOW" section with:
  - Trendsetter breakout (if exists)
  - Multiple competitors signal
  - Matched keywords
  - Competitors covering this
  - DNA matches
  - Pattern matches
  - Trending/recency
  - Source link
  - Last covered (if available)
- Score breakdown (collapsible)
- Action buttons

**Evidence displayed:**
- ✅ Competitor breakouts (from `scoringSignals`)
- ✅ Trendsetter signals
- ✅ DNA matches (from `scoringSignals`)
- ✅ Pattern matches
- ✅ Last covered video
- ✅ Recency signals
- ❌ **NO pitches displayed**

---

#### `/components/studio/TierSection.jsx` (60 lines)
**What it does:**
- Wrapper component for tier sections
- Displays tier header with count
- Renders `StudioCard` components for each signal
- No pitch logic

---

### Smart Pitch Files

#### `/lib/smartPitch.js` (1,109 lines)
**What it does:**
- Main smart pitch generation library
- Generates pitches based on winning patterns
- Uses OpenAI GPT-4o-mini for pitch generation
- Saves pitches to `pitch_history` table

**Functions:**
1. `generateSmartPitches(signal, showId, options)` - Main entry point
2. `generatePitchForPattern(...)` - Generate pitch using specific pattern
3. `generateBatchedPitches(...)` - Generate both long/short in one call
4. `buildPitchPrompt(...)` - Build AI prompt
5. `buildBatchedPitchPrompt(...)` - Build batched prompt
6. `parsePitchResponse(...)` - Parse AI response
7. `parseBatchedPitchResponse(...)` - Parse batched response
8. `predictViews(...)` - Predict view count
9. `calculateConfidence(...)` - Calculate prediction confidence
10. `extractEvidenceFromSignal(...)` - Extract evidence (LIMITED)
11. `generateWhyThisWorks(...)` - Generate explanation
12. `findSimilarSuccessfulVideos(...)` - Find similar videos
13. `determineUrgency(...)` - Determine urgency tier
14. `rankPitches(...)` - Rank pitches by performance
15. `getShowData(...)` - Get show data
16. `savePitchHistory(...)` - Save pitch to database
17. `selectBestPatternForSignal(...)` - Select best pattern

**What data it uses:**
- Signal (title, description, score)
- Show ID
- Winning patterns (from `getShowWinningPatterns`)
- Topic fingerprints (for matching)
- Similar successful videos (from channel history)
- Show data (avg views, video count)

**What `extractEvidenceFromSignal()` returns:**
```javascript
{
  // Source signal
  signal: {
    title: string,
    score: number,
    source: string
  },
  
  // Pattern reasoning
  pattern: {
    reason: string,        // e.g., "Pattern X performs 1.2x your channel average"
    avgViews: number,
    videoCount: number,
    successRate: number
  },
  
  // Competitor proof (LIMITED - only from competitor_breakout signals)
  competitors: Array<{
    channel: string,
    views: number,
    multiplier: number,
    title: string,
    hoursAgo: number,
    type: 'direct' | 'trendsetter'  // Only 2 types, no 'indirect'
  }>,  // Limited to 2 competitors
  competitorBoost: number,  // Just count of competitor signals
  
  // Audience demand (LIMITED)
  audienceDemand: {
    score: number,
    comments: number
  } | null,
  
  // Similar video (added separately, not in initial return)
  similarVideo: null  // Added later
}
```

**What the pitch generation prompt looks like:**
```
You are a content strategist for an Arabic YouTube channel.

CHANNEL: [Show name]
LANGUAGE: Arabic (Modern Standard Arabic)
CONTENT TYPE: [LONG FORM (10-30 minutes) | SHORT FORM (up to 3 minutes)]

TRENDING TOPIC:
[Signal title]
[Signal description]

WINNING PATTERN TO USE: "[Pattern name]"
Pattern Formula: [Pattern formula]
Examples of successful videos using this pattern:
- [Example title 1]
- [Example title 2]

REFERENCE SUCCESS:
"[Similar video title]" got [views] views

TASK:
Generate a VIDEO TITLE in Arabic that:
1. Applies the "[Pattern name]" pattern to this trending topic
2. [Is punchy and creates immediate curiosity (max 10 words) | Creates curiosity and promises deep insight (max 15 words)]
3. Would appeal to Arab viewers interested in geopolitics & economics

RESPOND WITH ONLY:
TITLE: [Your Arabic title here]
HOOK: [One sentence explaining the angle]
```

**How competitors are handled:**
- ⚠️ **LIMITED** - Only extracts from `signal.multi_signal_scoring.signals`
- Filters for `competitor_breakout` signals only
- Only distinguishes: `'direct'` vs `'trendsetter'` (no `'indirect'`)
- Limited to 2 competitors
- No competitor video details (titles, URLs, views) in evidence
- No distinction between direct/indirect/trendsetter breakout types

**Is there trendsetter logic:**
- ⚠️ **PARTIAL** - Only recognizes `competitor_breakout_trendsetter` signal type
- No separate trendsetter volume logic
- No trendsetter-specific scoring

---

#### `/app/api/smart-pitch/route.js` (45 lines)
**What it does:**
- POST endpoint for smart pitch generation
- Routes to `generateSmartPitches()` function
- Handles pattern analysis requests

**Endpoints:**
- `POST /api/smart-pitch`

**Actions:**
1. `generate` - Generate pitches for a signal
2. `analyze` - Analyze show patterns
3. `getPatterns` - Get existing patterns

**Input:**
```javascript
{
  action: 'generate' | 'analyze' | 'getPatterns',
  showId: UUID,
  signal: {...},      // For 'generate' action
  options: {...}      // Optional configuration
}
```

**Output (for 'generate'):**
```javascript
{
  success: true,
  data: {
    signal: {...},
    urgency: 'post_today' | 'this_week' | 'evergreen',
    pitches: [
      {
        id: UUID,
        title: string,
        title_ar: string,
        angle: string,
        reasoning: string,
        contentType: 'long_form' | 'short_form',
        shortFormType: string | null,
        pattern: {...},
        predictedViews: number,
        predictionConfidence: number,
        similarVideo: {...} | null,
        evidence: {...},        // From extractEvidenceFromSignal
        whyThisWorks: string[]
      }
    ],
    similarSuccesses: [...],
    showStats: {...}
  }
}
```

**How many pitches it generates:**
- Default: `maxPitches = 2` (1 long form, 1 short form)
- Can be configured via `options.maxPitches`
- Generates pitches for selected pattern only (not all patterns)

**Filtering criteria:**
- Uses `selectBestPatternForSignal()` to choose ONE pattern
- Generates 1-2 pitches (long/short) for that pattern
- NO filtering by score or evidence strength
- NO tier limits

---

## 2. CURRENT EVIDENCE STRUCTURE

### In `/lib/smartPitch.js` - `extractEvidenceFromSignal()`:

```javascript
evidence = {
  // Source signal
  signal: {
    title: string,
    score: number,
    source: string
  },
  
  // Pattern reasoning
  pattern: {
    reason: string,              // "Pattern X performs Yx your channel average"
    avgViews: number,
    videoCount: number,
    successRate: number
  },
  
  // Competitor proof (LIMITED)
  competitors: Array<{
    channel: string,
    views: number,
    multiplier: number,
    title: string,               // Signal title (not video title)
    hoursAgo: number,
    type: 'direct' | 'trendsetter'  // Only 2 types, missing 'indirect'
  }>,  // Limited to first 2
  competitorBoost: number,       // Just count, not weighted score
  
  // Audience demand (LIMITED)
  audienceDemand: {
    score: number,
    comments: number
  } | null,
  
  // Similar video (added separately, not in initial return)
  similarVideo: null             // Added later in generatePitchForPattern
}
```

### What's MISSING from evidence:

1. **Why Now evidence:**
   - ❌ No recency/urgency scoring
   - ❌ No time-sensitive indicators
   - ❌ No trending status
   - ❌ No "hours old" or "days old" metrics

2. **DNA match evidence:**
   - ❌ No DNA keyword matching details
   - ❌ No topic relevance scores
   - ❌ No matched topics list
   - ❌ No DNA match strength indicator

3. **Enhanced competitor coverage:**
   - ⚠️ Missing: Direct competitor videos (same topic, recent)
   - ⚠️ Missing: Indirect competitor videos (related topics)
   - ⚠️ Missing: Trendsetter videos (early coverage)
   - ❌ No competitor video details (titles, URLs, views, dates)
   - ❌ No coverage count per type
   - ⚠️ Only extracts from `competitor_breakout` signals (missing volume signals)

4. **Last covered by channel:**
   - ❌ No timestamp of last coverage
   - ❌ No days since last post
   - ❌ No saturation check result

5. **Evidence scoring:**
   - ❌ No score for each evidence type
   - ❌ No weighted evidence scores
   - ❌ No evidence strength indicator (weak/moderate/strong)

---

## 3. CURRENT COMPETITOR/TRENDSETTER HANDLING

### In `/lib/smartPitch.js` - `extractEvidenceFromSignal()`:

```javascript
// CURRENT IMPLEMENTATION (LIMITED)
if (signal.multi_signal_scoring?.signals) {
  const scoringSignals = signal.multi_signal_scoring.signals;
  const competitorSignals = scoringSignals.filter(s => 
    s.type?.includes('competitor_breakout')  // Only breakout signals
  );
  
  competitorSignals.forEach(signalData => {
    if (signalData.evidence) {
      competitors.push({
        channel: signalData.evidence.channelName || 'Competitor',
        views: signalData.evidence.views || 0,
        multiplier: signalData.evidence.multiplier || 1,
        title: signalData.evidence.title?.substring(0, 50) || signal.title,  // Uses signal title, not video title
        hoursAgo: signalData.evidence.hoursAgo,
        type: signalData.type?.includes('direct') ? 'direct' : 'trendsetter'  // Only 2 types
      });
    }
  });
  
  competitorBoost = competitorSignals.length;  // Just count, not weighted
}
```

### What's Missing:

1. **Competitor Types:**
   - ⚠️ Only distinguishes: `'direct'` vs `'trendsetter'`
   - ❌ Missing: `'indirect'` type
   - ❌ No distinction between breakout types: `direct`, `indirect`, `trendsetter`

2. **Competitor Data:**
   - ❌ No video titles (uses signal title instead)
   - ❌ No video URLs
   - ❌ No video descriptions
   - ❌ No published dates
   - ❌ Limited to 2 competitors

3. **Competitor Volume Signals:**
   - ❌ Doesn't extract from `competitor_volume_direct`
   - ❌ Doesn't extract from `competitor_volume_indirect`
   - ❌ Doesn't extract from `trendsetter_volume`
   - ⚠️ Only looks at `competitor_breakout` signals

4. **Competitor Scoring:**
   - ❌ No weighted scoring per type
   - ❌ No distinction between direct/indirect/trendsetter weights
   - ❌ Just counts signals, doesn't weight them

---

## 4. CURRENT PITCH OUTPUT

### Pitch Object Structure (from `generateSmartPitches()`):

```javascript
pitch = {
  id: UUID,                    // Database ID or composite ID
  title: string,               // Arabic title
  title_ar: string,            // Same as title
  angle: string,               // Pattern formula
  reasoning: string,           // Why this pattern
  contentType: 'long_form' | 'short_form',
  shortFormType: string | null,
  
  // Pattern info
  pattern: {
    id: string,
    name: string,
    name_ar: string,
    successRate: number,
    avgViews: number
  },
  
  // Prediction
  predictedViews: number,
  predictionConfidence: number,  // 0-1
  
  // Similar success (backward compatibility)
  similarVideo: {
    title: string,
    views: number
  } | null,
  
  // Evidence object (LIMITED)
  evidence: {
    signal: {...},
    pattern: {...},
    competitors: [...],        // Limited to 2, missing details
    competitorBoost: number,
    audienceDemand: {...} | null,
    similarVideo: {...} | null
  },
  
  // Why this works
  whyThisWorks: string[]       // Array of reasons
}
```

### What's Missing from Pitch Output:

1. **Why Now evidence** - Not included
2. **DNA match evidence** - Not included
3. **Enhanced competitor coverage** - Limited (only 2, missing details)
4. **Last covered timestamp** - Not included
5. **Evidence scores** - Not included
6. **Competitor video details** - Missing (titles, URLs, views, dates)

---

## 5. CURRENT FILTERING LOGIC

### Studio Signals API (`/app/api/studio/signals`):

**Input:**
- Up to 100 signals (last 14 days)

**Filters Applied:**
1. **Source Diversity:**
   - Round-robin selection
   - Max 2 per source
   - Up to 20 diverse signals

2. **Quality Filter:**
   - Real score >= 20
   - Filters out low-quality signals

3. **High-Score Protection:**
   - Signals with real score >= 70 bypass tier limits
   - All protected signals included

4. **Tier Limits (for regular signals only):**
   - Post Today: 5
   - This Week: 7
   - Backlog: 15

**Output:**
- Protected signals (score >= 70) + Limited regular signals (5/7/15 per tier)
- Grouped by tier: `{ postToday: [], thisWeek: [], evergreen: [] }`

**Example Flow:**
- 100 signals → 20 diverse → All scored → Score >= 20 → Protected (score >= 70) + Limited regular (5/7/15)

---

### Smart Pitch API (`/app/api/smart-pitch`):

**Input:**
- Single signal object
- Show ID
- Options (maxPitches, includeShortForm, includeLongForm)

**Filters Applied:**
- ✅ Pattern selection (best pattern for signal)
- ❌ NO score filtering
- ❌ NO evidence filtering
- ❌ NO tier limits

**Output:**
- 1-2 pitches (long form and/or short form)
- Based on selected pattern only

---

## 6. GAPS IDENTIFIED

### What's Missing vs What We Want to Add:

#### 1. **Why Now Evidence**
**Missing:**
- Recency scoring
- Urgency indicators
- Trending status
- Time-sensitive metrics

**Want:**
- Signal recency (hours/days old)
- Trending indicators
- Urgency scoring
- "Why Now" reasoning

---

#### 2. **DNA Match Evidence**
**Missing:**
- DNA keyword matching details
- Topic relevance scores
- Matched topics list
- DNA match strength

**Want:**
- Matched DNA keywords
- Topic relevance scores
- DNA match strength (strong/moderate/weak)
- Matched topics with names

---

#### 3. **Enhanced Competitor Coverage**
**Current (Limited):**
- Only extracts from `competitor_breakout` signals
- Only 2 types: `'direct'` vs `'trendsetter'`
- Limited to 2 competitors
- Missing video details

**Want:**
- Direct competitor videos (same topic, recent)
- Indirect competitor videos (related topics)
- Trendsetter videos (early coverage)
- Competitor video details (titles, URLs, views, dates)
- Coverage count per type
- Proper scoring per type

---

#### 4. **Last Covered by Channel**
**Missing:**
- Timestamp of last coverage
- Days since last post
- Saturation check

**Want:**
- Last covered video (title, URL, date)
- Days since last post
- Saturation indicator (too recent?)

---

#### 5. **Evidence Scoring**
**Missing:**
- Score for each evidence type
- Weighted evidence scores
- Evidence strength indicator

**Want:**
- Why Now score
- DNA match score
- Competitor coverage score (per type)
- Last covered score
- Overall evidence strength (weak/moderate/strong)

---

### What Exists But Needs Improvement:

1. **Competitor Extraction:**
   - ⚠️ Only looks at `competitor_breakout` signals
   - ⚠️ Should also extract from `competitor_volume_*` signals
   - ⚠️ Should distinguish direct/indirect/trendsetter properly

2. **Evidence Structure:**
   - ⚠️ Too limited - missing many evidence types
   - ⚠️ Competitors array is incomplete
   - ⚠️ No scoring for evidence

3. **Pitch Generation Prompt:**
   - ⚠️ Doesn't include Why Now reasoning
   - ⚠️ Doesn't include DNA match justification
   - ⚠️ Doesn't include competitor coverage proof
   - ⚠️ Doesn't include last covered context

---

## 7. RECOMMENDED APPROACH

### Functions to Modify:

#### 1. `/lib/smartPitch.js` - `extractEvidenceFromSignal()`
**Status:** NEEDS MAJOR ENHANCEMENT  
**Current:** 77 lines, extracts limited evidence  
**Action:** Rewrite to include:
- Why Now evidence (recency, urgency)
- DNA match evidence (keywords, topics, strength)
- Enhanced competitor coverage (direct/indirect/trendsetter with details)
- Last covered timestamp
- Evidence scoring

**Dependencies:**
- Signal object must have `multi_signal_scoring` data
- Signal object must have `lastCoveredVideo` and `daysSinceLastPost`
- Signal object must have `dnaMatch` and DNA matching details

---

#### 2. `/lib/smartPitch.js` - `buildPitchPrompt()` and `buildBatchedPitchPrompt()`
**Status:** NEEDS ENHANCEMENT  
**Current:** Basic prompt with pattern and similar video  
**Action:** Enhance to include:
- Why Now reasoning
- DNA match justification
- Competitor coverage proof
- Last covered context

---

#### 3. `/lib/smartPitch.js` - `predictViews()` and `calculateConfidence()`
**Status:** COULD BE ENHANCED  
**Current:** Uses pattern, signal score, competitor boost, audience demand  
**Action:** Could incorporate:
- Why Now scoring
- DNA match strength
- Enhanced competitor coverage scoring
- Last covered scoring

---

### Functions to Create New:

#### 1. `/lib/smartPitch.js` - `extractWhyNowEvidence(signal)`
**Purpose:** Extract Why Now evidence from signal  
**Returns:**
```javascript
{
  score: number,
  recency: number,          // Hours/days old
  urgency: 'high' | 'medium' | 'low',
  reasons: string[]
}
```

---

#### 2. `/lib/smartPitch.js` - `extractDnaMatchEvidence(signal, dnaTopics)`
**Purpose:** Extract DNA match evidence from signal  
**Returns:**
```javascript
{
  score: number,
  matchedKeywords: string[],
  matchedTopics: string[],
  strength: 'strong' | 'moderate' | 'weak',
  reasons: string[]
}
```

---

#### 3. `/lib/smartPitch.js` - `extractCompetitorEvidence(signal)`
**Purpose:** Extract enhanced competitor coverage  
**Returns:**
```javascript
{
  direct: Array<{...}>,
  indirect: Array<{...}>,
  trendsetter: Array<{...}>,
  totalCount: number,
  totalViews: number,
  score: number
}
```

---

#### 4. `/lib/smartPitch.js` - `scoreEvidence(evidence)`
**Purpose:** Score evidence object  
**Returns:**
```javascript
{
  whyNow: number,
  dnaMatch: number,
  competitors: number,
  lastCovered: number,
  total: number,
  strength: 'strong' | 'moderate' | 'weak'
}
```

---

### Order of Implementation:

1. **Phase 1: Evidence Extraction**
   - Create `extractWhyNowEvidence()`
   - Create `extractDnaMatchEvidence()`
   - Create `extractCompetitorEvidence()`
   - Create `scoreEvidence()`
   - Rewrite `extractEvidenceFromSignal()` to use new functions

2. **Phase 2: Prompt Enhancement**
   - Update `buildPitchPrompt()` to include enhanced evidence
   - Update `buildBatchedPitchPrompt()` to include enhanced evidence
   - Test pitch generation with new evidence

3. **Phase 3: Prediction Enhancement**
   - Update `predictViews()` to use enhanced evidence
   - Update `calculateConfidence()` to use enhanced evidence
   - Test predictions with new evidence

4. **Phase 4: UI Integration (if needed)**
   - Update Studio page to display enhanced evidence
   - Update StudioCard to show new evidence types
   - Add pitch display if needed

---

## 8. KEY FINDINGS

### ✅ What Works:
1. Studio page displays signals organized by tier
2. Signals have rich scoring data (`multi_signal_scoring`)
3. Signals include competitor data (via Studio API)
4. Signals include DNA matches (via Studio API)
5. Signals include last covered info (via Studio API)
6. Smart pitch system generates pitches based on patterns
7. Pattern selection works (chooses best pattern for signal)

### ⚠️ What's Limited:
1. Smart pitch evidence extraction is minimal
2. Competitor extraction only looks at breakouts (not volume)
3. No distinction between direct/indirect/trendsetter in pitch evidence
4. Pitch prompts don't include Why Now/DNA/competitor/last covered
5. No evidence scoring system

### ❌ What's Missing:
1. Why Now evidence in pitch generation
2. DNA match evidence in pitch generation
3. Enhanced competitor coverage in pitch generation
4. Last covered timestamp in pitch generation
5. Evidence scoring system
6. Pitch display in Studio page (pitches are generated but not shown)

---

## 9. INTEGRATION POINTS

### Where Studio API Data is Available:

The `/app/api/studio/signals` endpoint already provides:
- ✅ `competitors` array with full details
- ✅ `competitorBreakdown` with counts by type
- ✅ `dnaMatch` and `dnaMatchId`
- ✅ `lastCoveredVideo` and `daysSinceLastPost`
- ✅ `scoringSignals` with all signal data
- ✅ `multi_signal_scoring` with full scoring result
- ✅ `patternMatches` with pattern data

**Key Insight:** The Studio API already has ALL the data needed for enhanced evidence!  
**The problem:** Smart pitch system (`/lib/smartPitch.js`) doesn't use this data when generating pitches.

---

## 10. CONCLUSION

### Current State:
- **Studio page:** Shows signals with rich evidence, but NO pitches
- **Smart pitch system:** Generates pitches with LIMITED evidence
- **Gap:** Smart pitch doesn't use the rich evidence data that Studio API provides

### What Needs to Happen:
1. **Enhance `extractEvidenceFromSignal()`** to extract ALL evidence types from signal data
2. **Update pitch prompts** to include enhanced evidence
3. **Add evidence scoring** to weight evidence types
4. **Optionally:** Display pitches in Studio page (currently not shown)

### Key Advantage:
The Studio API (`/app/api/studio/signals`) already calculates and provides ALL the evidence data needed:
- Competitor videos (with types, details)
- DNA matches
- Last covered videos
- Pattern matches
- Scoring signals

The smart pitch system just needs to **extract and use** this data when generating pitches!
