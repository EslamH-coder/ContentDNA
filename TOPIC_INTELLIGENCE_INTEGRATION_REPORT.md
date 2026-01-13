# Topic Intelligence Integration Report

## Files That Need Topic Intelligence Integration

This report lists all files that perform text matching, keyword comparison, story grouping, duplicate detection, similarity checking, or topic matching but **DO NOT** currently use the Topic Intelligence system (`/lib/topicIntelligence.js`).

---

## Files Already Using Topic Intelligence ✅

These files are **ALREADY CONNECTED** and should be excluded:

1. `lib/behaviorPatterns.js` - ✅ Uses `generateTopicFingerprint`, `isSignalAboutTopic`
2. `lib/competitorBoost.js` - ✅ Uses `isRelevantCompetitorVideo`
3. `lib/scoring/multiSignalScoring.js` - ✅ Uses `isRelevantCompetitorVideo` (for trendsetter matching)
4. `lib/learning/signalEffectiveness.js` - ✅ Uses `generateTopicFingerprint`
5. `app/api/feedback/route.js` - ✅ Uses `generateTopicFingerprint`, `scoreSignalByPatterns`

---

## Files That Need Integration

### 1. **`/lib/clustering/clusterEngine.js`**
   - **Function**: `findMatchingClusters()`, `clusterSignals()`
   - **Does**: Groups signals into topic clusters using keyword matching
   - **Current method**: Keyword includes() matching against cluster keywords
   - **Lines**: 177-192, 11-172
   - **Should use**: `generateTopicFingerprint()` + `compareTopics()` for cluster assignment
   - **Priority**: 🔴 HIGH - Core clustering functionality

### 2. **`/lib/storySignature.js`**
   - **Function**: `calculateSignature()`, `groupBySignature()`
   - **Does**: Groups signals into stories using signature similarity
   - **Current method**: Keyword overlap + signature calculation
   - **Lines**: 1-200 (approx)
   - **Should use**: `isSameStory()` or `groupRelatedSignals()`
   - **Priority**: 🔴 HIGH - Story grouping is critical

### 3. **`/lib/intelligence/deduplicator.js`**
   - **Function**: `isDuplicate()`, `deduplicateItems()`
   - **Does**: Checks if topic/signal is duplicate
   - **Current method**: Normalized title comparison + similarity threshold
   - **Lines**: 8-62
   - **Should use**: `isSameStory()` for duplicate detection
   - **Priority**: 🟡 MEDIUM - Prevents duplicate signals

### 4. **`/lib/dna-scoring.js`**
   - **Function**: `inferTopicIdFromText()`, `scoreRssItemAgainstDna()`
   - **Does**: Matches RSS items to DNA topics using keyword matching
   - **Current method**: Keyword taxonomy matching with required/supporting keywords
   - **Lines**: 206-281 (inferTopicIdFromText), 434-599 (scoreRssItemAgainstDna)
   - **Should use**: `matchesDNATopic()` for DNA matching
   - **Priority**: 🔴 HIGH - Core DNA matching functionality

### 5. **`/lib/ai/signalFilter.js`**
   - **Function**: `filterSignal()`
   - **Does**: Pre-filters signals using keyword whitelist/blacklist
   - **Current method**: Text includes() check against keyword lists
   - **Lines**: 148-219
   - **Should use**: `generateTopicFingerprint()` for entity-based filtering
   - **Priority**: 🟡 MEDIUM - Pre-filtering (can keep keyword lists for speed, but add fingerprint as fallback)

### 6. **`/lib/filter/dnaFilter.js`**
   - **Function**: `dnaFilter()`
   - **Does**: Filters news items using DNA keyword matching
   - **Current method**: Keyword includes() check against DNA topics
   - **Lines**: 53-254
   - **Should use**: `matchesDNATopic()` for DNA matching
   - **Priority**: 🔴 HIGH - DNA filtering is core functionality

