# Clear Old Signals to See Filtered Results

## Problem
You're still seeing 349 items because **old signals** are still in the database from before strict gates were applied.

## Solution: Clear Old Signals

### Option 1: Find Your Show ID First (Recommended)
Run this in Supabase SQL Editor to find your show_id:

```sql
-- Find your show_id
SELECT id, name FROM shows;
```

Then use the correct UUID (no trailing spaces!):

```sql
-- Delete all signals for your show (use UUID from above)
DELETE FROM signals WHERE show_id = 'your-actual-uuid-here';
```

### Option 2: Delete All Signals (Simplest)
If you only have one show, just delete all:

```sql
DELETE FROM signals;
```

### Option 3: Delete Only Low-Score Signals (Safest)
Keep high-score signals, delete only low ones:

```sql
DELETE FROM signals WHERE score < 80;
```

### Option 2: Keep Only Recent Signals
Keep only signals from last 24 hours:

```sql
DELETE FROM signals 
WHERE show_id = 'YOUR_SHOW_ID' 
AND created_at < NOW() - INTERVAL '24 hours';
```

### Option 3: Keep Only High-Score Signals
Keep only signals with score >= 75:

```sql
DELETE FROM signals 
WHERE show_id = 'YOUR_SHOW_ID' 
AND score < 75;
```

## After Clearing

1. **Go to `/signals` page**
2. **Click "🔄 Update RSS Feeds"**
3. **Wait for processing**
4. **You should now see 5-10 signals** (not 349!)

## New Strict Settings

After the fix:
- ✅ **Max 10 signals total** (was 50)
- ✅ **Max 5 per feed** (was 10)
- ✅ **Min score 80** (was 75)
- ✅ **Strict gates always enabled**

## Expected Results

**Before clearing:** 349 items (old + new)
**After clearing + update:** 5-10 items (strictly filtered)

