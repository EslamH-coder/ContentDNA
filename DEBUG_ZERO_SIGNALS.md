# Debug Guide: Why 0 Signals Saved?

## Quick Test Commands

### Test 1: Very Lenient Settings
```
GET /api/rss-processor?show_id=YOUR_SHOW_ID&priority=LOW&min_score=10
```
This allows ALL priorities and scores >= 1.0/10

### Test 2: Check Server Logs
Look for these patterns in your server console:

```
⏭️  Priority filter: LOW < MEDIUM, skipping
→ Below score threshold (X < Y)
⏭️  Item already exists, skipping
❌ Error inserting signal
```

### Test 3: Check Database
```sql
-- Check if signals table exists and has data
SELECT COUNT(*) FROM signals;

-- Check recent signals
SELECT title, score, created_at FROM signals ORDER BY created_at DESC LIMIT 10;

-- Check for RLS policies
SELECT * FROM pg_policies WHERE tablename = 'signals';
```

## Common Issues

### Issue 1: Priority Filter Too Strict
**Symptom**: Logs show "Priority filter: LOW < MEDIUM, skipping"

**Fix**: Change priority filter to LOW
```
GET /api/rss-processor?show_id=YOUR_SHOW_ID&priority=LOW&min_score=20
```

### Issue 2: Score Threshold Too High
**Symptom**: Logs show "Below score threshold (X < Y)"

**Fix**: Lower min_score
```
GET /api/rss-processor?show_id=YOUR_SHOW_ID&priority=MEDIUM&min_score=10
```

### Issue 3: All Items Already Exist (Deduplication)
**Symptom**: Logs show "Item already exists, skipping"

**Fix**: Clear old signals or change deduplication logic
```sql
-- Clear old signals (CAREFUL!)
DELETE FROM signals WHERE show_id = 'YOUR_SHOW_ID' AND created_at < NOW() - INTERVAL '7 days';
```

### Issue 4: Database Errors
**Symptom**: Logs show "Error inserting signal"

**Fix**: Check:
1. RLS policies on signals table
2. Required columns in signals table
3. SUPABASE_SERVICE_ROLE_KEY is set

### Issue 5: Recommendation Engine Not Running
**Symptom**: Logs show "DNA not loaded" or "Falling back to old scoring"

**Fix**: 
1. Check DNA is loaded: `/api/dna/dashboard`
2. Check DNA file exists: `data/living_dna.json`
3. Import DNA if needed: `/dna/import`

## Debug Checklist

- [ ] Check server console logs for filtering reasons
- [ ] Verify priority filter setting (try LOW)
- [ ] Verify min_score setting (try 10)
- [ ] Check if items already exist in database
- [ ] Check for database insertion errors
- [ ] Verify DNA is loaded (check `/api/dna/dashboard`)
- [ ] Check RLS policies on signals table
- [ ] Verify SUPABASE_SERVICE_ROLE_KEY is set

## Test Endpoints

### Health Check
```
GET /api/health
```
Should show DNA loaded status

### DNA Dashboard
```
GET /api/dna/dashboard
```
Should show DNA summary

### RSS Processor (Debug Mode)
```
GET /api/rss-processor?show_id=YOUR_SHOW_ID&priority=LOW&min_score=10
```
Very lenient settings to test

## Expected Log Output

When working correctly, you should see:
```
✅ Source Name: 5 recommended, 10 rejected
   Priority breakdown: HIGH: 2, MEDIUM: 2, LOW: 1
   ✅ [1] Passed priority filter: HIGH
   ✅ [1] Passed score threshold: 45.0 >= 20
   ✅ PASSED ALL FILTERS: Score 45.0 >= 20, Priority: HIGH, Topic: us_china_trade
   💾 Attempting to save: "Title..."
   ✅ SAVED: "Title..." (score: 4.5 = 45/100)
📊 Source Name: Min: 2.30, Max: 9.20, Avg: 4.90, Saved: 3
```

## If Still 0 Signals

1. **Check the first 20 log lines** - they show what's happening
2. **Try priority=LOW&min_score=5** - extremely lenient
3. **Check database directly** - maybe signals ARE being saved but not showing
4. **Check RLS policies** - might be blocking reads
