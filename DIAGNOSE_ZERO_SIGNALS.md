# Diagnose: Why 0 Signals Saved?

## Current Situation
- ✅ RSS processor runs successfully
- ✅ Processes 74 items from 20 feeds
- ❌ Saves 0 signals
- ❌ UI shows 0 signals (confirmed by browser console)

## Step-by-Step Diagnosis

### 1. Check Server Console Logs

After running RSS update, look for these patterns in your **server console** (not browser console):

#### A. Are items being recommended?
```
✅ Source Name: X recommended, Y rejected
```
- If `X = 0`, the recommendation engine is filtering everything out
- Check the filter summary logs

#### B. Are items passing priority filter?
```
✅ [1] Passed priority filter: HIGH (filter: LOW)
⏭️  [2] Priority filter: LOW < MEDIUM, skipping
```
- If you see many "Priority filter" skips, items are being filtered by priority

#### C. Are items passing score threshold?
```
✅ [1] Passed score threshold: 23.0 >= 5
→ [2] Below score threshold (15.0 < 5): "..."
```
- If you see many "Below score threshold", the threshold is still too high

#### D. Are items being deduplicated?
```
⏭️  Item already exists, skipping: "..."
```
- If you see many of these, items already exist in database

#### E. Are there database errors?
```
❌ Error inserting signal: ...
   Error code: 42501
   ⚠️  RLS POLICY ERROR!
```
- If you see this, it's an RLS policy issue

### 2. Run Diagnostic Script

I've created a diagnostic script. Run it:

```bash
cd cursor
node scripts/diagnose_signals.js
```

This will:
- Check if shows exist
- Count total signals in database
- Check signals for your show_id
- Try to insert a test signal
- Report any errors

### 3. Check Database Directly

Run these SQL queries in Supabase dashboard:

```sql
-- Check if signals exist at all
SELECT COUNT(*) FROM signals;

-- Check signals for your show
SELECT COUNT(*) FROM signals 
WHERE show_id = '00000000-0000-0000-0000-000000000004';

-- Check recent signals
SELECT id, title, score, created_at, show_id 
FROM signals 
ORDER BY created_at DESC 
LIMIT 10;

-- Check RLS policies
SELECT * FROM pg_policies 
WHERE tablename = 'signals';
```

### 4. Check Environment Variables

Make sure these are set in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...  # ← CRITICAL for server-side writes
```

The `SUPABASE_SERVICE_ROLE_KEY` is **required** for server-side inserts to bypass RLS.

### 5. Most Likely Issues

Based on the symptoms (0 saved, scores 2.30-9.20):

#### Issue 1: Recommendation Engine Filtering Everything
**Symptom:** Server logs show "0 recommended"
**Fix:** Check strict quality gates - they might be too strict

#### Issue 2: Priority Filter Too Strict
**Symptom:** Server logs show many "Priority filter: LOW < MEDIUM"
**Fix:** Use `priority=LOW` in the API call

#### Issue 3: RLS Policy Blocking Writes
**Symptom:** Server logs show "Error code: 42501"
**Fix:** Check `SUPABASE_SERVICE_ROLE_KEY` is set, or create INSERT policy

#### Issue 4: Items Already Exist
**Symptom:** Server logs show many "Item already exists"
**Fix:** Clear old signals or change deduplication logic

### 6. Quick Test

Try the most lenient settings:

```javascript
// In browser console or API call
fetch('/api/rss-processor?show_id=00000000-0000-0000-0000-000000000004&priority=LOW&min_score=1&items_per_feed=3&max_feeds=5')
```

This should save at least a few signals if the system is working.

### 7. Check Server Logs Output

After running RSS update, the server should log:

```
📊 Summary: Checked: X, Priority: Y, Score: Z, Deduplicated: A, Failed: B, Saved: C
```

This tells you exactly where items are being filtered:
- `Checked - Priority` = filtered by priority
- `Priority - Score` = filtered by score
- `Deduplicated` = already exist
- `Failed` = database errors
- `Saved` = successfully saved

## Next Steps

1. **Check server console logs** (most important!)
2. **Run diagnostic script**: `node scripts/diagnose_signals.js`
3. **Check database directly** with SQL queries
4. **Verify environment variables** are set
5. **Try most lenient test** with `priority=LOW&min_score=1`

The server console logs will tell you exactly what's happening!