### 7. **`/lib/filter/preFilter.js`**
   - **Function**: `preFilterNews()`
   - **Does**: Pre-filters news using keyword matching
   - **Current method**: Keyword includes() check against power keywords
   - **Lines**: 94-247
   - **Should use**: `generateTopicFingerprint()` for entity extraction
   - **Priority**: 🟡 MEDIUM - Pre-filtering (can keep keywords for speed)

### 8. **`/lib/personas/personaEngine.js`**
   - **Function**: `matchNewsToPersona()`, `matchBatchToPersonas()`
   - **Does**: Matches news items to personas using keyword matching
   - **Current method**: Text includes() check against persona trigger keywords and interests
   - **Lines**: 50-108
   - **Should use**: `generateTopicFingerprint()` + entity-based matching
   - **Priority**: 🟡 MEDIUM - Persona matching (less critical but would improve accuracy)

### 9. **`/lib/personas/personaProfiles.js`**
   - **Function**: `matchTopicToPersona()`
   - **Does**: Matches topics to personas using keyword matching
   - **Current method**: Topic includes() check against persona keywords and search terms
   - **Lines**: 109-172
   - **Should use**: `generateTopicFingerprint()` for entity-based matching
   - **Priority**: 🟡 MEDIUM - Persona matching enhancement

### 10. **`/lib/intelligence/audienceBehavior.js`**
   - **Function**: `analyzeAudienceBehavior()`, `analyzeClusterMatch()`
   - **Does**: Matches items to interest clusters using keyword matching
   - **Current method**: Text includes() check against cluster keywords and patterns
   - **Lines**: 348-500 (approx)
   - **Should use**: `generateTopicFingerprint()` for entity-based cluster matching
   - **Priority**: 🟢 LOW - Behavior analysis (less critical, but would improve)

### 11. **`/lib/intelligence/enhancedScoring.js`**
   - **Function**: `matchCompetitors()`, `matchInterestClusters()`
   - **Does**: Matches competitors and interest clusters using keyword matching
   - **Current method**: Keyword split + includes() check
   - **Lines**: 143-224 (matchInterestClusters), 263-288 (matchCompetitors)
   - **Should use**: `isRelevantCompetitorVideo()` for competitor matching
   - **Priority**: 🟡 MEDIUM - Enhanced scoring uses keyword matching

### 12. **`/lib/intelligence/evidenceScorer.js`**
   - **Function**: `matchComments()`, `matchAudienceVideos()`
   - **Does**: Matches comments and audience videos using keyword matching
   - **Current method**: Topic word split + includes() check
   - **Lines**: 213-284 (approx)
   - **Should use**: `generateTopicFingerprint()` for entity-based matching
   - **Priority**: 🟡 MEDIUM - Evidence collection

### 13. **`/lib/intelligence/evidenceCollector.js`**
   - **Function**: `findCompetitorEvidence()`, `findCommentEvidence()`
   - **Does**: Matches competitors and comments using keyword matching
   - **Current method**: Keyword map lookup + includes() check
   - **Lines**: 211-298 (approx)
   - **Should use**: `isRelevantCompetitorVideo()` for competitor matching
   - **Priority**: 🟡 MEDIUM - Evidence collection

### 14. **`/lib/audienceDemand.js`**
   - **Function**: `getCompetitorBoost()`, `getAudienceQuestionBoost()`
   - **Does**: Matches competitor videos and audience questions using keyword matching
   - **Current method**: Keyword filter + includes() check (lines 424-458, 335-419)
   - **Lines**: 424-458 (getCompetitorBoost), 335-419 (getAudienceQuestionBoost)
   - **Should use**: `isRelevantCompetitorVideo()` for competitor matching
   - **Priority**: 🟡 MEDIUM - Already uses topic intelligence for patterns, but competitor/comment matching could use it

### 15. **`/lib/recommendations/unifiedRecommender.js`**
   - **Function**: `scoreNewsWithAllData()`
   - **Does**: Matches competitors and search terms using keyword matching
   - **Current method**: Title substring includes() check (lines 328-346, 349-363)
   - **Lines**: 327-363 (approx)
   - **Should use**: `isRelevantCompetitorVideo()` for competitor matching
   - **Priority**: 🟢 LOW - Legacy recommender (may be deprecated)

