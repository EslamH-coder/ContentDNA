# Taxonomy, Learning, and Intelligence Systems Audit

**Generated:** 2024-12-19  
**Purpose:** Comprehensive audit of all taxonomy, learning, and intelligence systems before building unified system

---

## PART 1: TOPIC/TAXONOMY STORAGE (Multiple Sources - PROBLEM!)

### 1.1 Database Tables

#### `topic_definitions` ✅ **PRIMARY (Single Source of Truth)**
- **Purpose:** Stores DNA topics for each show
- **Structure:**
  - `show_id` (uuid) - Foreign key
  - `topic_id` (text) - Topic identifier (e.g., 'iran_oil_sanctions')
  - `topic_name_en` (text) - English name
  - `topic_name_ar` (text) - Arabic name
  - `keywords` (array/jsonb) - Keywords for matching
  - `description` (text, optional) - Topic description
  - `is_active` (boolean) - Whether topic is active
- **Where Used:**
  - ✅ `/lib/scoring/signalScoringService.js` - `loadDnaTopics()` (PRIMARY)
  - ✅ `/app/api/signals/route.js` - Loads via `loadDnaTopics()` (PRIMARY)
  - ✅ `/app/api/studio/signals/route.js` - Loads via `loadDnaTopics()` (PRIMARY)
  - ✅ `/lib/scoring/signalScoringService.js` - `learnKeywordForTopic()` (updates keywords)
  - ✅ `/lib/scoring/signalScoringService.js` - `autoLearnKeywords()` (auto-learning)
- **Status:** ✅ **ACTIVE - Single source of truth for DNA topics**

#### `show_dna.topics` ⚠️ **DEPRECATED (Fallback Only)**
- **Purpose:** Legacy JSONB column storing topics array
- **Structure:** JSONB array of topic objects
- **Where Used:**
  - ⚠️ `/app/api/signals/route.js` - Fallback when `topic_definitions` is empty (Lines 511-522)
  - ⚠️ `/lib/recommendation/dnaLoader.js` - Legacy loading (Lines 45-100)
  - ⚠️ `/lib/dna/dnaBuilder.js` - May still write to this
- **Status:** ⚠️ **DEPRECATED - Should be migrated to `topic_definitions`**

#### `topic_clusters` 🔄 **SEPARATE SYSTEM (Not Connected to DNA)**
- **Purpose:** Groups related signals into clusters
- **Structure:**
  - `id` (uuid) - Primary key
  - `show_id` (uuid) - Foreign key
  - `cluster_name` (text) - Cluster name
  - `cluster_name_ar` (text) - Arabic name
  - `cluster_key` (text) - Cluster identifier
- **Where Used:**
  - `/lib/clustering/clusterEngine.js` - Creates and manages clusters
  - `/app/api/clusters/route.js` - API for cluster management
  - `/app/api/clusters/create/route.js` - Creates clusters
- **Status:** 🔄 **ACTIVE but DISCONNECTED from DNA topics**

#### `cluster_keywords` 🔄 **SEPARATE SYSTEM**
- **Purpose:** Keywords for topic clusters (separate from DNA topics)
- **Structure:**
  - `id` (uuid) - Primary key
  - `show_id` (uuid) - Foreign key
  - `cluster_key` (text) - Cluster identifier
  - `keyword` (text) - Keyword
  - `language` (text) - 'ar' or 'en'
  - `weight` (float) - Keyword weight
- **Where Used:**
  - `/lib/clustering/clusterEngine.js` - Used for cluster matching
- **Status:** 🔄 **ACTIVE but DISCONNECTED from `topic_definitions`**

#### `cluster_items` 🔄 **SEPARATE SYSTEM**
- **Purpose:** Links signals to topic clusters
- **Structure:**
  - `id` (uuid) - Primary key
  - `cluster_id` (uuid) - Foreign key to `topic_clusters`
  - `signal_id` (uuid) - Foreign key to `signals`
  - `relevance_score` (float) - Match score
- **Where Used:**
  - `/lib/clustering/clusterEngine.js` - Stores cluster assignments
- **Status:** 🔄 **ACTIVE but DISCONNECTED from DNA topics**

### 1.2 Hardcoded Topic Lists

#### In Code Files:
- **None found** - Topics are loaded from database, not hardcoded
- ✅ **Good:** No hardcoded topic lists found

