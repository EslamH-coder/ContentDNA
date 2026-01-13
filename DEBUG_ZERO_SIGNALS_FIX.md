# Debug: Why 0 Signals Saved?

## Current Situation
- **Processed:** 74 items from 20 feeds
- **Saved:** 0 signals
- **Score Range:** 2.30 - 9.20 (avg: 4.87)
- **Score Scale:** 0-10 (old scoring system)

## The Problem

Scores are on **0-10 scale** (2.30-9.20), but thresholds are set for **0-100 scale**. This mismatch is causing all items to be filtered out.

## What I Fixed

### 1. Score Conversion
- Added automatic detection: if score <= 10, convert to 0-100 scale
- `2.30 (0-10)` → `23 (0-100)`
- `9.20 (0-10)` → `92 (0-100)`

### 2. Lowered Thresholds
- **Before:** `min_score=20` (2.0/10 or 20/100)
- **After:** `min_score=5` (0.5/10 or 5/100)
- This allows ALL items with score >= 0.5/10 to pass

### 3. Updated UI
- Changed from `min_score=10` to `min_score=5`
- This allows items with score >= 0.5/10

## Next Steps

### 1. Check Server Logs
After running RSS update, check your server console for:
```
🔄 Score conversion: 2.30 (0-10) → 23 (0-100)
✅ [1] Passed score threshold: 23.0 >= 5
```

### 2. Check Priority Filter
Look for:
```
⏭️  Priority filter: LOW < MEDIUM, skipping
```
If you see this, the priority filter is blocking items.

### 3. Check Deduplication
Look for:
```
⏭️  Item already exists, skipping
```
If you see many of these, items are already in the database.

### 4. Check Database Errors
Look for:
```
❌ Error inserting signal
```
If you see this, there's a database issue (RLS policies, schema mismatch, etc.)

## Test Command

Try with extremely lenient settings:
```
GET /api/rss-processor?show_id=YOUR_SHOW_ID&priority=LOW&min_score=1
```

This allows:
- ALL priorities (LOW, MEDIUM, HIGH)
- Scores >= 0.1/10 (1/100)

## Expected Behavior

With the fixes:
- Scores 2.30-9.20 (0-10) → 23-92 (0-100)
- Threshold: 5 (0-100 scale)
- **All items should pass** (23 >= 5, 92 >= 5)

If still 0 saved, check:
1. **Priority filter** - might be blocking LOW priority items
2. **Deduplication** - items might already exist
3. **Database errors** - check RLS policies and schema

## Quick Test

Run this SQL to check if signals exist:
```sql
SELECT COUNT(*) FROM signals WHERE show_id = 'YOUR_SHOW_ID';
SELECT title, score, created_at FROM signals 
WHERE show_id = 'YOUR_SHOW_ID' 
ORDER BY created_at DESC LIMIT 10;
```

If signals exist but UI shows 0, it's a read/RLS issue, not a write issue.




