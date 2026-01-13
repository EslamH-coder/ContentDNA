# DNA-Informed LLM System

## Problem Solved

**Root Cause:** LLM was generating titles/hooks without Channel DNA context, leading to generic AI patterns.

**Solution:** Pass full Channel DNA + few-shot examples directly into LLM prompt.

## Why Robotaxi Angle Worked

When generating the Robotaxi angle, the system had:
- ✅ Full Channel DNA in context
- ✅ Actual transcript examples from 2.85M view videos
- ✅ Patterns from successful videos
- ✅ Explicit list of what NOT to do

**The LLM needs the same context to produce the same quality.**

## Implementation

### Files Created

1. **`lib/prompts/dnaPrompt.js`** - DNA-informed system prompt
   - Includes examples from 2.85M, 2.69M, 2.59M view videos
   - Lists successful patterns (WHY_ENTITY, DATE_ENTITY_ACTION, etc.)
   - Explicit banned phrases list
   - Required elements (date, number, source, Arab relevance)

2. **`lib/llm/dnaInformedLLM.js`** - DNA-informed LLM wrapper
   - Calls LLM with DNA context
   - Validates output against banned phrases
   - Falls back to templates if LLM output is rejected
   - Parses LLM response (handles different formats)

3. **`lib/extraction/simpleExtractor.js`** - Simple data extraction
   - Extracts entity, action, number, date, category
   - Uses LLM for extraction (low temperature)
   - Falls back to manual pattern matching if LLM fails

4. **`lib/pipeline/dnaInformedPipeline.js`** - Main pipeline
   - Orchestrates extraction → DNA-informed generation
   - Returns title, hook, and metadata

### Integration

Updated `smartPipeline.js`:
- Replaced template-based generation with DNA-informed generation
- LLM now has full Channel DNA context
- Validates output and falls back to templates if needed
- Logs when fallback is used

## How It Works

### Step 1: Extract Data
```javascript
{
  entity: "أبل",
  entity_title: "شركة أبل الأمريكية",
  action: "يدفع غرامة",
  number: "115 مليون دولار",
  category: "tech",
  source: "Reuters"
}
```

### Step 2: LLM Generates with DNA Context

**LLM now sees:**
- ✅ Examples from 2.85M view videos
- ✅ Successful hook patterns
- ✅ Banned phrases list
- ✅ Required elements
- ✅ Channel voice guidelines

**LLM outputs:**
```
عنوان: لماذا شركة أبل الأمريكية تدفع غرامة 115 مليون دولار لإيطاليا؟
هوك: 115 مليون دولار... هذا الرقم هو الغرامة التي فرضتها إيطاليا على شركة أبل. بحسب رويترز...
```

### Step 3: Validation
- Checks for banned phrases
- Validates required elements (number, source, etc.)
- Rejects if contains English in title
- Falls back to template if validation fails

## Example: Before vs After

### Input:
```
News: "Italy regulator fines Apple $115 mln for alleged anti-trust violations"
Source: Reuters
```

### OLD Output (Without DNA):
```
❌ عنوان: "ما لا تخبرك به Apple عن خسارة 115 مليون"
❌ هوك: "هل تعلم أن غرامة أبل الجديدة قد تغير طريقة عمل آب ستور؟"
```

### NEW Output (With DNA):
```
✅ عنوان: "لماذا شركة أبل الأمريكية تدفع غرامة 115 مليون دولار لإيطاليا؟"
✅ هوك: "115 مليون دولار... هذا الرقم هو الغرامة التي فرضتها إيطاليا على شركة أبل. بحسب رويترز..."
```

## Key Features

1. **Full DNA Context**: LLM sees exact examples from successful videos
2. **Banned Phrases Check**: Output validated against banned list
3. **Automatic Fallback**: Uses templates if LLM output is rejected
4. **Validation**: Ensures required elements (number, source, date) are present
5. **Error Handling**: Gracefully handles LLM failures

## Benefits

| Before | After |
|--------|-------|
| LLM has no context | LLM has full Channel DNA |
| LLM guesses patterns | LLM sees exact examples |
| No banned list | Explicit banned list |
| No validation | Output validated |
| Bad output shown | Bad output → fallback template |

## Testing

When you run RSS update, you should see:
1. **DNA-informed generation** logs showing successful generation
2. **Fallback warnings** if LLM output is rejected
3. **Better titles** that follow Channel DNA patterns
4. **No banned phrases** in output (validated and rejected if found)

## Next Steps

- Monitor DNA generation success rate
- Adjust temperature if needed (currently 0.3)
- Add more examples to DNA prompt as new successful videos emerge
- Fine-tune validation rules based on production results




