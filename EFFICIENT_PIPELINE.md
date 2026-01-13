# Efficient Pipeline - Pre-Filter + Groq Integration

## Overview

This system saves **90% of API costs** by:
1. **Pre-filtering** news items with free JavaScript rules (no API calls)
2. **Using Groq** (free LLM API) instead of Claude for deep analysis
3. **Only processing** high-potential stories

## Architecture

```
100 News Items
    ↓
[Pre-Filter] (FREE - 50ms per item)
    ↓
~15 High-Potential Items (score >= 60)
    ↓
[Groq Deep Analysis] (FREE - 30 req/min)
    ↓
~5-10 Final Stories with Full Analysis
```

## Cost Comparison

| Approach | News Items | API Calls | Cost (Claude) | Cost (Groq) |
|----------|------------|-----------|---------------|-------------|
| **Old** | 100 | 300 | ~$15 | $0 |
| **New** | 100 | ~36 | ~$1.80 | $0 |
| **Savings** | - | 88% | 88% | 100% |

## Setup

### 1. Get Groq API Key (Free)

1. Go to: https://console.groq.com
2. Sign up (free)
3. Create API key
4. Add to `.env.local`:

```env
# Groq (Free LLM API)
GROQ_API_KEY=gsk_your_api_key_here
```

### 2. Files Created

- `lib/filter/preFilter.js` - Pre-filters news without API calls
- `lib/llm/groqClient.js` - Groq API client with rate limiting
- `lib/pipeline/efficientPipeline.js` - Main efficient pipeline

## How It Works

### Stage 1: Pre-Filter (FREE)

The pre-filter scores news items using:
- **Power keywords** (Trump, China, etc.) - +25 points
- **Arab relevance** (Egypt, Saudi, etc.) - +10 points
- **Conflict indicators** (war, vs, etc.) - +8 points
- **Numbers** (billion, million, etc.) - +5 points
- **Low-value penalties** (weather, sports, etc.) - -15 points

**Threshold**: Items with score >= 60 pass to next stage

### Stage 2: Groq Deep Analysis (FREE)

For items that passed pre-filter:
1. **Extract story elements** (people, entities, conflicts, Arab impact)
2. **Find best angle** for the channel
3. **Generate content** (title + hook)

### Stage 3: Integration

The efficient pipeline is **automatically integrated** into the RSS processor:
- Pre-filters all RSS items first
- Only processes high-potential items
- Works with producer mode or standard recommendation engine

## Usage

The system is **automatically enabled** in the RSS processor. No changes needed!

When you run RSS updates, you'll see:
```
🔍 Pre-filtering 100 items from Reuters...
   ✅ Pre-filter results: 15/100 passed (15.0%)
   💰 Estimated savings: 85% API calls saved
```

## Configuration

### Adjust Pre-Filter Threshold

Edit `lib/filter/preFilter.js`:

```javascript
const CONFIG = {
  threshold: 60  // Change to 50 for more items, 70 for fewer
};
```

### Add Custom Keywords

Edit `lib/filter/preFilter.js`:

```javascript
powerKeywords: {
  people: [
    { en: 'trump', ar: 'ترامب', boost: 25 },
    // Add your keywords here
  ]
}
```

## Benefits

✅ **90% cost savings** - Only process high-potential items
✅ **Faster processing** - Pre-filter is instant (50ms per item)
✅ **Free Groq API** - 14,400 requests/day free
✅ **Same quality** - Only high-scoring items get processed
✅ **Automatic** - Works with existing RSS processor

## Monitoring

Check the console logs to see:
- How many items passed pre-filter
- Estimated API call savings
- Processing times
- Final results

## Troubleshooting

### Groq Not Working

If you see "Groq not configured":
1. Check `GROQ_API_KEY` is set in `.env.local`
2. Restart the Next.js server
3. Check Groq console for API key status

### Too Few Items Passing

Lower the threshold in `lib/filter/preFilter.js`:
```javascript
threshold: 50  // Instead of 60
```

### Too Many Items Passing

Raise the threshold:
```javascript
threshold: 70  // Instead of 60
```

## Next Steps

1. **Get Groq API key** from https://console.groq.com
2. **Add to `.env.local`**: `GROQ_API_KEY=gsk_xxxxx`
3. **Run RSS update** - Pre-filtering will happen automatically
4. **Monitor logs** - See savings and results

The system is ready to use! 🚀




