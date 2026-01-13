# Fix: Still 0 Signals Saved

## Problem

Even after lowering thresholds, still getting 0 signals saved with:
- Score Range: 0.90 - 9.50 (avg: 4.39)
- 135 items processed, 0 saved

## Root Causes Found

### 1. Recommendation Engine Threshold Still Too High
- **Line 360**: `batchMinScore` was still 50, not 30
- **Fixed**: Changed to 30

### 2. Priority Filter Too Strict
- **Default**: `priorityFilter = 'HIGH'` (only HIGH priority items saved)
- **Problem**: If recommendation engine assigns MEDIUM/LOW priority, items are filtered out
- **Fixed**: Changed default to `'MEDIUM'` (allows HIGH and MEDIUM)

### 3. Need Better Logging
- Added logging to show priority breakdown
- Added logging to show why items are filtered

## Fixes Applied

### 1. Lowered Recommendation Engine Threshold
```javascript
// Before: const batchMinScore = Math.min(minScore || 50, 50)
// After:
const batchMinScore = Math.min(minScore || 30, 30)  // Lowered to 30
```

### 2. Changed Priority Filter Default
```javascript
// Before: priorityFilter = 'HIGH'
// After:
priorityFilter = 'MEDIUM'  // Allows HIGH and MEDIUM priority items
```

### 3. Enhanced Logging
- Shows priority breakdown: `HIGH: X, MEDIUM: Y, LOW: Z`
- Shows priority filter setting
- Shows why items are skipped (priority filter)

## Expected Results

### Before:
- Priority filter: HIGH → Only HIGH priority items saved
- Threshold: 50 → Items with score < 50 rejected
- Result: 0 signals saved

### After:
- Priority filter: MEDIUM → HIGH and MEDIUM priority items saved
- Threshold: 30 → Items with score >= 30 pass
- Behavior boost: +10-20 points for good behaviors
- Result: Should save some signals

## How to Test

1. **Run RSS update again**:
   ```
   Go to /signals page → Click "🔄 Update RSS Feeds"
   ```

2. **Check console logs for**:
   ```
   ✅ Source: X recommended, Y rejected
   Priority breakdown: HIGH: A, MEDIUM: B, LOW: C
   ⚠️  Priority filter: MEDIUM (only MEDIUM+ will be saved)
   ```

3. **Look for items passing**:
   ```
   ✅ PASSED: Score X >= 30, Priority: MEDIUM, Topic: Y
   ```

4. **Check results**:
   - Should see "saved X signals" (X > 0)
   - Check which priorities are being saved

## If Still 0 Signals

### Check 1: Is Recommendation Engine Running?
Look for:
```
🎯 Using recommendation engine for X items...
✅ Source: X recommended, Y rejected
```

If you see:
```
⚠️  Using old scoring method
```
Then recommendation engine isn't running. Check DNA loading.

### Check 2: What Priorities Are Being Assigned?
Check logs:
```
Priority breakdown: HIGH: 0, MEDIUM: 5, LOW: 10
```

If all are LOW and filter is MEDIUM, they'll be filtered out.

### Check 3: Are Items Passing Score Threshold?
Check logs:
```
→ Below score threshold (25.0 < 30): "..."
```

If all scores are below 30, threshold might still be too high.

### Check 4: Are Items Being Filtered by Strict Gates?
Check logs:
```
🎯 Filter funnel:
   GATE1_TOPIC: 10 passed, 125 rejected
   ...
```

If all items are rejected by gates, gates might be too strict.

## Next Steps

1. **Run RSS update** and check console
2. **Share these logs**:
   - Priority breakdown numbers
   - How many items pass each filter
   - Any error messages

3. **If still 0 signals**, we can:
   - Lower priority filter to 'LOW'
   - Lower threshold further (to 20 or 15)
   - Disable strict gates temporarily
   - Check if recommendation engine is assigning priorities correctly

The key insight: **Priority filter was likely the main blocker** - if items have MEDIUM/LOW priority but filter is HIGH, they're all rejected regardless of score.

