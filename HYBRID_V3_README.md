# Hybrid Intelligence System V3
## Groq for Filtering + Claude for Pitching + Persona Tracking

---

## 🎯 What's New in V3

| Component | V2 | V3 |
|-----------|----|----|
| Filtering | Groq (okay) | **Groq + Better Prompts** |
| Pitching | Groq (bad) | **Claude Sonnet (excellent)** |
| Personas | Broken (always 0%) | **Fixed tracking system** |
| Arabic Quality | Poor | **Native-level understanding** |
| Cost | ~$0.50/month | **~$3-5/month** |

---

## 📁 Files Created

### AI Clients
1. **`lib/ai/clients.js`** - Groq + Claude API clients
2. **`lib/ai/groqFilter.js`** - Stage 1: Fast filtering with Groq
3. **`lib/ai/claudePitcher.js`** - Stage 2: High-quality pitching with Claude

### Persona Tracking
4. **`lib/personas/personaTracker.js`** - Tracks which personas are served
5. **`app/api/personas/status/route.js`** - Get persona status API
6. **`app/api/signals/approve/route.js`** - Approve signal + track persona

### Engine
7. **`lib/intelligence/dataScorer.js`** - Data-based scoring
8. **`lib/intelligence/engineV3.js`** - Main V3 hybrid engine

---

## 🚀 Setup

### 1. Environment Variables

Add to `.env.local`:
```bash
GROQ_API_KEY=your_groq_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
```

### 2. API Keys

- **Groq**: https://console.groq.com (Free tier available)
- **Anthropic**: https://console.anthropic.com (Paid)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    HYBRID INTELLIGENCE V3                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  STAGE 1: FILTERING (Groq - Fast & Cheap)                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ • Filter irrelevant news                            │   │
│  │ • Basic topic classification                        │   │
│  │ • Initial persona matching                          │   │
│  │ • Cost: ~$0.01 per 100 items                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                  │
│                   Top 20 candidates                         │
│                          ↓                                  │
│  STAGE 2: DEEP ANALYSIS (Claude - Smart & Quality)          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ • Deep topic understanding                          │   │
│  │ • Creative pitch generation                         │   │
│  │ • Culturally-aware Arabic content                   │   │
│  │ • Cost: ~$0.02 per item                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                  │
│  STAGE 3: PERSONA TRACKING (Database)                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ • Track which personas are served                   │   │
│  │ • Update on approval                                │   │
│  │ • Weekly balance reporting                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 💰 Cost Estimate

```
Daily usage (assuming 50 news items):

STAGE 1 - Groq Filtering:
├── 50 items × 300 tokens = 15K tokens
├── Cost: 15K × $0.05/1M = $0.00075/day

STAGE 2 - Claude Pitching (top 10):
├── 10 items × 1500 tokens = 15K tokens
├── Cost: 15K × $3/1M = $0.045/day

Daily total: ~$0.05/day
Monthly total: ~$1.50/month

With manual trends + more usage: ~$3-5/month
```

---

## 📊 Persona Tracking

### How It Works

1. **Weekly Targets**: Each persona has a target number of videos per week
2. **Tracking**: When you approve a signal, it records which persona it serves
3. **Status**: Check `/api/personas/status` to see current week's progress
4. **Alerts**: System alerts you if a persona is underserved

### Persona Targets (per week)

- 🌍 المحلل الجيوسياسي: 3 videos
- 📊 المستثمر الفردي: 2 videos
- 💻 متابع التقنية: 1 video
- 🇪🇬 رجل الأعمال المصري: 2 videos
- 🛢️ متابع النفط الخليجي: 2 videos
- 🎓 المتعلم الفضولي: 1 video
- 👔 الموظف - الاقتصاد الشخصي: 2 videos
- 🚀 الطالب - ريادة الأعمال: 1 video

**Total: 14 videos/week**

---

## 🔧 API Usage

### Generate Recommendations (V3)
```javascript
GET /api/intel/recommendations?rssItems=[...]
```

### Get Persona Status
```javascript
GET /api/personas/status
```

Response:
```json
{
  "success": true,
  "weekStart": "2025-01-06",
  "personas": {
    "geopolitics": {
      "target": 3,
      "served": 1,
      "percentage": 33,
      "remaining": 2,
      "approved": [...]
    },
    ...
  },
  "underserved": [...],
  "alerts": [...]
}
```

### Approve Signal
```javascript
POST /api/signals/approve
{
  "signalId": "signal_123",
  "personaId": "geopolitics",
  "topicTitle": "الصين وأمريكا"
}
```

This will:
1. Update signal status in database
2. Record approval in persona tracking
3. Update persona serving count

---

## 🎨 Frontend Integration

### Approve Button

When user clicks "Approve" on a signal:

```javascript
async function approveSignal(signalId, personaId, title) {
  const res = await fetch('/api/signals/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signalId,
      personaId,
      topicTitle: title
    })
  });
  
  const data = await res.json();
  if (data.success) {
    // Refresh persona status
    // Show success message
  }
}
```

### Persona Status Component

Create a component to show persona serving status:

```jsx
import { useEffect, useState } from 'react';

export default function PersonaStatus() {
  const [status, setStatus] = useState(null);
  
  useEffect(() => {
    fetch('/api/personas/status')
      .then(r => r.json())
      .then(data => setStatus(data));
  }, []);
  
  // Render persona cards with progress bars
}
```

---

## ✅ Summary of Fixes

| Problem | Solution |
|---------|----------|
| Bad pitches | **Claude instead of Groq** |
| Personas always 0% | **Tracking system + approval API** |
| Poor Arabic | **Custom system prompt** |
| Generic angles | **Context-aware prompts** |
| No suggestions | **Underserved persona detection** |

---

## 🧪 Testing

1. **Test Filtering**:
   ```javascript
   import { filterNewsBatch } from '@/lib/ai/groqFilter';
   const filtered = await filterNewsBatch(newsItems);
   ```

2. **Test Pitching**:
   ```javascript
   import { generatePitch } from '@/lib/ai/claudePitcher';
   const pitch = await generatePitch('الاقتصاد الإسلامي', {
     persona: 'employee'
   });
   ```

3. **Test Tracking**:
   ```javascript
   import { recordApproval } from '@/lib/personas/personaTracker';
   await recordApproval('signal_123', 'geopolitics', 'الصين وأمريكا');
   ```

---

## 📝 Next Steps

1. ✅ Add API keys to `.env.local`
2. ✅ Update signals page to call `/api/signals/approve` on approval
3. ✅ Add persona status component to dashboard
4. ✅ Test with real RSS items
5. ✅ Monitor costs

---

**Cost**: ~$3-5/month for full hybrid intelligence! 🎉




