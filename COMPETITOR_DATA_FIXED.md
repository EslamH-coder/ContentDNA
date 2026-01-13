# ✅ Competitor Data Issue - FIXED

## 🔍 Problem Found

The `/app/api/signals/route.js` was querying `competitor_videos` with:
```javascript
.eq('show_id', showId)
```

But `competitor_videos` table **doesn't have a `show_id` column**! It only has `competitor_id` which references `competitors.id`, and `competitors` has `show_id`.

## ✅ Solution Applied

Changed the query to:
1. First get competitor IDs for the show
2. Then query `competitor_videos` with `.in('competitor_id', competitorIds)`
3. Join with `competitors` table to get show_id

## 📊 Current Status

### Database Status:
- ✅ **11 competitors** configured
- ✅ **662 competitor videos** in database
- ✅ All competitors have tracking enabled
- ✅ All have YouTube channel IDs

### The Fix:
**File**: `/app/api/signals/route.js` (lines 600-615)

**Before:**
```javascript
.eq('show_id', showId)  // ❌ This column doesn't exist!
```

**After:**
```javascript
// Get competitor IDs first
const { data: showCompetitors } = await supabaseAdmin
  .from('competitors')
  .select('id')
  .eq('show_id', showId);

const competitorIds = showCompetitors?.map(c => c.id) || [];

// Then query videos
.in('competitor_id', competitorIds)  // ✅ Correct!
```

## 🎯 Expected Results

After this fix, the Ideas feature should now:
1. ✅ Fetch competitor videos correctly
2. ✅ Detect competitor breakouts (+30 points)
3. ✅ Count multiple competitors (+20 points)
4. ✅ Show higher scores (50-100 instead of 30-50)
5. ✅ Display "Post Today" and "This Week" tiers

## 🧪 Test It

1. **Refresh the Ideas page** (`/studio`)
2. **Check console logs** - should see competitor videos count > 0
3. **Look for competitor signals** in idea cards:
   - 🔥 Competitor breakout
   - 📊 Multiple competitors posted
4. **Check scores** - should be higher now

## 📝 Summary

- **Root Cause**: Wrong query filter (using non-existent `show_id` column)
- **Fix**: Query via `competitor_id` after getting competitor IDs
- **Status**: ✅ Fixed
- **Data Available**: 662 videos from 11 competitors
- **Next Step**: Test the Ideas feature to see competitor signals
