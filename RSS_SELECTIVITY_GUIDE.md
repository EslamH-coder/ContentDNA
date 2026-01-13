# RSS Feed Selectivity Guide

## Problem
With 300+ RSS feeds, processing everything is:
- **Slow** (takes forever)
- **Wasteful** (saves low-quality items)
- **Overwhelming** (too many signals)

## Solution: Smart Selectivity

The system now **automatically adjusts** based on feed count and applies **strict filters**.

## Auto-Selectivity Settings

### Feed Count Detection
- **300+ feeds**: 3 items/feed, process top 30 feeds
- **200-300 feeds**: 5 items/feed, process top 50 feeds
- **100-200 feeds**: 10 items/feed, process top 75 feeds
- **50-100 feeds**: 15 items/feed, process all feeds
- **<50 feeds**: 20 items/feed, process all feeds

### Feed Prioritization
1. **Priority 1**: Feeds with DNA topics configured
2. **Priority 2**: Active feeds (have recent signals in last 7 days)
3. **Priority 3**: Other feeds (lowest priority)

### Priority Filtering
- **Default**: Only HIGH priority items
- **Configurable**: HIGH, MEDIUM, or LOW

### Score Threshold
- **Default**: Minimum score 75/100 (for 300+ feeds)
- **Configurable**: Adjust based on quality needs

### Early Exit
- Stops after saving **50 signals** (prevents over-processing)
- Processes feeds in priority order until limit reached

## How to Use

### 1. From UI (Recommended)
Click **"🔄 Update RSS Feeds"** button on `/signals` page:
- Automatically uses aggressive settings for 300+ feeds
- Only HIGH priority, min score 75
- 3 items per feed, max 30 feeds
- Early exit at 50 signals

### 2. API Call (Custom Settings)
```bash
GET /api/rss-processor?show_id=UUID&priority=HIGH&min_score=75&items_per_feed=3&max_feeds=30
```

**Parameters:**
- `priority`: HIGH, MEDIUM, or LOW (default: HIGH)
- `min_score`: 0-100 (default: 75 for 300+ feeds)
- `items_per_feed`: Items to fetch per feed (default: auto)
- `max_feeds`: Max feeds to process (default: auto)

## Example: 300 Feeds

### Before (No Selectivity):
- Process all 300 feeds
- 20 items per feed = **6,000 items**
- Process all items = **very slow**
- Save many low-quality signals

### After (With Selectivity):
- Process top 30 feeds (prioritized)
- 3 items per feed = **90 items**
- Only HIGH priority, score ≥ 75
- Early exit at 50 signals
- Save ~10-20 high-quality signals

**Result:** **10x faster**, **10x more selective**, **better quality**

## Feed Prioritization Logic

1. **DNA Topics** (Priority 1):
   - Feeds with `dna_topics` configured
   - These are most relevant to your channel

2. **Active Feeds** (Priority 2):
   - Feeds that produced signals in last 7 days
   - More signals = higher priority

3. **Other Feeds** (Priority 3):
   - Feeds with no recent activity
   - Processed last (or skipped if limit reached)

## Console Output

You'll see logs like:
```
📊 Selectivity: Processing 30 of 300 feeds
   - 5 feeds with DNA topics
   - 12 active feeds (recent signals)
   - 13 other feeds
   - 270 feeds skipped (lower priority)
⚙️  Processing settings: 3 items/feed, min priority: HIGH, min score: 75
📊 Bloomberg Markets: Min: 75.00, Max: 95.00, Avg: 82.50, Saved: 2
✅ Early exit: Saved 50 signals (max: 50)
   Processed 15 feeds before reaching limit
📈 Summary:
   Processed 15 feeds, skipped 5 feeds with no matches
   Total items processed: 45, Total saved: 50
   Selectivity: HIGH priority only, min score: 75
   Feed selectivity: 30 of 300 feeds processed (10.0%)
   ⚡ Early exit: Reached max signals limit (50)
```

## Best Practices

1. **Start selective**: Use HIGH priority, score 75+ for 300+ feeds
2. **Monitor results**: Check how many signals are saved
3. **Adjust if needed**: Lower threshold if too few signals
4. **Prioritize feeds**: Configure DNA topics on important feeds
5. **Use early exit**: System stops at 50 signals automatically

## Configuration

### To Prioritize a Feed:
1. Go to Supabase SQL Editor
2. Update feed's `dna_topics`:
```sql
UPDATE signal_sources 
SET dna_topics = '["us_china_geopolitics", "energy_oil_gas_lng"]'::jsonb
WHERE name = 'Bloomberg Markets' AND show_id = 'YOUR_SHOW_ID';
```

### To Adjust Selectivity:
Modify the button URL in `/signals` page or call API directly:
```bash
# More aggressive (fewer signals)
?priority=HIGH&min_score=80&items_per_feed=2&max_feeds=20

# Less aggressive (more signals)
?priority=MEDIUM&min_score=60&items_per_feed=5&max_feeds=50
```
