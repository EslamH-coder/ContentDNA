# Ideas Feature: Complete Transformation Example
## From Raw RSS Item to Displayed Idea Card

This document shows a real example of how a raw RSS item transforms through the entire pipeline, step by step.

---

## Example: "China's Oil Imports from Russia Hit Record High"

### Step 1: Raw RSS Item (Before Processing)

```json
{
  "title": "China's Oil Imports from Russia Hit Record High Amid Sanctions",
  "description": "China imported a record 2.1 million barrels per day of Russian oil in December, up 15% from the previous month, as Western sanctions push Moscow to offer steep discounts.",
  "link": "https://www.reuters.com/world/china/chinas-oil-imports-russia-hit-record-high-amid-sanctions-2024-01-15/",
  "source": "Reuters",
  "published": "2024-01-15T08:30:00Z",
  "category": "world",
  "guid": "reuters-2024-01-15-oil-imports"
}
```

**Raw Data:**
- **Title:** "China's Oil Imports from Russia Hit Record High Amid Sanctions"
- **Source:** Reuters
- **Published:** 2024-01-15T08:30:00Z (12 hours ago)
- **Type:** News article

---

### Step 2: After RSS Processor (Saved to Database)

The RSS processor runs DNA-based recommendation engine and saves to `signals` table:

```json
{
  "id": "abc123-def456-ghi789",
  "show_id": "a7982c70-2b0e-46af-a0ad-c78f4f69cd56",
  "title": "الصين تستورد كميات قياسية من النفط الروسي رغم العقوبات",
  "source": "Reuters",
  "source_url": "https://www.reuters.com/world/china/chinas-oil-imports-russia-hit-record-high-amid-sanctions-2024-01-15/",
  "score": 7.5,
  "hook_potential": 8.2,
  "type": "news",
  "status": "new",
  "topic_id": "energy_oil_gas_lng",
  "published_at": "2024-01-15T08:30:00Z",
  "created_at": "2024-01-15T20:45:00Z",
  "raw_data": {
    "recommendation": {
      "priority": "HIGH",
      "topic": "energy_oil_gas_lng",
      "confidence": 85,
      "arab_angle": "تأثير العقوبات الغربية على الاقتصاد الروسي والصيني",
      "hook_type": "surprising_fact",
      "format": "long_form"
    }
  }
}
```

**Key Changes:**
- ✅ Title translated to Arabic (DNA-based recommendation)
- ✅ Topic classified: `energy_oil_gas_lng`
- ✅ Priority: HIGH
- ✅ Hook potential: 8.2/10
- ✅ Base score: 7.5/10 (from RSS processor)

---

### Step 3: Signals API Fetches Context Data

When `/api/signals` is called, it fetches:

#### 3.1 Competitor Videos (Last 7 Days)
```json
[
  {
    "id": "comp-vid-1",
    "title": "Why Russia is Selling Oil to China at a Discount",
    "competitor_id": "bloomberg-id",
    "competitors": {
      "channel_name": "Bloomberg",
      "id": "bloomberg-id"
    },
    "views": 2500000,
    "published_at": "2024-01-14T10:00:00Z",
    "average_views": 800000  // Bloomberg's average
  },
  {
    "id": "comp-vid-2",
    "title": "China-Russia Energy Trade Reaches New Heights",
    "competitor_id": "ft-id",
    "competitors": {
      "channel_name": "Financial Times",
      "id": "ft-id"
    },
    "views": 1200000,
    "published_at": "2024-01-13T14:00:00Z",
    "average_views": 600000
  },
  {
    "id": "comp-vid-3",
    "title": "Oil Prices and Geopolitics: The Russia-China Connection",
    "competitor_id": "wsj-id",
    "competitors": {
      "channel_name": "Wall Street Journal",
      "id": "wsj-id"
    },
    "views": 950000,
    "published_at": "2024-01-12T09:00:00Z",
    "average_views": 500000
  }
]
```

#### 3.2 User Videos (Last 100)
```json
[
  {
    "id": "user-vid-1",
    "title": "تأثير العقوبات على الاقتصاد الروسي",
    "published_at": "2023-11-20T10:00:00Z",
    "topic_id": "sanctions_econ_war"
  },
  {
    "id": "user-vid-2",
    "title": "النفط والاقتصاد العالمي",
    "published_at": "2023-09-15T14:00:00Z",
    "topic_id": "energy_oil_gas_lng"
  }
]
```

