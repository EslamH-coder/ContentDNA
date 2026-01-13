# How to Update RSS Feeds with Strict Quality Gates

## Quick Update (Recommended)

### From UI:
1. Go to **`/signals`** page
2. Select your show from dropdown
3. Click **"🔄 Update RSS Feeds"** button
4. Wait for processing (check console logs)

### What You'll See:
```
🎯 STRICT QUALITY GATES APPLIED:
   344 items → 8 strong ideas
   Topic DNA Match: 120 passed, 224 rejected
   Story Clarity: 90 passed, 30 rejected
   Arab Relevance: 45 passed, 45 rejected
   Specificity: 25 passed, 20 rejected
   Hook Potential: 15 passed, 10 rejected
   Uniqueness: 10 passed, 5 rejected
   Score >= 75: 8 passed, 2 rejected
```

## Direct API Call

### Using curl:
```bash
curl "http://localhost:3000/api/rss-processor?show_id=YOUR_SHOW_ID&priority=HIGH&min_score=75&items_per_feed=3&max_feeds=30"
```

### Using browser:
```
http://localhost:3000/api/rss-processor?show_id=YOUR_SHOW_ID&priority=HIGH&min_score=75&items_per_feed=3&max_feeds=30
```

## What Changed

✅ **Strict gates now ALWAYS enabled** (not just for >20 items)
✅ **Applied per feed** for quality filtering
✅ **Max 10 results per feed** after strict filtering
✅ **Min score 75** required

## Expected Results

**Before:** 344 items (noise)
**After:** 5-10 strong ideas (signal)

Each feed is filtered through 6 quality gates:
1. Topic DNA Match
2. Story Clarity  
3. Arab Relevance
4. Specificity
5. Hook Potential
6. Uniqueness

## Troubleshooting

### Still seeing 344 items?
1. **Clear old signals**: Delete existing signals in Supabase
2. **Check console logs**: Look for "STRICT QUALITY GATES APPLIED"
3. **Verify DNA loaded**: Check `/api/health` endpoint
4. **Check filter summary**: Look for `filter_summary` in response

### Not enough results?
- Lower `min_score` to 60
- Increase `maxResults` to 20
- Check if DNA topics are configured

### Too many results?
- Increase `min_score` to 85
- Decrease `maxResults` to 5
- Check gate rejection reasons in logs