### 16. **`/lib/personas/competitorPitching.js`**
   - **Function**: `findMatchingPersonas()`
   - **Does**: Matches pitches to personas using keyword matching
   - **Current method**: Topic includes() check against persona interests
   - **Lines**: 160-191
   - **Should use**: `generateTopicFingerprint()` for entity-based matching
   - **Priority**: 🟢 LOW - Persona matching enhancement

### 17. **`/lib/scoring/keywordWeights.js`**
   - **Function**: `calculateMatchScore()`, `extractKeywords()`
   - **Does**: Calculates match scores using keyword weights (LEGACY SYSTEM)
   - **Current method**: Keyword extraction + weight-based scoring
   - **Lines**: 250-400 (approx)
   - **Status**: ⚠️ **LEGACY SYSTEM** - Should be replaced entirely with Topic Intelligence
   - **Priority**: 🔴 HIGH - This is the old system that causes false positives
   - **Note**: Already partially replaced in trendsetter matching, but may still be used elsewhere

### 18. **`/lib/intelligence/intelligenceEngine.js`**
   - **Function**: `extractTopicFromTitle()`, `extractTopicsFromComment()`
   - **Does**: Extracts topics from titles and comments using keyword matching
   - **Current method**: Keyword pattern matching
   - **Lines**: 283-360 (approx)
   - **Should use**: `generateTopicFingerprint()` for topic extraction
   - **Priority**: 🟡 MEDIUM - Topic extraction could be improved

---

## Priority Summary

### 🔴 HIGH PRIORITY (Core Functionality)
1. `lib/clustering/clusterEngine.js` - Signal clustering
2. `lib/storySignature.js` - Story grouping
3. `lib/dna-scoring.js` - DNA topic matching
4. `lib/filter/dnaFilter.js` - DNA filtering
5. `lib/scoring/keywordWeights.js` - **LEGACY SYSTEM** (should be deprecated)

### 🟡 MEDIUM PRIORITY (Important but not critical)
6. `lib/intelligence/deduplicator.js` - Duplicate detection
7. `lib/personas/personaEngine.js` - Persona matching
8. `lib/personas/personaProfiles.js` - Persona matching
9. `lib/intelligence/enhancedScoring.js` - Enhanced scoring
10. `lib/intelligence/evidenceScorer.js` - Evidence collection
11. `lib/intelligence/evidenceCollector.js` - Evidence collection
12. `lib/audienceDemand.js` - Competitor/question matching
13. `lib/ai/signalFilter.js` - Signal filtering
14. `lib/filter/preFilter.js` - Pre-filtering
15. `lib/intelligence/intelligenceEngine.js` - Topic extraction

### 🟢 LOW PRIORITY (Enhancements)
16. `lib/intelligence/audienceBehavior.js` - Behavior analysis
17. `lib/recommendations/unifiedRecommender.js` - Legacy recommender
18. `lib/personas/competitorPitching.js` - Persona matching

---

## Integration Functions Available

From `/lib/topicIntelligence.js`:

- `generateTopicFingerprint(content)` - Extract entities & category
- `compareTopics(item1, item2)` - Compare two items
- `isRelevantCompetitorVideo(idea, video)` - Check video relevance
- `isSameStory(signal1, signal2)` - Check if same story
- `hasBeenCovered(idea, videos)` - Check if covered before
- `matchesDNATopic(idea, dnaTopic)` - Check DNA match
- `groupRelatedSignals(signals)` - Group related signals

---

## Notes

- Files marked as "already connected" are using Topic Intelligence and should **NOT** be modified
- The `keywordWeights.js` file is the **LEGACY SYSTEM** that causes false positives (like "china" matching Iran stories)
- Priority is based on impact: core functionality (HIGH) vs enhancements (LOW)
- Some files (like `signalFilter.js`, `preFilter.js`) might keep keyword lists for speed but add Topic Intelligence as a fallback/validation
