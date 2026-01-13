# Fix: Hook Potential Scale Issue

## User Report

Hook potential values: **10 to 96, avg 7.5**

This indicates a scale mismatch - hook_potential should be **0-10**, not 0-100.

## Root Cause

In the recommendation engine path, `hook_potential` was being set to:
```javascript
hook_potential: String(rec.recommended?.score || rec.filter_score || '0')
```

This stores the **score** (0-100) as hook_potential, which is why we see values up to 96.

## Fix Applied

### Recommendation Engine Path:
Now calculates hook_potential properly:
1. **First choice**: Hook pattern match_score (0-100) → convert to 0-10
2. **Second choice**: Behavior analysis score (0-100) → convert to 0-10  
3. **Fallback**: Filter score (0-100) → convert to 0-10

```javascript
let hookPotentialValue = 0;
if (rec.hook_pattern?.match_score) {
  // Hook pattern match score is 0-100, convert to 0-10
  hookPotentialValue = Math.min(10, Math.max(0, rec.hook_pattern.match_score / 10));
} else if (rec.behavior_analysis?.score) {
  // Behavior score is 0-100, convert to 0-10
  hookPotentialValue = Math.min(10, Math.max(0, rec.behavior_analysis.score / 10));
} else if (rec.filter_score) {
  // Filter score is 0-100, convert to 0-10
  hookPotentialValue = Math.min(10, Math.max(0, rec.filter_score / 10));
}
hook_potential: String(hookPotentialValue.toFixed(1))
```

### Fallback Path (Old Scoring):
Old scoring already returns hook_potential on 0-10 scale, but added safety check:
```javascript
hook_potential: String(Math.min(10, Math.max(0, Number(scoring.hook_potential) || 0)).toFixed(1))
```

## Expected Results

After fix:
- **Hook potential range**: 0.0 - 10.0 (not 10-96)
- **Average**: Should be reasonable (e.g., 5.0-8.0)
- **Values**: All properly capped at 10.0

## How to Verify

1. **Run RSS update** and check saved signals
2. **Query database**:
   ```sql
   SELECT 
     hook_potential,
     COUNT(*) as count
   FROM signals 
   WHERE show_id = '00000000-0000-0000-0000-000000000004'
   GROUP BY hook_potential
   ORDER BY hook_potential;
   ```

3. **Expected**: All values should be between 0.0 and 10.0

## Note

The hook_potential field in the database is `DECIMAL(3,1)` which allows 0-999.9, so values up to 96 were technically valid but incorrect. After this fix, all new signals should have hook_potential in the correct 0-10 range.

