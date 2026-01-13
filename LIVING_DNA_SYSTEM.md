# Living DNA System

## Overview

The Living DNA System learns from every new video's performance data and automatically updates Channel DNA patterns, insights, and recommendations.

## Concept

**Static DNA (Old):**
- Fixed patterns from initial analysis
- Never updates
- Gets stale

**Living DNA (New):**
- Updates after every video
- Learns what works NOW
- Tracks audience behavior changes
- Writes its own notes/insights

## Architecture

```
[New Video Published] 
  ↓
[Performance Data] 
  ↓
[DNA Analyzer] 
  ↓
[Updated DNA] 
  ↓
[LLM Context] 
  ↓
[Better Recommendations]
```

## Files Created

1. **`lib/dna/livingDNA.js`** - DNA structure definition
2. **`lib/dna/dnaUpdater.js`** - Updates DNA from video performance data
3. **`lib/dna/dnaToPrompt.js`** - Converts DNA to LLM prompt context
4. **`lib/dna/dnaStorage.js`** - Load/save DNA from JSON file
5. **`app/api/dna/update/route.js`** - API endpoint to update DNA
6. **`app/api/dna/prompt/route.js`** - API endpoint to get DNA prompt
7. **`app/api/dna/dashboard/route.js`** - API endpoint for DNA dashboard

## How It Works

### 1. When New Video is Published

After a video has 48+ hours of performance data:

```javascript
const videoData = {
  title: 'لماذا ترامب يرفع الرسوم الجمركية 60%؟',
  hook: 'في 28 ديسمبر 2025 الرئيس الأمريكي دونالد ترامب...',
  topic: 'us_china_trade',
  views: 1500000,
  retention_30s: 75,
  avg_viewed_pct: 48,
  ctr: 5.5,
  duration_minutes: 24,
  publish_date: '2025-12-28'
};

// Update DNA
await fetch('/api/dna/update', {
  method: 'POST',
  body: JSON.stringify(videoData)
});
```

### 2. DNA Analyzer Updates

The system automatically:
- **Updates topic performance** (avg views, retention, trend)
- **Analyzes hook patterns** (which patterns work best)
- **Tracks format insights** (optimal duration)
- **Generates LLM insights** (what worked/failed)
- **Identifies audience behavior** (click triggers, retention triggers, traps)

### 3. DNA Writes Its Own Notes

After processing, the system generates insights like:

```json
{
  "performance": "above_average",
  "observations": [
    "الفيديو حقق 1.5M مشاهدة مقابل متوسط 1.2M",
    "نمط date_entity_action في الهوك أثبت فعاليته مرة أخرى"
  ],
  "what_worked": [
    "استخدام تاريخ محدد في بداية الهوك",
    "ذكر الرقم 60% في العنوان"
  ],
  "warning": "موضوع currency_devaluation أداؤه ضعيف في آخر 3 فيديوهات"
}
```

### 4. LLM Uses Living DNA

When generating new content, the LLM now sees:

```
# Channel DNA - المُخبر الاقتصادي+
آخر تحديث: 2025-12-28
عدد الفيديوهات المحللة: 72

## أداء المواضيع:
📈 us_china_trade: 1,800,000 مشاهدة، 75% retention (5 فيديو)
📉 currency_devaluation: 600,000 مشاهدة، 76% retention (3 فيديو) ⚠️

## أنماط الهوك الناجحة:
### date_entity_action (76% retention)
مثال: "في 28 ديسمبر 2025 الرئيس الأمريكي..."
المشاهدات: 2,851,313

## ⚠️ فخاخ:
- "موضوع X": 76% retention لكن 484K مشاهدة فقط (ceiling topic)

## آخر الملاحظات:
**الفيديو الأخير** (above_average):
- نمط date_entity_action أثبت فعاليته
- موضوع us_china_trade في ارتفاع مستمر
```

## DNA Evolution Example

### Week 1:
```
Topics: { us_china_trade: { avg_views: 1.2M, trend: 'new' } }
Hooks: { date_entity_action: { avg_retention: 74% } }
Insights: []
```

### Week 4:
```
Topics: { 
  us_china_trade: { avg_views: 1.8M, trend: 'rising' },
  missiles_defense: { avg_views: 2.1M, trend: 'stable' },
  currency_devaluation: { avg_views: 600K, trend: 'falling' }  // ⚠️
}
Hooks: { 
  date_entity_action: { avg_retention: 76%, best: 2.85M views }
}
Insights: [
  "currency_devaluation has ceiling - high retention but low views",
  "date_entity_action consistently outperforms"
]
Banned: {
  weak_topics: ['currency_devaluation']  // Auto-added!
}
```

## API Endpoints

### Update DNA
```bash
POST /api/dna/update
Body: { title, hook, topic, views, retention_30s, ctr, duration_minutes, publish_date }
```

### Get DNA Prompt
```bash
GET /api/dna/prompt
Returns: { prompt, metadata }
```

### Get DNA Dashboard
```bash
GET /api/dna/dashboard
Returns: { topics, hooks, insights, banned, summary }
```

## Integration

The Living DNA is automatically used in:
- **DNA-informed LLM generation** - LLM sees current DNA state
- **Template selection** - Templates use DNA performance data
- **Topic recommendations** - Avoids weak topics from DNA
- **Hook pattern selection** - Uses best-performing patterns

## Benefits

| Static DNA | Living DNA |
|------------|------------|
| Set once, never changes | Updates after every video |
| Misses new patterns | Discovers new patterns automatically |
| Doesn't know what failed | Tracks failures and adds to banned list |
| No audience behavior tracking | Learns audience behavior over time |
| Manual analysis needed | Auto-generates insights |
| Gets stale | Always current |

## Next Steps

1. **Import existing video data** - Initialize DNA with historical videos
2. **Set up automatic updates** - Trigger DNA update when video performance data is available
3. **Create DNA dashboard UI** - Visualize DNA evolution
4. **Monitor DNA insights** - Review auto-generated insights and warnings




