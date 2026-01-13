# Hook Potential Scale Issue

## User Report

Hook potential values are: **10 to 96, avg 7.5**

This suggests a scale mismatch:
- **Expected**: 0-10 scale (as per code: `Math.min(10, ...)`)
- **Observed**: 10-96 range

## Possible Causes

### 1. Scale Conversion Issue
The `hook_potential` is calculated on 0-10 scale but might be:
- Converted to 0-100 somewhere
- Multiplied incorrectly
- Stored incorrectly

### 2. Different Calculation Paths
- **Old scoring** (`dna-scoring.js`): `hook_potential = (recency * 0.6 + dnaMatchScore * 0.4) * 10` → 0-10
- **Recommendation engine**: Might use different scale
- **Behavior analysis**: Might add to hook_potential

### 3. Database Storage
The `hook_potential` column is `DECIMAL(3,1)` which allows 0-999.9, so values up to 96 are valid but unexpected.

## Current Code

### Old Scoring (`lib/dna-scoring.js`):
```javascript
const hookPotential = Math.min(10, (recency * 0.6 + dnaMatchScore * 0.4) * 10);
// Returns: 0-10
```

### Storage (`app/api/rss-processor/route.js`):
```javascript
hook_potential: String(scoring.hook_potential || '0')
// Stores as string, but should be 0-10
```

## Investigation Needed

1. **Check actual values in database**:
   ```sql
   SELECT hook_potential, COUNT(*) 
   FROM signals 
   WHERE show_id = '00000000-0000-0000-0000-000000000004'
   GROUP BY hook_potential
   ORDER BY hook_potential;
   ```

2. **Check which path is being used**:
   - Old scoring path → should be 0-10
   - Recommendation engine path → might be different

3. **Check if behavior analysis is affecting it**:
   - Behavior scores are 0-100
   - Might be getting mixed with hook_potential

## Fix Applied

Updated `dna-scoring.js` to ensure hook_potential is strictly 0-10:
```javascript
let hookPotential = (recency * 0.6 + dnaMatchScore * 0.4) * 10;
hookPotential = Math.min(10, Math.max(0, hookPotential)); // Strict 0-10 cap
```

## Next Steps

1. **Check database** to see actual hook_potential values
2. **Check server logs** to see which path is calculating hook_potential
3. **Verify** if recommendation engine uses different scale
4. **Normalize** all hook_potential calculations to 0-10 scale

The range 10-96 with avg 7.5 doesn't make sense - if it's 0-10 scale, max should be 10. If it's 0-100 scale, avg 7.5 is very low. Need to investigate which scale is actually being used.

