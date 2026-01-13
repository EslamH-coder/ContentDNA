# Auto-Fix & Quality Score System

## Overview

Instead of rejecting bad LLM output, the system now:
1. **Auto-fixes** common issues (removes banned phrases, adds missing elements)
2. **Scores quality** (0-100) and shows it to the user
3. **Falls back to templates** if auto-fix can't save it
4. **Always shows results** (never 0 results)

## How It Works

### Before (Old Approach):
```
LLM Output → Validation → ❌ REJECT → 0 Results
```

### After (New Approach):
```
LLM Output → Auto-Fix → Quality Score → ✅ Always Show (with warnings)
                ↓
        If unfixable → Template Fallback → ✅ Still Show
```

## Files Created

1. **`lib/quality/autoFixer.js`** - Auto-fixes common issues
   - Removes banned phrases ("هل تعلم", "ما لا تعرفه")
   - Replaces personal references ("في بلدك" → "في المنطقة العربية")
   - Adds missing elements (source, date)

2. **`lib/quality/qualityScorer.js`** - Scores content quality
   - Positive criteria: date, number, source, entity title, Arab region
   - Negative criteria: banned phrases, fake personalization, English words
   - Returns score (0-100), grade (A-F), warnings

3. **`lib/quality/templateFallback.js`** - Template fallback
   - Generates titles/hooks from templates if auto-fix fails
   - Uses proven Channel DNA patterns

4. **`lib/quality/contentProcessor.js`** - Main processor
   - Orchestrates: Auto-fix → Score → Fallback
   - Always returns content (never null)

## Integration

### Updated Files:
- **`lib/llm/dnaInformedLLM.js`** - Now uses `processContent` instead of rejecting
- **`lib/pipeline/dnaInformedPipeline.js`** - Passes quality info through
- **`lib/recommendation/smartPipeline.js`** - Includes quality in output
- **`app/api/rss-processor/route.js`** - Stores quality info in signals
- **`app/signals/page.js`** - Displays quality badges and warnings

## Quality Scoring

### Positive Points (+):
- **Date specified**: +15 points
- **Number specified**: +15 points
- **Source cited**: +10 points
- **Entity with title**: +10 points
- **Arab region link**: +10 points
- **Question format**: +10 points
- **Good length**: +5 points

### Negative Points (-):
- **Banned phrase**: -20 points ⚠️
- **Fake personalization**: -15 points ⚠️
- **English words**: -10 points ⚠️
- **Too short**: -10 points ⚠️
- **No specifics**: -10 points ⚠️

### Grades:
- **A** (80-100): Excellent - Green badge
- **B** (65-79): Good - Yellow badge
- **C** (50-64): OK - Yellow badge
- **D** (35-49): Needs Work - Red badge
- **F** (0-34): Poor - Red badge

## Auto-Fix Examples

### Example 1: Remove "هل تعلم"
```
Input:  "هل تعلم أن ترامب يرفع الرسوم 60%؟"
Fixed:  "ترامب يرفع الرسوم 60%؟"
Fixes:  ["Removed 'هل تعلم أن'"]
Score:  55 → 70 (after fix)
```

### Example 2: Replace "في بلدك"
```
Input:  "في بلدك سترتفع الأسعار"
Fixed:  "في المنطقة العربية سترتفع الأسعار"
Fixes:  ["Replaced 'في بلدك' with specific region"]
Score:  45 → 60 (after fix)
```

### Example 3: Add Source
```
Input:  "ترامب يعلن رفع الرسوم"
Fixed:  "ترامب يعلن رفع الرسوم. بحسب Al Jazeera"
Fixes:  ["Added source: Al Jazeera"]
Score:  50 → 60 (after fix)
```

## UI Display

### Quality Badge:
```jsx
<div className="quality-badge quality-green">
  Quality: 75 (B)
</div>
```

### Warnings:
```jsx
<div className="warnings">
  <span className="warning-tag">⚠️ بدون تاريخ محدد</span>
  <span className="warning-tag">⚠️ يحتوي عبارة عامة</span>
</div>
```

## Benefits

| Before | After |
|--------|-------|
| "هل تعلم" → REJECT → 0 results | "هل تعلم" → AUTO-REMOVE → Show result |
| Bad content → Block | Bad content → Fix + Warning |
| No feedback | Quality score visible |
| All or nothing | Gradual improvement |
| User sees nothing | User sees everything with quality indicators |

## Result

**User always sees results**, but knows:
- Quality score (0-100)
- Grade (A-F)
- Warnings (if any)
- What was auto-fixed
- If fallback was used

This ensures the system is **helpful, not blocking**.




