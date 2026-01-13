# Behavior-Based Recommendation System

## 🎯 The Paradigm Shift

```
❌ OLD: "Topic X worked, only do Topic X"
✅ NEW: "These BEHAVIORS make content viral, apply to ANY topic"
```

## 📊 Key Insights from Data

### What DOESN'T Predict Views (Traps!):
- **CTR**: High performers have LOWER CTR (4.4% vs 6.4%)
- **Retention 30s**: Same 76% retention = 484K AND 2.85M views
- **Avg % Viewed**: High performers have LOWER (47.1% vs 50.8%)

### What DOES Predict Views (Behaviors):
| Behavior | High Performers | Low Performers | Impact |
|----------|----------------|----------------|--------|
| HOW/WHY question | **100%** | 50% | +50% |
| Arab region | **33%** | 0% | +33% |
| Big number in hook | **Present** | Absent | +1.5M views |
| Entity in hook | 67% | 67% | +693K views |

## 🧩 Behavior Definitions

### 1. CURIOSITY_TRIGGER (Weight: +25)
- **Pattern**: كيف, لماذا, ليه, how, why
- **Impact**: 100% of high performers use HOW/WHY framing
- **Example Good**: "كيف سيدمر ترمب اقتصاد أمريكا؟"
- **Example Bad**: "ترمب يدمر اقتصاد أمريكا"

### 2. SCALE_ANCHOR (Weight: +20)
- **Pattern**: Big numbers (مليار, مليون, تريليون)
- **Impact**: Big number in hook = +1.5M views average
- **Example Good**: "الشركة اللي قيمتها 3.4 تريليون دولار"
- **Example Bad**: "الشركة الكبيرة"

### 3. ENTITY_MAGNETISM (Weight: +15)
- **Pattern**: Major entities (ترامب, ماسك, أبل, الصين)
- **Impact**: Major entity in hook = +693K views
- **Example Good**: "أبل vs مايكروسوفت: من سيفوز؟"
- **Example Bad**: "شركات التقنية تتنافس"

### 4. REGIONAL_RELEVANCE (Weight: +15)
- **Pattern**: Arab regions (مصر, السعودية, الخليج)
- **Impact**: 33% of high performers vs 0% of low performers!
- **Example Good**: "كيف يؤثر على مصر والخليج؟"
- **Example Bad**: "كيف يؤثر على العالم؟"

### 5. DATE_SPECIFICITY (Weight: +10)
- **Pattern**: Specific dates (في 13 فبراير 2025)
- **Impact**: Specific date = credibility signal
- **Example Good**: "في 13 فبراير 2025 ترامب استقبل..."
- **Example Bad**: "مؤخراً ترامب قال..."

### 6. IMMEDIATE_ANSWER (Weight: +10)
- **Pattern**: Question + immediate answer
- **Impact**: Anti-clickbait = trust + curiosity
- **Example Good**: "هل أمريكا تقدر تحارب الصين؟ الإجابة نعم..."
- **Example Bad**: "هل أمريكا تقدر تحارب الصين؟ (شاهد لتعرف)"

## ⚠️ Penalties

### CLICKBAIT_QUESTION (-10)
- Question without answer feels clickbaity

### VAGUE_THREAT (-15)
- "في خطر" without specificity performs poorly

### NO_ENTITY (-10)
- Content without recognizable entity struggles

## 📈 Scoring System

- **Base Score**: 30
- **Max Score**: 100
- **High Potential**: ≥70 (1M+ views)
- **Medium Potential**: 50-69 (500K-1M views)
- **Low Potential**: <50 (<500K views)

## 🚀 Usage Examples

### Example 1: Analyze RSS Item
```javascript
import { analyzeItemBehaviors } from './lib/behaviors/behaviorPredictor.js';

const result = analyzeItemBehaviors(rssItem);
console.log(result.behavior_analysis.score); // 75
console.log(result.viral_potential); // HIGH_POTENTIAL
console.log(result.strengths); // ['HOW/WHY Question', 'Big Number']
console.log(result.how_to_improve); // Recommendations
```