#### 3.3 DNA Topics
```json
[
  {
    "topic_id": "energy_oil_gas_lng",
    "keywords": ["نفط", "طاقة", "روسيا", "الصين", "عقوبات"],
    "name": "النفط والطاقة"
  },
  {
    "topic_id": "sanctions_econ_war",
    "keywords": ["عقوبات", "حرب اقتصادية", "روسيا", "أمريكا"],
    "name": "العقوبات والحرب الاقتصادية"
  },
  {
    "topic_id": "us_china_geopolitics",
    "keywords": ["الصين", "أمريكا", "جغرافيا سياسية", "تجارة"],
    "name": "الجغرافيا السياسية"
  }
]
```

#### 3.4 Learned Adjustments (From Feedback History)
```json
{
  "topicScores": {
    "energy_oil_gas_lng": 0.7,  // User likes this topic
    "sanctions_econ_war": 0.5,
    "us_china_geopolitics": 0.3
  },
  "signalEffectiveness": {
    "competitor_breakout": {
      "ratio": 0.85,  // 85% positive feedback
      "positive": 17,
      "negative": 3,
      "total": 20
    },
    "dna_match": {
      "ratio": 0.75,
      "positive": 15,
      "negative": 5,
      "total": 20
    }
  },
  "feedbackCount": 45
}
```

---

### Step 4: Multi-Signal Scoring Calculation

The `calculateIdeaScore()` function processes the signal:

```javascript
// Input
const signal = {
  id: "abc123-def456-ghi789",
  title: "الصين تستورد كميات قياسية من النفط الروسي رغم العقوبات",
  topic_id: "energy_oil_gas_lng",
  published_at: "2024-01-15T08:30:00Z"
};

const context = {
  competitorVideos: [...], // 3 videos found
  userVideos: [...], // Last covered 56 days ago
  dnaTopics: [...], // Matches energy_oil_gas_lng
  sourceCount: 1
};
```

#### Scoring Breakdown:

**Signal 1: Competitor Breakout** ✅
- Bloomberg video: 2.5M views vs 800K average = **3.1x multiplier**
- **+30 points**
- Signal: `🔥 Competitor breakout: Bloomberg got 3.1x their average`

**Signal 2: Multiple Competitors** ✅
- 3 competitors posted about this topic in last 7 days
- **+20 points**
- Signal: `📊 3 competitors posted about this`

**Signal 3: DNA Match** ✅
- Topic `energy_oil_gas_lng` matches channel DNA
- Keywords match: "نفط", "روسيا", "الصين", "عقوبات"
- **+20 points**
- Signal: `✅ Matches your DNA: energy_oil_gas_lng`

**Signal 4: RSS Recency** ✅
- Published 12 hours ago (< 48 hours)
- **+15 points**
- Signal: `📰 Trending: 1 source in 48h`

**Signal 5: Not Saturated** ✅
- User last covered this topic 56 days ago (> 30 days)
- **+15 points**
- Signal: `⏰ Last covered: 56 days ago`

**Total Base Score: 100 points** (capped at 100)

```json
{
  "score": 100,
  "signals": [
    {
      "type": "competitor_breakout",
      "icon": "🔥",
      "text": "Competitor breakout: Bloomberg got 3.1x their average",
      "weight": "high",
      "data": {
        "channelName": "Bloomberg",
        "multiplier": 3.1,
        "views": 2500000,
        "averageViews": 800000
      }
    },
    {
      "type": "competitor_volume",
      "icon": "📊",
      "text": "3 competitors posted about this",
      "weight": "medium",
      "data": { "count": 3 }
    },
    {
      "type": "dna_match",
      "icon": "✅",
      "text": "Matches your DNA: energy_oil_gas_lng",
      "weight": "medium",
      "data": { "topics": ["energy_oil_gas_lng"] }
    },
    {
      "type": "recency",
      "icon": "📰",
      "text": "Trending: 1 source in 48h",
      "weight": "medium",
      "data": { "hoursAgo": 12, "sourceCount": 1 }
    },
    {
      "type": "freshness",
      "icon": "⏰",
      "text": "Last covered: 56 days ago",
      "weight": "low",
      "data": { "daysSinceLastPost": 56 }
    }
  ],
  "signalCount": 5,
  "isValid": true
}
```

---

### Step 5: Urgency Tier Assignment

The `getUrgencyTier()` function assigns:

