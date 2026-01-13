# Testing Shorts Analysis Integration

## What Was Added

1. **Shorts Success Predictor** - Predicts if a short will go viral based on topic + duration
2. **Shorts Quality Gates** - Checks duration, topic suitability, viewed % prediction
3. **Shorts Analysis in Signals** - Adds shorts predictions to signal data

## How to Test

### Step 1: Run RSS Update

1. Go to `/signals` page
2. Click "🔄 Update RSS Feeds"
3. Watch server console logs

### Step 2: Check Console Logs

You should see new shorts analysis logs:

#### For Viral Topics:
```
✅ PASSED: Score 85.0 >= 50, Priority: HIGH, Topic: missiles_air_defense
   📱 Shorts: HIGH success (1M+ views, 65.5% viewed)
   ⚡ PRIORITY: Make shorts! This topic goes VIRAL
```

#### For Weak Topics:
```
✅ PASSED: Score 75.0 >= 50, Priority: MEDIUM, Topic: logistics_supply_chain
   📱 Shorts: LOW success (<300K views, 62.4% viewed)
```

### Step 3: Check Signals in Database

Query signals to see shorts analysis:

```sql
SELECT 
  id,
  title,
  raw_data->'recommendation'->>'topic' as topic,
  raw_data->'recommendation'->'shorts_analysis'->>'predicted_success' as shorts_success,
  raw_data->'recommendation'->'shorts_analysis'->>'predicted_views' as predicted_views,
  raw_data->'recommendation'->'shorts_analysis'->>'predicted_viewed_pct' as predicted_viewed_pct
FROM signals 
WHERE show_id = 'YOUR_SHOW_ID'
ORDER BY created_at DESC
LIMIT 10;
```

### Step 4: Test Specific Topics

#### Viral Shorts Topics (Should show HIGH):
- `missiles_air_defense` → 5.6M avg views
- `big_tech_platforms` → 5.5M avg views (73.2% viewed - BEST!)
- `arms_industry_exports` → 1.8M avg views

#### Weak Shorts Topics (Should show LOW):
- `logistics_supply_chain` → 354K avg views
- `energy_oil_gas_lng` → 287K avg views
- `sanctions_econ_war` → 271K avg views

## Expected Results

### Signal with Viral Shorts Potential:
```json
{
  "title": "Golden Dome Missile Defense",
  "raw_data": {
    "recommendation": {
      "topic": "missiles_air_defense",
      "shorts_analysis": {
        "predicted_success": "HIGH",
        "predicted_views": "1M+",
        "predicted_viewed_pct": 65.5,
        "score": 75,
        "factors": [
          {
            "factor": "TOPIC",
            "impact": "+40",
            "reason": "missiles_air_defense is a VIRAL shorts topic (avg 5,601,208 views)"
          },
          {
            "factor": "DURATION",
            "impact": "+20",
            "reason": "60s is in optimal range (60-80s)"
          }
        ],
        "recommendations": ["GO! This has viral potential"]
      }
    }
  }
}
```

## Shorts Cheat Sheet

### 🏆 VIRAL TOPICS (Always make shorts!):
- `missiles_air_defense` → 5.6M avg, 65.5% viewed
- `big_tech_platforms` → 5.5M avg, 73.2% viewed (BEST!)
- `arms_industry_exports` → 1.8M avg

### ⚠️ MODERATE (Test first):
- `us_china_geopolitics` → 1.4M avg, 64% viewed

### ❌ WEAK (Skip shorts):
- `energy_oil_gas_lng` → 287K avg
- `logistics_supply_chain` → 354K avg
- `sanctions_econ_war` → 271K avg

### 📏 DURATION RULES:
- ✅ **60-80 sec** = OPTIMAL (5.6M views possible)
- ⚠️ 80-120 sec = OK but suboptimal
- ❌ **>120 sec** = 10x fewer views!
- ❌ **>165 sec** = DISASTER

### 🎯 KEY METRIC: Viewed vs Swiped (NOT 3s retention!)
- 73.2% viewed → 5.5M views
- 59.1% viewed → 271K views

### ⚠️ WARNING: High 3s retention ≠ High views!
- 130% retention → only 163K views (WORST performer)
- 113% retention → 5.5M views (TOP performer)

## Troubleshooting

### No Shorts Analysis?
- Check if topic IDs match: `missiles_air_defense`, `big_tech_platforms`, etc.
- Check console logs for shorts analysis messages
- Verify `shortsAnalyzer.js` has the topic in viral/moderate/weak lists

### Wrong Predictions?
- Check if topic is in the correct category (viral/moderate/weak)
- Verify duration is being considered (defaults to 60s)
- Check if content signals (military, controversy) are being detected

## Next Steps

1. **Monitor shorts predictions** - See which topics get HIGH/MEDIUM/LOW
2. **Compare with actual performance** - Do predictions match reality?
3. **Adjust thresholds** - Fine-tune if needed
4. **Add to UI** - Display shorts analysis on signals page