### 1.3 Topic Assignment Methods

#### Method 1: AI Extraction (via `topicIntelligence.js`)
- **Where:** `/lib/topicIntelligence.js` - `generateTopicFingerprint()`
- **How:** Uses OpenAI GPT-4o-mini to extract entities (countries, topics, people, organizations)
- **Used In:**
  - `/lib/scoring/signalScoringService.js` - Generates AI fingerprint for signals
  - `/lib/scoring/multiSignalScoring.js` - `findDnaMatch()` uses AI fingerprint for matching
  - `/lib/behaviorPatterns.js` - Uses for pattern matching
- **Status:** ✅ **ACTIVE - Primary method for entity extraction**

#### Method 2: Keyword Matching (via `multiSignalScoring.js`)
- **Where:** `/lib/scoring/multiSignalScoring.js` - `findDnaMatch()`
- **How:** 
  - Extracts keywords from signal title/description
  - Matches against `topic_definitions.keywords` array
  - Requires minimum keyword weight (currently 4)
  - Requires 2+ keywords or 1 meaningful + 2 generic
- **Used In:**
  - `/lib/scoring/multiSignalScoring.js` - Fallback if AI matching fails
  - `/app/api/signals/route.js` - Via `calculateIdeaScore()`
- **Status:** ✅ **ACTIVE - Fallback method**

#### Method 3: Manual Assignment
- **Where:** Not found in codebase
- **Status:** ❌ **NOT IMPLEMENTED** - No UI for manual topic assignment

---

## PART 2: LEARNING SYSTEMS (Disconnected - PROBLEM!)

### 2.1 Learning Tables

#### `show_learning_weights` ✅ **PRIMARY LEARNING STORAGE**
- **Purpose:** Stores learned weights from user feedback
- **Structure:**
  - `show_id` (uuid) - Primary key (unique per show)
  - `topic_weights` (jsonb) - Learned topic weights
    ```json
    {
      "country_china": { "liked": 5, "rejected": 1, "weight": 1.4 },
      "topic_tariffs": { "liked": 3, "rejected": 0, "weight": 1.3 }
    }
    ```
  - `category_weights` (jsonb) - Learned category weights
  - `pattern_weights` (jsonb) - Learned behavior pattern weights
  - `source_weights` (jsonb, optional) - Learned source weights
  - `updated_at` (timestamp) - Last update time
- **Where Used:**
  - ✅ `/lib/learning/signalEffectiveness.js` - `getLearnedAdjustments()` (reads)
  - ✅ `/app/api/feedback/route.js` - Updates weights on feedback (writes)
  - ✅ `/lib/scoring/signalScoringService.js` - `applyLearnedAdjustments()` (applies)
  - ✅ `/app/api/signals/route.js` - Loads and applies learning
  - ✅ `/app/api/studio/signals/route.js` - Loads and applies learning
- **Status:** ✅ **ACTIVE - Primary learning storage**

#### `recommendation_feedback` ✅ **FEEDBACK SOURCE**
- **Purpose:** Stores user feedback on signals/ideas
- **Structure:**
  - `id` (uuid) - Primary key
  - `show_id` (uuid) - Foreign key
  - `signal_id` (uuid, optional) - Associated signal
  - `action` (text) - 'liked', 'rejected', 'saved', 'produced', etc.
  - `topic` (text) - Signal topic
  - `evidence_summary` (jsonb) - Full signal context
  - `created_at` (timestamp) - When feedback was given
- **Where Used:**
  - ✅ `/app/api/feedback/route.js` - Records feedback (writes)
  - ✅ `/app/api/feedback/route.js` - GET endpoint reads for stats
  - ✅ `/lib/learning/signalEffectiveness.js` - Calculates weights from feedback (reads)
  - ✅ `/components/LearningStats.jsx` - Displays stats
- **Status:** ✅ **ACTIVE - Source of learning data**

#### `signal_feedback_patterns` ✅ **NEW PATTERN-BASED LEARNING**
- **Purpose:** Stores learned patterns from feedback (countries, topics, title patterns)
- **Structure:**
  - `id` (text) - Composite key hash
  - `show_id` (uuid) - Foreign key
  - `pattern_type` (text) - 'positive' or 'negative'
  - `countries` (jsonb) - Array of countries
  - `topics` (jsonb) - Array of topics
  - `title_patterns` (jsonb) - Array of title patterns
  - `score_boost` (integer) - Points to add for positive
  - `score_penalty` (integer) - Points to subtract for negative
  - `match_count` (integer) - How many times pattern was seen
