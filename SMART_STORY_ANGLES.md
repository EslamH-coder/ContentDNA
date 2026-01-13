# Smart Story-Based Angle Generation

## The Problem We Solved

**Before:** Every title was "X في خطر" (X in danger) - generic, template-based, repetitive.

**After:** Story-first approach that understands WHO, WHAT, WHERE, WHEN, WHY and generates multiple unique angles per story.

## How It Works

### 1. Story Parsing (`storyParser.js`)
Extracts story elements:
- **Actor**: Who is doing something (Tesla, Musk, Fed)
- **Action**: What they're doing (launch, ban, invest, lose)
- **Affected**: Who is affected (50,000 drivers, workers)
- **Location**: Where (Dubai, Saudi, Egypt)
- **Timeline**: When (2026, next month)
- **Stakes**: Why it matters
- **Surprise**: Unexpected elements (first, record, secret)

### 2. Angle Generation (`angleGenerator.js`)
Generates **multiple angles** based on story elements:
- **Timeline angles**: "2026: السنة اللي هتغير كل حاجة"
- **Conflict angles**: "Tesla vs سواقين الإمارات... مين هيكسب؟"
- **Arrival angles**: "Tesla جاي دبي... ومعاه 50,000 مفاجأة"
- **Personal angles**: "لو أنت سائق... لازم تشوف ده"
- **Regional angles**: "دبي قبل العالم كله... ليه؟"
- **Question angles**: "ليه Tesla وليه دلوقتي؟"
- **Reveal angles**: "اللي Tesla مش بتقوله..."
- **Number angles**: "50,000... الرقم اللي لازم تعرفه"

### 3. Angle Scoring (`angleScorer.js`)
Scores each angle:
- **+15**: Has number
- **+15**: Has Arab region
- **+10**: Has entity (company/person)
- **+10**: Creates curiosity
- **-20**: Generic "في خطر" (PENALTY!)
- **-25**: Generic "القصة الكاملة" (PENALTY!)
- **-15**: Too similar to recent titles (diversity check)

### 4. Smart Pipeline (`smartPipeline.js`)
- Parses story
- Generates multiple angles
- Scores and selects best diverse angles
- Optionally uses LLM to refine top angle
- Returns 3+ angle options per story

## Example Output

### Input RSS Item:
```
"Tesla announces robotaxi launch in Dubai for 2026, 50,000 driver jobs at risk"
```

### Output:
```json
{
  "status": "RECOMMENDED",
  "priority": "HIGH",
  
  "story": {
    "actor": "Tesla",
    "affected": "50,000 driver jobs",
    "location": "Dubai",
    "timeline": "2026",
    "numbers": ["50,000", "2026"]
  },
  
  "angle_options": [
    {
      "type": "arrival",
      "title_ar": "تسلا جاي دبي... ومعاه 50,000 مفاجأة",
      "score": 85
    },
    {
      "type": "timeline",
      "title_ar": "2026: السنة اللي هتغير شوارع دبي للأبد",
      "score": 82
    },
    {
      "type": "conflict",
      "title_ar": "تسلا vs سواقين الإمارات... مين هيكسب؟",
      "score": 78
    }
  ],
  
  "recommended": {
    "title_ar": "تسلا جاي دبي... ومعاه 50,000 مفاجأة",
    "type": "arrival",
    "score": 85
  }
}
```

**Notice:** No "في خطر"! Each angle is unique and story-specific.

## Integration

The RSS processor now automatically uses the smart pipeline. When you click "Update RSS Feeds":

1. Each RSS item is parsed as a story
2. Multiple angles are generated
3. Best angles are selected (with diversity)
4. Signals are saved with story-based titles
5. Angle options are stored in `raw_data.recommendation.angle_options`

## Benefits

✅ **No more generic templates** - Each story gets unique angles
✅ **Multiple options** - 3+ angles per story to choose from
✅ **Diversity** - System avoids repeating similar titles
✅ **Story understanding** - Knows WHO, WHAT, WHERE, WHEN, WHY
✅ **Penalties for generic** - "في خطر" gets -20 points
✅ **Regional focus** - Prioritizes Arab locations and angles

## Files Created

- `lib/recommendation/storyParser.js` - Parse story elements
- `lib/recommendation/angleGenerator.js` - Generate multiple angles
- `lib/recommendation/angleScorer.js` - Score angles (quality + diversity)
- `lib/recommendation/smartPipeline.js` - Main smart pipeline

## Next Steps

1. **Test it**: Run RSS update and see story-based titles
2. **Review angles**: Check `raw_data.recommendation.angle_options` for alternatives
3. **Refine**: Adjust scoring weights if needed
4. **Monitor**: Track which angle types perform best

