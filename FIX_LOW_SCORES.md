# Fix: Low Scores (0.90-9.50) - No Signals Saved

## Problem

RSS update processed 135 items but saved 0 signals because:
- **Score Range**: 0.90 - 9.50 (avg: 4.39) on 0-10 scale
- **Converted to 0-100**: 9 - 95 (avg: 43.9)
- **Threshold**: Was 50 (5.0/10), now lowered to 30 (3.0/10)
- **Result**: Average score (43.9) was below threshold (50), so nothing passed

## Root Cause

The **old scoring system** (fallback path) is being used, which gives very conservative scores. The recommendation engine might not be running, or DNA isn't loading correctly.

## Fixes Applied

### 1. Lowered Thresholds
- **Recommendation engine**: `minScore` lowered from 50 to 30
- **Fallback path**: `SCORE_THRESHOLD` lowered from 50 to 30
- **Test mode**: All thresholds set to 30 for testing

### 2. Added Behavior Score Boost
- Behavior analysis now **boosts old scores** by up to +20 points
- Formula: `boosted_score = old_score + (behavior_score * 0.2)`
- This helps items with good behavioral patterns pass even with low DNA scores

### 3. Enhanced Logging
- Shows behavior boost in console
- Shows original vs boosted scores
- Better debugging for why items are rejected

## Expected Results After Fix

### Before:
- Score: 4.39/10 (43.9/100) → **REJECTED** (below 50 threshold)
- 0 signals saved

### After:
- Score: 4.39/10 (43.9/100)
- Behavior boost: +10-15 points (if item has good behaviors)
- **Final score**: 53.9-58.9/100 → **PASSES** (above 30 threshold)
- Some signals should now be saved

## How to Test

1. **Run RSS update again**:
   ```
   Go to /signals page → Click "🔄 Update RSS Feeds"
   ```

2. **Check console logs**:
   ```
   🎯 Behavior boost: 65/100 → +13.0 = 56.9/100
   🔍 Checking: "..." | Score: 4.39 (56.9/100) | Threshold: 30
   ✅ PASSED: Score 56.9 >= 30
   ```

3. **Check results**:
   - Should see "saved X signals" (not 0)
   - Score range should include boosted scores
   - Items with good behaviors should pass

## If Still 0 Signals

### Check 1: Is DNA Loading?
Look for logs:
```
✅ DNA data loaded: 72 videos analyzed
🎯 Using recommendation engine for X items...
```

If you see:
```
⚠️  Using old scoring method (recommendation engine not available)
```
Then DNA might not be loading. Check:
- Health check API: `/api/health`
- DNA page: `/dna`

### Check 2: Are Items Being Filtered?
Look for:
```
🎯 STRICT GATES: 135 → 0 items
```
If all items are filtered out, strict gates might be too strict.

### Check 3: Behavior Scores
Check if behavior analysis is working:
```
🎯 Behavior boost: X/100 → +Y = Z/100
```
If you don't see this, behavior analysis might be failing.

## Next Steps

1. **Run RSS update** and check console
2. **Share results**:
   - How many signals saved?
   - What's the new score range?
   - Do you see behavior boost logs?

3. **If still 0 signals**:
   - Check DNA loading status
   - Check strict gates filtering
   - Check behavior analysis errors

## Temporary Testing Mode

All thresholds are now set to **30** (very lenient) for testing. Once we see signals being saved, we can:
1. Analyze which items are passing
2. Adjust thresholds based on actual data
3. Fine-tune behavior boost formula

The goal is to get **some signals** saved first, then optimize quality.