- **Where Used:**
  - ✅ `/lib/scoring/signalScoringService.js` - `learnFromFeedback()` (writes)
  - ✅ `/lib/scoring/signalScoringService.js` - `applyLearnedPatterns()` (reads and applies)
  - ✅ `/app/api/feedback/route.js` - Calls `learnFromFeedback()` on feedback
  - ✅ `/app/api/learning/reset/route.js` - Resets patterns
- **Status:** ✅ **ACTIVE - New pattern-based learning system**

#### `show_behavior_patterns` ✅ **BEHAVIOR PATTERN LEARNING**
- **Purpose:** Stores learned behavior patterns (superpower_tension, personal_impact, etc.)
- **Structure:**
  - `show_id` (uuid) - Primary key (unique per show)
  - `patterns` (jsonb) - Learned behavior patterns
  - `learned_at` (timestamptz) - When patterns were learned
  - `video_count` (integer) - Count of videos analyzed
  - `comment_count` (integer) - Count of comments analyzed
- **Where Used:**
  - ✅ `/lib/behaviorPatterns.js` - `learnBehaviorPatterns()` (writes)
  - ✅ `/lib/behaviorPatterns.js` - `getShowPatterns()` (reads)
  - ✅ `/lib/behaviorPatterns.js` - `scoreSignalByPatterns()` (applies)
  - ✅ `/lib/scoring/signalScoringService.js` - Uses for pattern matching
  - ✅ `/app/api/signals/route.js` - Loads and applies patterns
- **Status:** ✅ **ACTIVE - Behavior pattern learning**

### 2.2 Learning Functions

#### `/lib/learning/signalEffectiveness.js`
- **Functions:**
  - `getLearnedAdjustments()` - Reads from `show_learning_weights`
  - `applyLearnedAdjustments()` - Applies weights to scores
  - `calculateSignalEffectiveness()` - Calculates from feedback
- **Status:** ✅ **ACTIVE**

#### `/lib/learning/applyLearning.js`
- **Functions:**
  - `getHiddenTopics()` - Hides rejected/liked/produced topics
- **Status:** ✅ **ACTIVE**

#### `/lib/scoring/signalScoringService.js`
- **Functions:**
  - `learnFromFeedback()` - Writes to `signal_feedback_patterns`
  - `applyLearnedPatterns()` - Reads and applies patterns
  - `autoLearnKeywords()` - Auto-learns keywords for topics
- **Status:** ✅ **ACTIVE**

#### `/lib/behaviorPatterns.js`
- **Functions:**
  - `learnBehaviorPatterns()` - Analyzes videos/comments/competitors
  - `getShowPatterns()` - Reads from `show_behavior_patterns`
  - `scoreSignalByPatterns()` - Applies pattern matching
- **Status:** ✅ **ACTIVE**

### 2.3 Where Learning is Applied

#### In Signal Scoring:
- ✅ `/app/api/signals/route.js` - Applies learning weights (Lines 1100-1200)
- ✅ `/app/api/studio/signals/route.js` - Applies learning weights
- ✅ `/lib/scoring/signalScoringService.js` - Applies learned patterns

#### In RSS Filtering:
- ❌ **NOT APPLIED** - RSS processor doesn't use learning weights

#### In Recommendations:
- ✅ `/lib/intelligence/recommendationEngineV3.js` - May use learning (needs verification)

---

## PART 3: ANALYTICS/INTELLIGENCE SYSTEMS

### 3.1 Analytics Tables

#### `topic_fingerprints` ✅ **CACHING TABLE**
- **Purpose:** Caches topic fingerprints for performance
- **Structure:**
  - `id` (uuid) - Primary key
  - `fingerprint_hash` (text, unique) - Hash of content
  - `fingerprint_data` (jsonb) - Cached fingerprint data
  - `created_at` (timestamptz) - When cached
- **Where Used:**
  - ✅ `/lib/topicIntelligence.js` - `getCachedFingerprint()` (reads)
  - ✅ `/lib/topicIntelligence.js` - `cacheFingerprint()` (writes)