```javascript
// Input
const scoring = {
  score: 100,
  signalCount: 5,
  signals: [...]
};

const signal = {
  // Has competitor breakout
};
```

**Result:**
- Score: 100 ✅ (>= 70)
- Signal Count: 5 ✅ (>= 3)
- Competitor Breakout: Yes ✅

**Urgency Tier: 🔴 POST TODAY**

```json
{
  "tier": "today",
  "label": "Post Today",
  "color": "red",
  "icon": "🔴",
  "reason": "Breaking + competitor proof + high fit"
}
```

---

### Step 6: Learning Adjustments Applied

The `applyLearnedAdjustments()` function applies:

```javascript
// Base score: 100
// Learned adjustments:
// - Topic bonus: energy_oil_gas_lng = +0.7 * 10 = +7 points
// - Signal boost: competitor_breakout works well (ratio 0.85) = +5 points
// - Signal boost: dna_match works well (ratio 0.75) = +5 points

// Adjusted score: 100 + 7 + 5 + 5 = 117 → capped at 100
```

**Final Score: 100** (already at max, but adjustments logged)

```json
{
  "base_score": 100,
  "learned_adjusted_score": 100,
  "learned_adjustments_applied": true,
  "adjustments": [
    "topic: +7.0",
    "signal_boost(competitor_breakout): +5",
    "signal_boost(dna_match): +5"
  ]
}
```

---

### Step 7: Final Signal Object (API Response)

```json
{
  "id": "abc123-def456-ghi789",
  "show_id": "a7982c70-2b0e-46af-a0ad-c78f4f69cd56",
  "title": "الصين تستورد كميات قياسية من النفط الروسي رغم العقوبات",
  "source": "Reuters",
  "source_url": "https://www.reuters.com/world/china/chinas-oil-imports-russia-hit-record-high-amid-sanctions-2024-01-15/",
  "score": 100,
  "final_score": 100,
  "relevance_score": 100,
  "topic_id": "energy_oil_gas_lng",
  "published_at": "2024-01-15T08:30:00Z",
  "status": "new",
  "multi_signal_scoring": {
    "score": 100,
    "base_score": 100,
    "learned_adjusted_score": 100,
    "signals": [
      {
        "type": "competitor_breakout",
        "icon": "🔥",
        "text": "Competitor breakout: Bloomberg got 3.1x their average",
        "weight": "high"
      },
      {
        "type": "competitor_volume",
        "icon": "📊",
        "text": "3 competitors posted about this",
        "weight": "medium"
      },
      {
        "type": "dna_match",
        "icon": "✅",
        "text": "Matches your DNA: energy_oil_gas_lng",
        "weight": "medium"
      },
      {
        "type": "recency",
        "icon": "📰",
        "text": "Trending: 1 source in 48h",
        "weight": "medium"
      },
      {
        "type": "freshness",
        "icon": "⏰",
        "text": "Last covered: 56 days ago",
        "weight": "low"
      }
    ],
    "signalCount": 5,
    "isValid": true
  },
  "urgency_tier": {
    "tier": "today",
    "label": "Post Today",
    "color": "red",
    "icon": "🔴",
    "reason": "Breaking + competitor proof + high fit"
  },
  "learned_adjustments_applied": true,
  "original_learning_score": 7.5
}
```

---

### Step 8: UI Display (IdeaCard Component)

The card renders as:

