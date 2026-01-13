# Behavior Patterns Integration - Complete ✅

## What Was Implemented

A comprehensive **Audience Behavior Patterns** system that analyzes ANY topic against 6 proven behavior patterns, making content work regardless of the specific topic.

## The Shift

**OLD:** "Trump = 1.29M views" → Only cover Trump  
**NEW:** "Trump works because of POWER + CONFLICT + PERSON patterns" → Apply to any topic

## Files Created

### 1. `/lib/behavior/behaviorAnalyzer.js`
- Analyzes content against 6 behavior patterns
- Scores each pattern (0-10)
- Calculates total score (0-100)
- Provides specific suggestions for improvement

### 2. `/lib/behavior/behaviorReframer.js`
- Takes low-scoring content and suggests improvements
- Generates alternative titles using proven patterns
- Identifies priority fixes (biggest opportunity)

### 3. `/lib/behavior/behaviorScoreDisplay.js`
- Formats analysis data for UI display
- Creates pattern grid with icons and scores
- Collects suggestions for display

### 4. `/app/api/analyze-behavior/route.js`
- API endpoint for analyzing news items
- Returns full analysis, reframe suggestions, and display data

## The 6 Behavior Patterns

### 1. **CERTAINTY FROM UNCERTAINTY** (Weight: 20)
- Audience wants YES/NO answer to unclear question
- Best: `هل` questions (10 points)
- Good: `كيف`/`لماذا` questions (8 points)
- **Why it works:** "هل" promises a clear answer

### 2. **POWER DYNAMICS** (Weight: 18)
- Someone powerful making decisions
- People > Institutions (Trump = 10, America = 8)
- Needs power action words (يقرر, يعلن, يهدد)
- **Why it works:** Audience wants to know who controls what

### 3. **CONFLICT** (Weight: 18)
- Two sides fighting - who will win?
- Best: Conflict word + Two entities (10 points)
- Good: Two entities (7 points)
- **Why it works:** Drama and stakes

### 4. **ARAB STAKES** (Weight: 20)
- Clear impact on Arab audience
- Direct mentions (مصر, السعودية) = 3 points each
- Indirect (النفط, الدولار) = 1.5 points each
- **Why it works:** 37% of audience is Egypt/Saudi

### 5. **MOBILE FIRST** (Weight: 12)
- Hook in first 5 words, clear on small screen
- Bonus for question start, number, power entity
- Penalty for long titles (>70 chars)
- **Why it works:** 69% watch on mobile

### 6. **PERSONALITY OVER POLICY** (Weight: 12)
- Person name instead of institution
- Person = 10 points, Institution only = 3 points
- **Why it works:** People care about people, not abstract entities

## Integration Points

### 1. Smart Pipeline (`smartPipeline.js`)
- Behavior analysis runs **first** (Step 0)
- If patterns_matched < 3, content is flagged for reframing
- Behavior analysis included in recommendation output

### 2. API Endpoint (`/api/analyze-behavior`)
- Standalone endpoint for testing
- Can be called from UI to preview analysis
- Returns full analysis + reframe suggestions

## Example Output

### Input:
```javascript
{
  title: "Federal Reserve holds interest rates steady",
  description: "The Federal Reserve decided to maintain current interest rates"
}
```

### Analysis:
```javascript
{
  total_score: 35,
  patterns_matched: 1,
  status: "WEAK",
  
  patterns: {
    certainty: { score: 0, suggestion: 'Reframe as "هل [bold claim]؟"' },
    power: { score: 8, power_entity: { name: 'الفيدرالي الأمريكي' } },
    conflict: { score: 0, suggestion: 'Frame as [A] vs [B]' },
    arab_stakes: { score: 0, suggestion: 'Add: "ماذا يعني للجنيه المصري؟"' },
    mobile_first: { score: 5, suggestion: 'Start with hook word' },
    personality: { score: 0, suggestion: 'Replace with "جيروم باول"' }
  },
  
  reframe_suggestions: {
    alternative_titles: [
      "هل سيخفض جيروم باول الفائدة قريباً؟",
      "لماذا يرفض الفيدرالي خفض الفائدة؟ وكيف يؤثر على الخليج؟"
    ]
  }
}
```

## How to Use

### 1. In RSS Processor
Behavior analysis is automatically included in all recommendations:
```javascript
const result = await smartRecommend(rssItem, showDna, { llmClient });
// result.behavior_analysis contains full analysis
```

### 2. Standalone Analysis
```javascript
import { analyzeBehaviorPatterns } from '@/lib/behavior/behaviorAnalyzer.js';

const analysis = analyzeBehaviorPatterns(newsItem);
if (analysis.patterns_matched < 3) {
  // Needs reframing
  const reframe = reframeContent(newsItem, analysis);
  // Use reframe.alternative_titles
}
```

### 3. API Call
```javascript
POST /api/analyze-behavior
Body: { newsItem: { title: "...", description: "..." } }
```

## Benefits

1. **Topic-Agnostic:** Works for ANY topic, not just Trump/China
2. **Data-Driven:** Based on actual audience behavior (72 videos analyzed)
3. **Actionable:** Provides specific suggestions, not just scores
4. **Reframing:** Generates alternative titles using proven patterns
5. **Early Detection:** Flags weak content before production

## Next Steps

1. **UI Integration:** Add behavior score display to signals page
2. **Reframe Button:** Allow users to see alternative titles
3. **Pattern Tracking:** Track which patterns correlate with views
4. **Auto-Reframe:** Automatically use best alternative title if score < 50

## Testing

Test with various topics:
```javascript
// Test 1: Strong topic (Trump)
analyzeBehaviorPatterns({ title: "هل سيفوز ترمب في الانتخابات؟" })
// Expected: High score, 5-6 patterns matched

// Test 2: Weak topic (Generic)
analyzeBehaviorPatterns({ title: "Economic indicators show growth" })
// Expected: Low score, 1-2 patterns matched, reframe suggestions

// Test 3: New topic (AI)
analyzeBehaviorPatterns({ title: "OpenAI announces new model" })
// Expected: Medium score, can be improved with reframing
```

The system now makes **ANY topic work** by applying proven behavior patterns! 🎯