- **Status:** ✅ **ACTIVE - Performance optimization**

#### `topic_stats` ❌ **NOT FOUND**
- **Status:** ❌ **DOES NOT EXIST** - No topic statistics table found

### 3.2 Intelligence/Insights Generation

#### `/lib/topicIntelligence.js` ✅ **PRIMARY INTELLIGENCE SYSTEM**
- **Purpose:** AI-powered entity extraction and topic fingerprinting
- **Functions:**
  - `generateTopicFingerprint()` - Extracts entities using AI
  - `compareTopics()` - Compares two topics for similarity
  - `isRelevantCompetitorVideo()` - Checks if competitor video is relevant
- **Where Used:**
  - ✅ `/lib/scoring/signalScoringService.js` - Generates fingerprints
  - ✅ `/lib/scoring/multiSignalScoring.js` - Uses for DNA matching
  - ✅ `/lib/behaviorPatterns.js` - Uses for pattern matching
  - ✅ `/lib/clustering/clusterEngine.js` - Uses for cluster matching
- **Status:** ✅ **ACTIVE - Core intelligence system**

#### `/lib/intelligence/` Directory (22 files)
- **Key Files:**
  - `intelligenceEngine.js` - Main intelligence engine
  - `recommendationEngineV3.js` - Recommendation engine
  - `audienceBehavior.js` - Audience behavior analysis
  - `topicAnalyzer.js` - Topic analysis
  - `marketIntelligence.js` - Market intelligence
- **Status:** ✅ **ACTIVE - Multiple intelligence systems**

---

## PART 4: DATA FLOW MAPPING

### 4.1 Signal Processing Flow

```
RSS Feed
  ↓
/app/api/signals/refresh/route.js (RSS Processor)
  ↓
  - Filters by DNA (uses topic_definitions)
  - Scores signals
  - Saves to signals table
  ↓
signals table (Database)
  ↓
/app/api/signals/route.js (Ideas Page API)
  ↓
  - Loads DNA topics from topic_definitions ✅
  - Loads learning weights from show_learning_weights ✅
  - Loads behavior patterns from show_behavior_patterns ✅
  - Generates AI fingerprints (topicIntelligence.js) ✅
  - Scores signals (multiSignalScoring.js)
  - Applies learning adjustments ✅
  - Applies pattern matching ✅
  ↓
Display (Ideas Page)
```

### 4.2 Topic Assignment Flow

```
Signal Title/Description
  ↓
generateTopicFingerprint() (topicIntelligence.js)
  ↓
  - AI extraction (OpenAI GPT-4o-mini)
  - Extracts: countries, topics, people, organizations
  ↓
findDnaMatch() (multiSignalScoring.js)
  ↓
  - Matches AI entities against topic_definitions ✅
  - Falls back to keyword matching if AI fails
  - Returns matched topic_ids
  ↓
Signal stored with matched_topic (optional)
```

### 4.3 Learning Update Flow

```
User Feedback (Like/Reject)
  ↓
/app/api/feedback/route.js
  ↓
  - Records in recommendation_feedback ✅
  - Calls learnFromFeedback() ✅
  - Updates show_learning_weights ✅
  - Stores patterns in signal_feedback_patterns ✅
  ↓
Next Signal Scoring
  ↓
  - Reads show_learning_weights ✅
  - Reads signal_feedback_patterns ✅
  - Applies adjustments to scores ✅
```

### 4.4 Clustering Flow (DISCONNECTED)

```
Signals
  ↓
/lib/clustering/clusterEngine.js
  ↓
  - Uses cluster_keywords (NOT topic_definitions) ❌
  - Uses topicIntelligence.js for matching ✅
  - Creates cluster_items
  ↓
topic_clusters table (SEPARATE from DNA)
```

---

## PART 5: GAPS IDENTIFIED

### 5.1 Topic/Taxonomy Gaps

1. **Multiple Topic Sources:**
   - ❌ `show_dna.topics` still used as fallback (should be removed)
   - ❌ `topic_clusters` disconnected from `topic_definitions`
   - ❌ `cluster_keywords` separate from DNA keywords

2. **Topic Assignment:**
   - ❌ No manual topic assignment UI
   - ❌ Signals don't always get `matched_topic` stored
   - ⚠️ AI matching sometimes fails, falls back to keywords

