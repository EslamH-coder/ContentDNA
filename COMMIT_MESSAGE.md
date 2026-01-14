# Git Commit Message

## Commit Title:
feat: Unified Taxonomy System + Scoring Fixes + Auto-Learning

## Commit Description:

### Major Features:
- **Unified Taxonomy System**: Created single source of truth using `topic_definitions`
  - New service: `/lib/taxonomy/unifiedTaxonomyService.js`
  - Auto-learning from user feedback
  - Performance tracking per topic
  - Migration from `show_dna.topics` to `topic_definitions`

- **Auto-Learning & Keyword Generation**:
  - Keywords auto-learned from liked signals
  - AI-powered keyword generation for new topics
  - Keyword enrichment API endpoint
  - Onboarding auto-enriches topic keywords

### Bug Fixes:
- Fixed "showId is not defined" error in feedback route
- Fixed "aiCountries is not defined" error in DNA matching
- Fixed "channel_title" column error (removed non-existent column)
- Fixed cluster matching to use unified taxonomy service
- Fixed undefined values in AI entity loops
- Fixed generic term filter repeating in loops
- Lowered keyword weight threshold from 6 to 4
- Reduced saturation penalties (gentler for 3-7 days)
- Increased indirect breakout bonus (scales by multiplier)
- Improved DNA match bonus scaling (20 + 5 per match, max 35)

### Scoring Improvements:
- DNA bonus now scales: 1 match = +20, 2 = +25, 3 = +30, 4+ = +35
- Indirect breakout scales by multiplier (5.7x = +23 points)
- Saturation penalty: -15 for <3 days, -5 for 3-7 days (was -30 for <14)
- Added detailed score breakdown logging for high-scoring signals

### Onboarding Fixes:
- Disabled thumbnail analysis (AI Vision)
- Auto-generate topics if missing before classification
- Graceful fallback if topics can't be generated

### Code Quality:
- Removed deprecation warnings from keywordWeights.js
- Enhanced logging throughout
- Better error handling

### Files Created:
- `/lib/taxonomy/unifiedTaxonomyService.js`
- `/lib/taxonomy/keywordGenerator.js`
- `/app/api/taxonomy/enrich-keywords/route.js`
- `/app/api/taxonomy/migrate/route.js`
- `/migrations/enhance_topic_definitions_unified.sql`
- `/migrations/add_banking_keywords.sql`
- `/lib/testing/scoringTests.js`
- `/lib/testing/rssQualityCheck.js`
- `/UNIFIED_TAXONOMY_IMPLEMENTATION.md`
- `/AUTO_LEARNING_VERIFICATION.md`
- `/TAXONOMY_LEARNING_INTELLIGENCE_AUDIT.md`

### Files Modified:
- `/app/api/signals/route.js` - Uses unified taxonomy service
- `/app/api/studio/signals/route.js` - Uses unified taxonomy service
- `/app/api/feedback/route.js` - Fixed showId, enhanced learning
- `/app/api/clusters/route.js` - Uses unified taxonomy service
- `/app/api/onboarding/analyze/route.js` - Disabled thumbnails, auto-generate topics
- `/lib/scoring/multiSignalScoring.js` - Scoring improvements, bug fixes
- `/lib/entities/sourceNameExtractor.js` - Removed channel_title column
- `/lib/scoring/keywordWeights.js` - Removed deprecation warnings
