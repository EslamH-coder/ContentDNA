# Template-Based Title/Hook System

## Overview

Replaced LLM-based title/hook generation with a template-based system that uses Channel DNA patterns.

## Problem Solved

**Before (LLM generates everything):**
```
❌ "Trump جاي US... ومعاه 2025"
❌ "ما لا تخبرك به Apple"
❌ "هل تعلم أن رسوم ترامب ستزيد فاتورة التسوق"
```

**After (LLM extracts → Templates fill):**
```
✅ "لماذا الرئيس الأمريكي دونالد ترامب يرفع الرسوم الجمركية على الصين؟"
✅ "في 28 ديسمبر 2025 الرئيس الأمريكي دونالد ترامب يرفع الرسوم الجمركية على الصين 60%. بحسب AP News..."
```

## Architecture

```
News Article 
  ↓
[LLM: Extract Data Only]
  ↓
{date, entity, action, number, topic}
  ↓
[Code: Fill Channel DNA Templates]
  ↓
Title/Hook (Guaranteed Channel Voice)
```

## Files Created

1. **`lib/templates/channelTemplates.js`** - Channel DNA templates from actual successful videos
2. **`lib/extraction/dataExtractor.js`** - LLM extraction prompt (data only, no creativity)
3. **`lib/generation/templateFiller.js`** - Template filling logic (no LLM)
4. **`lib/pipeline/templatePipeline.js`** - Main pipeline orchestrating extraction → generation

## Integration

### Updated `smartPipeline.js`

- Replaced LLM title/hook generation with template-based system
- LLM now only extracts structured data
- Templates fill using Channel DNA patterns
- Falls back to angle-based titles if template generation fails

## Template Selection Logic

### Title Templates (Priority Order)

1. **WHY_ENTITY** (2.85M views) - If has entity + action
2. **ENTITY_NUMBER** (1.81M views) - If has entity + number
3. **HOW_ENTITY** (2.69M views) - If has entity
4. **DOUBLE_QUESTION** (2.59M views) - If can be yes/no question

### Hook Templates (Priority Order)

1. **DATE_ENTITY_ACTION** (2.85M views, 76% retention) - If has date + entity
2. **QUESTION_ANSWER** (2.59M views, 75% retention) - If can be yes/no
3. **NUMBER_IMPACT** (1.5M views, 73% retention) - If has number
4. **NEWS_SOURCE** (1.81M views, 72% retention) - If has source

## Benefits

1. **No Generic AI Patterns**: Templates don't contain banned phrases
2. **Consistent Quality**: All output follows proven Channel DNA patterns
3. **Predictable Performance**: Templates based on actual view/retention data
4. **Lower LLM Costs**: LLM only extracts data (smaller prompts, lower temperature)
5. **Faster**: Template filling is instant (no LLM wait time)

## Example Flow

### Input:
```
Title: "Trump overturned decades of US trade policy in 2025. See the impact of his tariffs"
Date: Dec 28, 2025
```

### Step 1: LLM Extracts (Only This!)
```json
{
  "date": { "day": 28, "month": 12, "year": 2025 },
  "entities": [
    { "name": "Trump", "type": "person", "role": "raised tariffs on China" }
  ],
  "numbers": [
    { "value": "60", "unit": "%", "context": "tariff rate" }
  ],
  "action": { "verb": "يرفع", "full": "يرفع الرسوم الجمركية على الصين" },
  "topic_category": "tariffs"
}
```

### Step 2: Code Fills Templates

**Title:** `WHY_ENTITY` template
```
"لماذا {entity} {action}؟"
→ "لماذا الرئيس الأمريكي دونالد ترامب يرفع الرسوم الجمركية على الصين؟"
```

**Hook:** `DATE_ENTITY_ACTION` template
```
"في {date} {entity_with_title} {action}. {detail}"
→ "في 28 ديسمبر 2025 الرئيس الأمريكي دونالد ترامب يرفع الرسوم الجمركية على الصين 60%. بحسب التقارير..."
```

## Testing

The system will automatically:
1. Extract data from RSS items
2. Select best template based on available data
3. Fill template with extracted data
4. Validate output (voice validation)
5. Fall back to angle-based titles if template generation fails

## Next Steps

- Monitor template usage in production
- Add more templates as new successful patterns emerge
- Fine-tune template selection logic based on performance
- Consider A/B testing template vs angle-based titles