3. **Clustering Disconnection:**
   - ❌ Clusters use separate keywords (`cluster_keywords`)
   - ❌ Clusters not linked to DNA topics (`topic_definitions`)
   - ❌ Cluster matching doesn't use DNA topics

### 5.2 Learning Gaps

1. **Learning Not Applied Everywhere:**
   - ❌ RSS processor doesn't use learning weights
   - ⚠️ Some intelligence systems may not use learning

2. **Learning Disconnection:**
   - ⚠️ `show_learning_weights.topic_weights` uses generic keys (e.g., "country_china")
   - ⚠️ Not directly linked to `topic_definitions.topic_id`
   - ⚠️ Learning updates `topic_definitions.keywords` but doesn't update weights

3. **Pattern Learning:**
   - ✅ `signal_feedback_patterns` is new and working
   - ✅ `show_behavior_patterns` is working
   - ⚠️ Two separate pattern systems (could be unified)

### 5.3 Intelligence Gaps

1. **Fingerprint Caching:**
   - ✅ `topic_fingerprints` table exists and works
   - ⚠️ Cache might not be used everywhere

2. **Analytics:**
   - ❌ No `topic_stats` table for performance tracking
   - ❌ No analytics on topic performance over time

---

## PART 6: RECOMMENDATIONS

### 6.1 Single Source of Truth

**RECOMMENDATION: `topic_definitions` should be the ONLY source of truth for topics**

**Actions:**
1. ✅ **DONE:** `topic_definitions` is already primary source
2. ⚠️ **TODO:** Remove `show_dna.topics` fallback (migrate all data first)
3. ⚠️ **TODO:** Connect `topic_clusters` to `topic_definitions`
4. ⚠️ **TODO:** Merge `cluster_keywords` into `topic_definitions.keywords`

### 6.2 Unified Learning System

**RECOMMENDATION: Create unified learning service**

**Actions:**
1. ✅ **DONE:** `signal_feedback_patterns` stores pattern-based learning
2. ✅ **DONE:** `show_learning_weights` stores weight-based learning
3. ⚠️ **TODO:** Link learning weights to `topic_definitions.topic_id` (not generic keys)
4. ⚠️ **TODO:** Apply learning in RSS processor
5. ⚠️ **TODO:** Create unified learning service that combines all learning systems

### 6.3 Topic Assignment

**RECOMMENDATION: Always store matched_topic in signals**

**Actions:**
1. ⚠️ **TODO:** Store `matched_topic` (topic_id) in signals table after DNA matching
2. ⚠️ **TODO:** Create UI for manual topic assignment
3. ⚠️ **TODO:** Improve AI matching reliability

### 6.4 Clustering Integration

**RECOMMENDATION: Connect clusters to DNA topics**

**Actions:**
1. ⚠️ **TODO:** Link `topic_clusters` to `topic_definitions.topic_id`
2. ⚠️ **TODO:** Use `topic_definitions.keywords` for cluster matching (not `cluster_keywords`)
3. ⚠️ **TODO:** Auto-create clusters from DNA topics

### 6.5 Analytics

**RECOMMENDATION: Add topic performance tracking**

**Actions:**
1. ⚠️ **TODO:** Create `topic_stats` table
2. ⚠️ **TODO:** Track topic performance over time
3. ⚠️ **TODO:** Show topic analytics in dashboard

---

## SUMMARY

### ✅ What's Working:
- `topic_definitions` is primary source of truth ✅
- Learning systems are active and working ✅
- AI fingerprinting is working ✅
- Pattern-based learning is new and working ✅

### ⚠️ What Needs Fixing:
- `show_dna.topics` still used as fallback (deprecated)
- Clustering disconnected from DNA topics
- Learning not applied in RSS processor
- Learning weights use generic keys (not linked to topic_id)
- No topic performance analytics

### 🎯 Priority Actions:
1. **HIGH:** Remove `show_dna.topics` fallback (migrate data first)
2. **HIGH:** Connect clustering to `topic_definitions`
3. **MEDIUM:** Apply learning in RSS processor
4. **MEDIUM:** Link learning weights to `topic_definitions.topic_id`
5. **LOW:** Add topic performance analytics

---

**Next Steps:**
1. Review this audit
2. Prioritize fixes
3. Create migration plan
4. Build unified system
