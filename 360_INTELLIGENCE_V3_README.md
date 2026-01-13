# 360° Content Intelligence V3
## Evidence-First System with Full Data Integration

---

## ✅ IMPLEMENTATION COMPLETE

All core components have been implemented:

### 📁 Files Created/Updated:

1. **`lib/data/dataStore.js`** ✅
   - Central data store that loads all sources once
   - Fast lookup maps for search terms, videos, competitors
   - Deduplication tracking

2. **`lib/intelligence/evidenceCollector.js`** ✅
   - Collects evidence from ALL data sources
   - Scores: Search (30), Audience (25), Competitor (20), Comments (15), Persona (10)
   - Determines evidence strength: NONE, WEAK, MODERATE, STRONG

3. **`lib/intelligence/deduplicator.js`** ✅
   - Smart deduplication with similarity matching
   - Prevents same topic from appearing multiple times

4. **`lib/ai/claudePitcher.js`** ✅ (Updated)
   - Uses evidence context in prompts
   - No forced "Arab investor" angles
   - Natural, creative pitch generation

5. **`lib/intelligence/recommendationEngineV3.js`** ✅
   - Main engine: Evidence-First approach
   - 4 phases: Collect → Evidence → Rank → Pitch
   - Only recommends if evidence exists

6. **`app/api/intelligence/recommend/route.js`** ✅
   - POST endpoint for generating recommendations

7. **`app/api/intelligence/score/route.js`** ✅
   - POST endpoint for scoring single topics

8. **`app/api/intel/recommendations/route.js`** ✅ (Updated)
   - Updated to use V3 engine

---

## 🎯 HOW IT WORKS

### Phase 1: Collect Candidates
- RSS items (deduplicated)
- Manual trends
- High-demand search terms

### Phase 2: Collect Evidence
For each candidate:
- ✅ Search terms: Does audience search for this?
- ✅ Audience videos: Do they watch similar content?
- ✅ Competitors: Did competitors cover this?
- ✅ Comments: Did audience request this?
- ✅ Persona match: Which persona cares?

**Only keeps items with evidence OR manual trends**

### Phase 3: Rank
- Sort by total evidence score
- Select top N candidates

### Phase 4: Generate Pitches
- Top 10 get full Claude pitches
- Rest get evidence summary only

---

## 📊 EVIDENCE SCORING

| Source | Max Points | How It Works |
|--------|-----------|--------------|
| **Search Terms** | 30 | Views / 300 (capped at 30) |
| **Audience Videos** | 25 | 2.5 points per video (max 10) |
| **Competitors** | 20 | 2 points per video + 5 if recent |
| **Comments** | 15 | 5 points per request (max 3) |
| **Persona Match** | 10 | Keyword/interest matching |

**Total Score: 0-100**

---

## 🔍 EVIDENCE STRENGTH

| Strength | Evidence Sources | Recommendation |
|----------|----------------|----------------|
| **STRONG** | 3-4 sources | HIGHLY_RECOMMENDED |
| **MODERATE** | 2 sources | RECOMMENDED |
| **WEAK** | 1 source | CONSIDER |
| **NONE** | 0 sources | SKIP |

---

## 🚀 USAGE

### Generate Recommendations

```javascript
POST /api/intelligence/recommend
{
  "rssItems": [...],
  "manualTrends": [...],
  "limit": 20
}
```

### Score Single Topic

```javascript
POST /api/intelligence/score
{
  "topic": "الذهب يصل 3000$",
  "description": "...",
  "generateFullPitch": true
}
```

---

## 📂 DATA FILES REQUIRED

The system expects these files in `data/processed/`:

- `search_terms.json` - YouTube search terms with views
- `audience_videos.json` - Videos your audience watches
- `channels.json` - Competitor channels
- `smart_comments.json` - AI-filtered comment requests

If files are missing, the system will continue with available data.

---

## 🎨 EXAMPLE OUTPUT

```json
{
  "recommendations": [
    {
      "topic": "الصين تفرض رسوم جمركية جديدة",
      "score": 85,
      "recommendationLevel": "HIGHLY_RECOMMENDED",
      "evidenceStrength": "STRONG",
      "evidence": {
        "search": {
          "found": true,
          "totalViews": 14465,
          "summary": "14,465 بحث: \"الصين\"، \"الصين وامريكا\""
        },
        "audience": {
          "found": true,
          "matchedVideos": 23,
          "summary": "جمهورك شاهد 23 فيديو مشابه"
        },
        "competitor": {
          "found": true,
          "matchedVideos": 8,
          "summary": "8 فيديوهات من المنافسين - تغطية حديثة!"
        },
        "comments": {
          "found": true,
          "summary": "3 طلبات من الجمهور"
        }
      },
      "persona": {
        "id": "geopolitics",
        "name": "🌍 المحلل الجيوسياسي"
      },
      "pitch": {
        "title": "حرب الرسوم 2.0: لماذا هذه المرة مختلفة؟",
        "hook": "في 2018 بدأت الحرب التجارية. في 2025 عادت بشكل أخطر.",
        "angle": "تحليل الفرق بين حرب ترامب الأولى والثانية",
        "mainPoints": [...],
        "cta": "..."
      }
    }
  ]
}
```

---

## ⚠️ NO EVIDENCE = NO RECOMMENDATION

If a topic has:
- ❌ No search demand
- ❌ Audience doesn't watch similar
- ❌ Competitors didn't cover
- ❌ No comment requests
- ❌ No persona match

→ **SKIPPED** (unless it's a manual trend)

---

## 🔄 NEXT STEPS

1. ✅ Core system implemented
2. 🔄 Update UI to show evidence breakdown
3. 🔄 Add data converters for CSV files
4. 🔄 Test with real RSS items
5. 🔄 Monitor performance and adjust scoring

---

**The system is now evidence-first: No evidence = No recommendation!** 🎯




