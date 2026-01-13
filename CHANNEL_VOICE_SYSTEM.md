# Channel Voice System

## Overview

The Channel Voice System prevents generic AI-generated content and enforces actual channel patterns from المُخبر الاقتصادي+ transcripts.

## Problem Solved

**Before:**
```
❌ "الحقائق المخفية وراء خطة ترامب السرية لـ 2025"
❌ "السر الذي تخفيه Apple"
❌ "كيف سترتفع أسعارك في 2025؟"
```

**After:**
```
✅ "في 27 ديسمبر 2025 الرئيس الأمريكي دونالد ترامب أعلن رسمياً رفع الرسوم الجمركية 60%"
✅ "هل أمريكا تقدر تحارب روسيا أو الصين؟ الإجابة هي نعم..."
✅ "جهاز الآيفون اللي بتنتجه شركة أبل... الشركة اللي قيمتها 3.4 تريليون دولار"
```

## Files Created

1. **`lib/voice/bannedPhrases.js`** - List of banned generic AI phrases
2. **`lib/voice/channelPatterns.js`** - Actual channel hook patterns from transcripts
3. **`lib/voice/voiceValidator.js`** - Validation logic
4. **`lib/voice/contentGenerator.js`** - Content generation using patterns

## Integration Points

### 1. Angle Generation (`smartPipeline.js`)

- **Step 5.5**: Filters out angles with banned phrases before scoring
- Only angles that pass voice validation (score ≥ 60) proceed to scoring
- Rejects items if ALL angles fail voice validation

### 2. Angle Scoring (`angleScorer.js`)

- **Voice Validation Bonus**: +20 points for passing validation
- **Banned Phrase Penalty**: -50 points for critical issues
- **Warning Penalty**: Up to -20 points for validation warnings

### 3. Final Title Validation (`smartPipeline.js`)

- Validates final title (including LLM-refined versions)
- Rejects if critical banned phrases detected
- Adds `voice_validation` object to recommendation output

## Validation Checks

1. **Banned Phrases** (CRITICAL) - Instant rejection
   - "الحقائق المخفية", "السر الذي", "كيف سترتفع أسعارك", etc.

2. **Needs Number** - Phrases that require specific numbers
   - "في خطر" → Must have: "500 مليار دولار في خطر"

3. **Full Date** - Prefers specific dates
   - "في 27 ديسمبر 2025" (not just "2025")

4. **Entity with Title** - Prefers entities with titles
   - "الرئيس ترامب" (not just "ترامب")

5. **Credibility Marker** - Prefers credibility markers
   - "تحديداً", "بحسب رويترز", "رسمياً"

6. **Not Generic Statement** - Prefers questions/hooks
   - "كيف", "لماذا", "هل", or "في [date]"

## Usage

### Validate Content

```javascript
import { validateVoice } from './lib/voice/voiceValidator.js';

const validation = validateVoice("الحقائق المخفية وراء خطة ترامب");
// {
//   valid: false,
//   score: 30,
//   status: 'REJECTED',
//   issues: [{ type: 'BANNED_PHRASE', severity: 'CRITICAL', ... }]
// }
```

### Generate Channel-Voice Content

```javascript
import { generateHook, generateTitle } from './lib/voice/contentGenerator.js';

const hook = generateHook(newsItem, {
  full_date: 'في 27 ديسمبر 2025',
  entity_with_title: 'الرئيس الأمريكي دونالد ترامب',
  action: 'أعلن رفع الرسوم الجمركية على الصين 60%',
  credibility_detail: 'بحسب بيان البيت الأبيض الرسمي'
});
```

## Recommendation Output

Each recommendation now includes:

```javascript
{
  // ... existing fields ...
  voice_validation: {
    score: 95,           // 0-100
    status: 'APPROVED',  // APPROVED | NEEDS_WORK | REJECTED
    valid: true,         // true if no critical issues
    issues: [],          // Critical/high severity issues
    warnings: [],        // Suggestions for improvement
    fixes: []            // Suggested fixes if not valid
  }
}
```

## LLM Prompt Updates

The LLM refinement prompt now includes voice validation rules:

```
❌ ممنوع: "في خطر", "القصة الكاملة", "الحقائق المخفية", "السر الذي", "كيف سترتفع أسعارك"
✅ استخدم: تواريخ محددة (في 27 ديسمبر 2025), أرقام (60%, 3.4 تريليون), ألقاب (الرئيس ترامب)
✅ استخدم: "لماذا", "كيف", "هل" للأسئلة المباشرة
```

## Testing

Run RSS update and check:
1. Server logs should show voice validation results
2. Recommendations should have `voice_validation` object
3. No banned phrases in final titles
4. Titles should follow channel patterns (date + entity, question + answer, etc.)

## Next Steps

- Monitor voice validation scores in production
- Add more channel patterns as they're identified
- Expand banned phrases list based on generic AI detection
- Add voice validation to brief generation

