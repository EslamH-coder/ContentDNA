# 360° Content Intelligence V2
## With Groq AI Integration + Smart Filtering

---

## 🎯 What's New in V2

| Feature | V1 | V2 |
|---------|----|----|
| Topic Understanding | Keywords only | **Groq AI context** |
| Comment Filtering | All comments | **Smart: real requests only** |
| Persona Matching | Keyword match | **AI understands intent** |
| Suggested Angle | Template | **Creative AI pitch** |
| Personas | 6 | **8 (2 new)** |
| Cost | $0 | **~$0.50/month** |

---

## 📁 Files Created/Updated

### Core Intelligence Files
1. **`lib/intelligence/groqClient.js`** - Groq API client for fast, cheap AI
2. **`lib/intelligence/personas.js`** - 8 personas (2 new: employee, student_entrepreneur)
3. **`lib/intelligence/smartCommentAnalyzer.js`** - AI-powered comment filtering
4. **`lib/intelligence/topicAnalyzer.js`** - Deep topic analysis with AI
5. **`lib/intelligence/evidenceScorer.js`** - Data + AI scoring system
6. **`lib/intelligence/recommendationEngine.js`** - Main V2 recommendation engine
7. **`lib/intelligence/manualTrendInput.js`** - Manual trend management
8. **`lib/intelligence/marketIntelligence.js`** - Market suggestions from data

### API Routes
1. **`app/api/intel/recommendations/route.js`** - V2 recommendations endpoint
2. **`app/api/intel/score-topic/route.js`** - Updated to use V2 scorer
3. **`app/api/intel/add-trend/route.js`** - Manual trend input

### UI
1. **`app/intel/page.js`** - Updated to display V2 recommendations

---

## 🚀 Setup

### 1. Add Groq API Key

Add to your `.env.local`:
```bash
GROQ_API_KEY=your_groq_api_key_here
```

Get a free key at: https://console.groq.com

### 2. Models Used

- **FAST** (`llama-3.1-8b-instant`): $0.05/1M tokens - For filtering
- **SMART** (`llama-3.3-70b-versatile`): $0.59/1M tokens - For deep analysis

### 3. Cost Estimate

Per day (assuming 80 analyses):
- Smart Model: ~50 calls × 500 tokens = 25K tokens
- Fast Model: ~100 calls × 300 tokens = 30K tokens
- **Total: ~$0.50/month** 🎉

---

## 🎯 New Personas

### 7. 👔 الموظف - الاقتصاد الشخصي
- **Interests**: إدارة الراتب، الادخار، الاقتصاد السلوكي
- **Keywords**: راتب، ادخار، ميزانية، ديون، تقاعد
- **Sample Question**: "كيف أدخر من راتبي الشهري؟"

### 8. 🚀 الطالب - ريادة الأعمال
- **Interests**: المشاريع الناشئة، ريادة الأعمال، التمويل
- **Keywords**: ستارت اب، مشروع، ريادة، تمويل، MVP
- **Sample Question**: "كيف أبدأ مشروعي الخاص وأنا طالب؟"

---

## 🔄 How It Works

### 1. **Smart Comment Analysis**
- Pre-filters comments for request indicators
- Uses Groq AI to identify real content requests
- Extracts video ideas from actionable comments
- Saves filtered comments to `data/processed/smart_comments.json`

### 2. **Topic Analysis**
- Uses Groq AI to understand topic context
- Matches to personas intelligently
- Generates suggested angles
- Determines urgency (breaking, this_week, evergreen)

### 3. **Evidence-Based Scoring**
- **Data Score**: From search terms, comments, videos, manual trends
- **AI Score**: From Groq analysis (relevance, persona match)
- **Total Score**: Combined (0-100)
- **Recommendation**: HIGHLY_RECOMMENDED, RECOMMENDED, CONSIDER, SKIP

### 4. **Pitch Generation**
- For top recommendations only
- Uses Groq AI to generate creative pitches
- Includes: title, hook, angle, CTA

---

## 📊 API Usage

### Get Recommendations
```javascript
GET /api/intel/recommendations?rssItems=[...]
```

### Score a Topic
```javascript
POST /api/intel/score-topic
{
  "topic": "الاقتصاد الإسلامي",
  "sourceType": "manual"
}
```

### Add Manual Trend
```javascript
POST /api/intel/add-trend
{
  "type": "idea",
  "topic": "الاقتصاد الإسلامي",
  "description": "...",
  "persona": "employee"
}
```

---

## 🎨 UI Features

The `/intel` page now displays:
- ✅ V2 AI-powered recommendations with scores
- ✅ Evidence breakdown for each recommendation
- ✅ Suggested angles from AI
- ✅ Creative pitches for top items
- ✅ Summary stats (total, highly recommended, processing time)
- ✅ Quick score topic input
- ✅ Manual trend input with persona selection

---

## 🔍 Data Sources

1. **RSS News** - Scored with AI analysis
2. **Manual Trends** - Bonus +10 points
3. **Market Intelligence** - From audience data
4. **Comment Video Ideas** - Bonus +15 points (direct audience requests)

---

## ⚠️ Notes

- Groq API key is required for AI features
- If key is missing, system falls back to data-only scoring
- Comments are pre-filtered to save API costs
- Pitches are generated only for top 5 recommendations
- Processing time: ~5-10 seconds for 20 items

---

## 🐛 Troubleshooting

### "GROQ_API_KEY not configured"
- Add `GROQ_API_KEY` to `.env.local`
- Restart dev server

### "0 recommendations"
- Check if data files exist in `data/processed/`
- Verify Groq API key is valid
- Check console for errors

### "Comments not analyzed"
- Ensure `data/processed/comments.json` exists
- Run data converter first if needed

---

## 📈 Next Steps

1. ✅ Add Groq API key
2. ✅ Test with manual trends
3. ✅ Review AI-generated pitches
4. ✅ Adjust scoring thresholds if needed
5. ✅ Monitor API costs

---

**Cost**: ~$0.50/month for full AI-powered intelligence! 🎉




