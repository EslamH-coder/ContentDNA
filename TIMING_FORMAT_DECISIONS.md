# Timing & Format Decisions

## Problem Solved

**Before:** All content treated the same - no guidance on when to produce or what format

**After:** Smart decisions based on DNA:
- **TIMING**: When to produce (URGENT, TIMELY, EVERGREEN)
- **FORMAT**: What format (LONG, SHORT, BOTH, SKIP)

## How It Works

### Timing Decisions

**URGENT** 🔴 (This week):
- Breaking news keywords: "breaking", "just announced", "today"
- Recent conflict/threat stories (< 72 hours old)
- Time-sensitive events

**TIMELY** 🟡 (1-2 weeks):
- Developing trends: "rising", "growing", "this quarter"
- Seasonal events: Ramadan, earnings, OPEC meetings
- Shift/Race/Opportunity story types

**EVERGREEN** 🟢 (Backlog):
- Educational content: "how does", "what is", "explained"
- No time pressure
- Always relevant content

### Format Decisions

**LONG** 📺 (25-30 min):
- Complex topics (geopolitics, defense)
- Winning topics (50%+ success rate)
- Conflict/Shift/Consequence stories

**SHORT** 📱 (30-45 sec):
- Neutral/new topics (test first)
- Single facts/milestones
- Losing topics (if must cover)

**BOTH** 🔄 (Long + 2-3 Shorts):
- Winning topic + viral elements + urgent
- Maximum investment opportunity

**SKIP** ⚠️:
- Losing topics (< 30% success)
- Not worth the effort

## Decision Matrix

| Topic Status | Timing | Format | Action |
|--------------|--------|--------|--------|
| WINNING | URGENT | 🔄 BOTH | Produce ASAP |
| WINNING | TIMELY | 📺 LONG | Next 1-2 weeks |
| WINNING | EVERGREEN | 📺 LONG | Backlog |
| NEUTRAL | URGENT | 📱 SHORT | Quick short this week |
| NEUTRAL | TIMELY | 📱 SHORT | Test next week |
| NEW | Any | 📱 SHORT | Test first |
| LOSING | URGENT | ⛔ SKIP | Don't waste effort |
| COMPLEX | Any | 📺 LONG | Always needs depth |

## Where to See Decisions

### 1. Signals Page (`/signals`)
Each signal now shows:
- 🔴 **This week** / 🟡 **1-2 weeks** / 🟢 **Backlog** (timing)
- 📺 **25-30 min** / 📱 **30-45 sec** / 🔄 **BOTH** (format)
- **HIGHEST** / **HIGH** / **MEDIUM** (priority)

### 2. Signal Details
Click on a signal to see full decision breakdown:
- Timing reason
- Format reason
- Action recommendation
- Short ideas (if BOTH format)

### 3. Console Logs
When processing RSS, you'll see:
```
✅ Recommended: "Microsoft UAE Investment..."
   Timing: 🔴 URGENT (This week)
   Format: 🔄 BOTH (Long + 3 Shorts)
   Priority: HIGHEST
```

## Files Created

- `lib/decisions/timingDecision.js` - When to produce
- `lib/decisions/formatDecision.js` - What format
- `lib/decisions/decisionEngine.js` - Combined engine + sorting

## Integration

Decisions are automatically added to:
- Strict quality gates pipeline
- Smart recommendation pipeline
- Signal `raw_data.recommendation.timing_format`

## Example Output

```json
{
  "timing": {
    "decision": "URGENT",
    "deadline": "This week",
    "icon": "🔴",
    "reason": "Breaking news - time sensitive"
  },
  "format": {
    "decision": "BOTH",
    "duration": "Long: 25-30 min + 2-3 Shorts",
    "icon": "🔄",
    "shorts_ideas": [
      "15 مليار في 60 ثانية",
      "الوظائف الجديدة في الإمارات"
    ]
  },
  "action": {
    "priority": "HIGHEST",
    "recommendation": "Produce ASAP - long-form + shorts",
    "order": 0
  }
}
```

## Benefits

✅ **Smart prioritization** - Know what to produce first
✅ **Format guidance** - Don't waste time on wrong format
✅ **DNA-based** - Uses your actual performance data
✅ **Time-aware** - Respects urgency vs evergreen
✅ **Investment-level** - Know when to go all-in vs test

