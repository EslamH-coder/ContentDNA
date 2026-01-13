# Ultimate Data-Driven Recommendation System

## Overview

This system combines ALL data sources (channels, videos, comments, search terms, competitors) to generate intelligent recommendations based on:
- Persona matching
- Audience questions/requests
- Topic opportunities
- Competitor analysis
- Performance patterns

## Architecture

```
CSV Data (src/data/raw/)
    ↓
Data Converter (scripts/masterConverter.js)
    ↓
Processed JSON (data/processed/)
    ↓
Unified Data (data/unified_data.json)
    ↓
Analysis Engines
    ├── Audience Analyzer
    ├── Comment Analyzer
    └── Video Pattern Analyzer
    ↓
Unified Recommender
    ↓
API Routes
    ↓
Recommendations
```

## Files Created

### 1. Data Importer (`lib/data/dataImporter.js`)
- Updated to load from converted data
- Loads channels, videos, comments, search terms
- Integrates with unified_data.json

### 2. Analysis Engines

#### `lib/analysis/audienceAnalyzer.js`
- Analyzes "other channels" → discovers personas
- Analyzes "other videos" → finds topic opportunities
- Categorizes channels and maps to personas

#### `lib/analysis/commentAnalyzer.js`
- Extracts questions from comments
- Identifies requests and video ideas
- Analyzes sentiment

#### `lib/analysis/videoPatternAnalyzer.js` (NEW)
- Analyzes title patterns (questions, numbers, power words)
- Analyzes length patterns
- Analyzes topic patterns (winning vs losing topics)
- Analyzes CTR, retention, traffic sources
- Analyzes publish patterns (best days/times)

### 3. Unified Recommender (`lib/recommendations/unifiedRecommender.js`) (NEW)
- Combines all data sources
- Generates comprehensive recommendations
- Scores news items with all data
- Priority system:
  1. URGENT: Personas not served this week
  2. HIGH: Questions from audience
  3. HIGH: Topic opportunities
  4. MEDIUM: Competitor pitches
  5. MEDIUM: Ideas from comments

### 4. API Routes

#### `app/api/recommendations/route.js`
- `GET /api/recommendations` - Get all recommendations
- `POST /api/recommendations` - Score a news item

#### `app/api/data/import/route.js`
- `POST /api/data/import` - Import all data

#### `app/api/data/status/route.js`
- `GET /api/data/status` - Check data availability

#### `app/api/analysis/comments/route.js`
- `POST /api/analysis/comments` - Analyze comments

#### `app/api/analysis/patterns/route.js`
- `GET /api/analysis/patterns` - Analyze video patterns

## Usage

### 1. Convert Your Data

```bash
# Place CSV files in src/data/raw/
# Run converter
node scripts/masterConverter.js
```

### 2. Get Recommendations

```javascript
// In your code
import { getRecommendations } from '@/lib/recommendations/unifiedRecommender.js';

const recommendations = await getRecommendations();
console.log(recommendations.urgentPersonaNeeds);
console.log(recommendations.audienceQuestions);
console.log(recommendations.topicOpportunities);
```

### 3. Score News Items

```javascript
import { scoreNewsWithAllData } from '@/lib/recommendations/unifiedRecommender.js';

const scored = await scoreNewsWithAllData({
  title: "ترامب يعلن عن قرار جديد",
  description: "..."
});

console.log(scored.totalScore); // 0-100+
console.log(scored.factors); // Why it scored this way
console.log(scored.recommendation); // HIGHLY_RECOMMENDED, RECOMMENDED, OPTIONAL
```

### 4. Use API Endpoints

```bash
# Get all recommendations
curl http://localhost:3000/api/recommendations

# Check data status
curl http://localhost:3000/api/data/status

# Analyze comments
curl -X POST http://localhost:3000/api/analysis/comments

# Get video patterns
curl http://localhost:3000/api/analysis/patterns
```

## Recommendation Priority

```
1️⃣ URGENT: Personas not served this week
   → Generate content for underserved personas immediately

2️⃣ HIGH: Questions from audience (most liked)
   → Answer what your audience is asking

3️⃣ HIGH: Topic opportunities (audience watches but we don't cover)
   → Cover topics your audience is interested in

4️⃣ MEDIUM: Competitor pitches
   → Learn from what competitors are covering

5️⃣ MEDIUM: Ideas from comments
   → Implement audience suggestions
```

## News Scoring System

Each news item is scored by:

```javascript
+ Persona match score (0-50)
+ Is topic in "other videos audience watches"? (+20)
+ Does it answer a top question? (+25)
+ Is it a historically winning topic? (+15)
+ Are competitors covering it? (+10)
+ Is it a high-opportunity search term? (+15)
= Total Score → Recommendation level

Score >= 50: HIGHLY_RECOMMENDED
Score >= 30: RECOMMENDED
Score < 30: OPTIONAL
```

## Data Sources Used

| Data Source | Used For |
|-------------|----------|
| **Other channels your audience watches** | Auto-discover personas, understand audience |
| **Other videos your audience watches** | Find topic opportunities |
| **Video Performance (CTR, Views, Retention)** | Find winning patterns, best topics |
| **Comments** | Extract questions, requests, video ideas |
| **Search Terms** | What they search for, SEO keywords |
| **Demographics** | Country-specific content, growth signals |
| **Traffic Sources** | Where audience comes from |
| **Publish Times** | Best day/time to publish |
| **Competitor Videos** | Topic pitches, what to cover |
| **Adjacent Content** | Format inspiration, crossover ideas |

## Integration with Existing Systems

The unified recommender integrates with:
- ✅ Persona Engine (`lib/personas/personaEngine.js`)
- ✅ Competitor Pitching (`lib/personas/competitorPitching.js`)
- ✅ DNA System (via persona matching)
- ✅ RSS Processor (can use scoring function)

## Example Output

```json
{
  "urgentPersonaNeeds": [
    {
      "persona": "🌍 المحلل الجيوسياسي",
      "reason": "لم يتم تقديم محتوى لهذا الجمهور هذا الأسبوع",
      "suggestedTopics": ["ترامب", "الصين", "الصراعات"],
      "priority": "URGENT"
    }
  ],
  "audienceQuestions": [
    {
      "question": "كيف اصبحت المانيا قوه اقتصاديه",
      "likes": 15,
      "recommendation": "اصنع فيديو يجيب على: \"كيف اصبحت المانيا قوه اقتصاديه\"",
      "priority": "HIGH"
    }
  ],
  "topicOpportunities": [
    {
      "topic": "china",
      "audienceInterest": 25,
      "recommendation": "جمهورك يشاهد 25 فيديو عن \"china\" - فرصة!",
      "priority": "HIGH"
    }
  ],
  "summary": {
    "topRecommendation": {
      "type": "persona",
      "message": "الأولوية: محتوى لـ 🌍 المحلل الجيوسياسي - لم يُخدم هذا الأسبوع",
      "action": "ترامب"
    }
  }
}
```

## Next Steps

1. **Test the system**: Run the converter and check recommendations
2. **Integrate with RSS processor**: Use `scoreNewsWithAllData` in RSS processing
3. **Create UI**: Build a dashboard to show recommendations
4. **Automate**: Set up periodic data updates and recommendation generation

## Troubleshooting

**"No data available"**
- Run `node scripts/masterConverter.js` first
- Check that CSV files are in `src/data/raw/`

**"Persona not found"**
- Make sure persona definitions exist in `lib/personas/personaDefinitions.js`

**"API errors"**
- Check that all dependencies are installed
- Verify data files exist in `data/processed/`