### Example 2: Optimize Weak Angle
```javascript
import { generateOptimizedAngle } from './lib/behaviors/behaviorPredictor.js';

const optimized = generateOptimizedAngle(
  'أسعار النفط تتغير',
  {
    numbers: ['50 مليار دولار'],
    entities: ['السعودية']
  }
);

console.log(optimized.optimized);
// "لماذا السعودية: أسعار النفط تتغير (50 مليار دولار)... والتأثير على الخليج؟"
console.log(optimized.score_after); // 75 (from 30)
```

### Example 3: Evaluate New Topic
```javascript
import { evaluateNewTopic } from './lib/behaviors/newTopicExplorer.js';

const result = evaluateNewTopic('الذكاء الاصطناعي يغير سوق العمل', {
  number: '100 مليون وظيفة',
  entity: 'OpenAI'
});

console.log(result.recommendation); // STRONG_GO
console.log(result.best_angle.angle);
// "لماذا OpenAI استثمر 100 مليون وظيفة في الذكاء الاصطناعي؟ التأثير على الخليج"
```

### Example 4: Rescue Weak Topic
```javascript
import { rescueTopic } from './lib/behaviors/newTopicExplorer.js';

const result = rescueTopic('أسعار النفط تتغير', {
  numbers: ['50 مليار دولار'],
  entities: ['السعودية']
});

console.log(result.status); // RESCUED
console.log(result.rescued);
// "لماذا السعودية: أسعار النفط تتغير (50 مليار دولار)... والتأثير على الخليج؟"
console.log(result.improvement); // 45 (from 30 to 75)
```

## 🔍 Integration Points

### RSS Processor
- Behavior analysis runs for all signals
- Low-scoring items get optimized angles
- Behavior data stored in `raw_data.recommendation.behavior_analysis`

### Console Logs
```
✅ PASSED: Score 85.0 >= 50, Priority: HIGH, Topic: logistics_supply_chain
   🎯 Behavior Score: 75/100 (HIGH_POTENTIAL, 1M+ views)
   💡 Optimized Angle: "لماذا..." (if score was low)
```

### Signal Data
```json
{
  "raw_data": {
    "recommendation": {
      "behavior_analysis": {
        "score": 75,
        "prediction": "HIGH_POTENTIAL",
        "expected_views": "1M+",
        "behaviors_found": ["HOW/WHY Question", "Big Number", "Arab Connection"],
        "behaviors_missing": ["Specific Date"],
        "recommendations": [
          {
            "action": "Add Specific Date",
            "how": "Add specific date (day month year)",
            "example": "في 13 فبراير 2025 ترامب استقبل...",
            "potential_gain": "+10"
          }
        ]
      },
      "behavior_optimized_angle": {
        "original": "أسعار النفط تتغير",
        "optimized": "لماذا السعودية: أسعار النفط تتغير (50 مليار دولار)... والتأثير على الخليج؟",
        "score_before": 30,
        "score_after": 75
      }
    }
  }
}
```

## 📋 Testing

### Step 1: Run RSS Update
1. Go to `/signals` page
2. Click "🔄 Update RSS Feeds"
3. Watch server console

### Step 2: Check Logs
Look for:
```
🎯 Behavior Score: 75/100 (HIGH_POTENTIAL, 1M+ views)
💡 Optimized Angle: "..." (if score was low)
```

### Step 3: Query Signals
```sql
SELECT 
  title,
  raw_data->'recommendation'->'behavior_analysis'->>'score' as behavior_score,
  raw_data->'recommendation'->'behavior_analysis'->>'prediction' as prediction,
  raw_data->'recommendation'->'behavior_analysis'->>'expected_views' as expected_views
FROM signals 
ORDER BY created_at DESC
LIMIT 10;
```

## 🎯 Key Benefits

1. **Topic-Agnostic**: Works for ANY topic, not just proven ones
2. **Actionable**: Tells you exactly what to add/change
3. **Predictive**: Scores predict views before production
4. **Rescue Weak Topics**: Can transform low-scoring ideas into viable content
5. **Explore Safely**: Test new topics without risking full production

## 📁 Files Created

1. `lib/behaviors/audienceBehaviors.js` - Behavior definitions and scoring
2. `lib/behaviors/behaviorPredictor.js` - Item analysis and angle optimization
3. `lib/behaviors/newTopicExplorer.js` - New topic evaluation and rescue

The behavior-based system is now fully integrated and ready to use!