```jsx
<div className="rounded-xl border border-red-200 bg-red-50 p-5">
  {/* Header */}
  <div className="flex items-start justify-between gap-4 mb-3">
    <div className="flex items-center gap-3 flex-1">
      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500 text-white">
        🔴 Post Today
      </span>
      <h3 className="font-semibold text-gray-900 text-lg">
        الصين تستورد كميات قياسية من النفط الروسي رغم العقوبات
      </h3>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold text-gray-600">100</span>
      <button onClick={handleExpand}>
        <ChevronDown className="w-4 h-4" />
      </button>
    </div>
  </div>

  {/* Source */}
  <div className="flex items-center gap-3 mb-3 text-sm text-gray-500">
    <a href="https://www.reuters.com/..." className="underline">
      Reuters
    </a>
  </div>

  {/* WHY NOW Section (when expanded) */}
  <div className="mb-4 p-3 bg-white/50 rounded-lg border">
    <p className="text-sm font-medium text-gray-700 mb-2">WHY NOW:</p>
    <div className="space-y-1.5">
      <div className="flex items-start gap-2 text-sm text-gray-600">
        <span>🔥</span>
        <span>Competitor breakout: Bloomberg got 3.1x their average</span>
      </div>
      <div className="flex items-start gap-2 text-sm text-gray-600">
        <span>📊</span>
        <span>3 competitors posted about this</span>
      </div>
      <div className="flex items-start gap-2 text-sm text-gray-600">
        <span>✅</span>
        <span>Matches your DNA: energy_oil_gas_lng</span>
      </div>
      <div className="flex items-start gap-2 text-sm text-gray-600">
        <span>📰</span>
        <span>Trending: 1 source in 48h</span>
      </div>
      <div className="flex items-start gap-2 text-sm text-gray-600">
        <span>⏰</span>
        <span>Last covered: 56 days ago</span>
      </div>
    </div>
  </div>

  {/* Actions */}
  <div className="flex items-center justify-between pt-3 border-t">
    <div className="flex items-center gap-2">
      <button className="px-3 py-1.5 bg-purple-600 text-white rounded-lg">
        <Film className="w-4 h-4" />
        Long Form
      </button>
      <button className="px-3 py-1.5 bg-pink-600 text-white rounded-lg">
        <Smartphone className="w-4 h-4" />
        Short Form
      </button>
    </div>
    <div className="flex items-center gap-1">
      <button className="p-2 hover:text-green-600">
        <ThumbsUp className="w-4 h-4" />
      </button>
      <button className="p-2 hover:text-red-600">
        <ThumbsDown className="w-4 h-4" />
      </button>
    </div>
  </div>
</div>
```

---

## Visual Representation

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔴 Post Today                    100                            │
│                                                                  │
│ الصين تستورد كميات قياسية من النفط الروسي رغم العقوبات        │
│                                                                  │
│ Reuters                                                          │
│                                                                  │
│ ▼ WHY NOW:                                                       │
│   🔥 Competitor breakout: Bloomberg got 3.1x their average      │
│   📊 3 competitors posted about this                             │
│   ✅ Matches your DNA: energy_oil_gas_lng                        │
│   📰 Trending: 1 source in 48h                                   │
│   ⏰ Last covered: 56 days ago                                   │
│                                                                  │
│ [Long Form] [Short Form]              [👍] [👎]                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Transformation Summary

| Stage | Score | Key Changes |
|-------|-------|-------------|
| **1. Raw RSS** | N/A | English title, no scoring |
| **2. RSS Processor** | 7.5/10 | Arabic title, topic classified, base score |
| **3. Context Fetch** | 7.5/10 | Competitor videos, user videos, DNA loaded |
| **4. Multi-Signal Scoring** | 100/100 | 5 signals detected, score calculated |
| **5. Urgency Tier** | 100/100 | Assigned "Post Today" tier |
| **6. Learning Adjustments** | 100/100 | Topic bonus +7, signal boosts +10 |
| **7. Final Display** | 100/100 | Red card, 5 signals shown, actions available |

---

## Key Insights from This Example

1. **Competitor Breakout is Strong Signal:** Bloomberg's 3.1x multiplier shows proven market interest
2. **Multiple Competitors = Trending:** 3 competitors posting indicates topic momentum
3. **DNA Match Ensures Relevance:** Topic matches channel focus perfectly
4. **Recency Matters:** 12 hours old = fresh news
5. **Not Saturated:** User hasn't covered this in 56 days = good opportunity
6. **Learning System Adds Value:** +17 points from learned preferences

---

## What Makes This a "Post Today" Idea?

✅ **High Score (100/100):** Perfect combination of signals  
✅ **Competitor Proof:** Bloomberg breakout shows market validation  
✅ **Multiple Signals (5):** Strong evidence from multiple sources  
✅ **Fresh News:** 12 hours old = breaking news  
✅ **DNA Match:** Perfect fit for channel focus  
✅ **Not Saturated:** User hasn't covered recently  

This is exactly the type of opportunity the system is designed to surface: **breaking news with competitor proof and perfect channel fit.**

---

## Next Steps (User Actions)

When user interacts with this card:

1. **Expand "WHY NOW":** Tracks `card_expanded` feedback
2. **Hover 5+ seconds:** Tracks `hovered_5s` feedback
3. **Click Source:** Tracks `clicked_source` feedback
4. **Generate Pitch:** Tracks `generate_pitch` feedback (strong positive signal)
5. **Like/Reject:** Tracks explicit feedback for learning

All feedback is stored and used to improve future recommendations!
