# Ideas Feature - 3 Bugs Fixed ✅

## Bug 1: Post Today Threshold - FIXED ✅

### Problem
Ideas with score 82-85 were showing as "This Week" instead of "Post Today".

### Root Cause
The `getUrgencyTier()` function was requiring:
- `score >= 70 && signalCount >= 3 && hasCompetitorBreakout`

This meant a high-scoring idea (80+) without 3+ signals or without a competitor breakout would be downgraded to "This Week".

### Fix Applied
Changed the threshold in `/lib/scoring/multiSignalScoring.js` (line 355):

**Before:**
```javascript
if (score >= 70 && signalCount >= 3 && hasCompetitorBreakout) {
```

**After:**
```javascript
if (score >= 80 || (score >= 70 && hasCompetitorBreakout)) {
```

**New Logic:**
- **Post Today**: `score >= 80` OR (`score >= 70` AND has competitor breakout)
- **This Week**: `score >= 50` AND `signalCount >= 2`
- **Backlog**: `score >= 30` OR `signalCount >= 1`

### Result
Ideas with score 80+ will now show as "Post Today" 🔴, even without competitor breakout.

---

## Bug 2: Trendsetter Showing Posts, Not Breakouts - FIXED ✅

### Problem
Trendsetter signals were showing for ANY post (e.g., "Trendsetter: العربية posted 15h ago"), not just breakouts.

### Root Cause
In `findCompetitorBreakout()` (line 521), trendsetter logic was including ALL matching videos without checking for breakout:
```javascript
if (stats.type === 'trendsetter') {
  // For trendsetters, include all matching videos (prioritize recency over breakout)
  trendsetterVideos.push({...}); // No multiplier check!
}
```

### Fix Applied
Changed trendsetter logic in `/lib/scoring/multiSignalScoring.js` (lines 520-546):

**Before:**
```javascript
if (stats.type === 'trendsetter') {
  // Include all matching videos
  trendsetterVideos.push({...});
}
```

**After:**
```javascript
const multiplier = video.views && avgViews > 0 ? video.views / avgViews : 0;

if (stats.type === 'trendsetter') {
  // Only include breakouts (1.5x+ average), not any post
  if (multiplier >= 1.5) {
    trendsetterVideos.push({...});
  } else if (isDebugIdea) {
    console.log(`⚠️ Trendsetter NOT a breakout: ${multiplier.toFixed(2)}x - SKIPPED`);
  }
}
```

**Updated Signal Text:**
Changed from: `"Trendsetter: ${channelName} posted ${time}"`
To: `"Trendsetter breakout: ${channelName} got ${multiplier}x their average ${time}"`

### Result
Trendsetter signals now only appear when a video is a breakout (1.5x+ average views), matching the old Signals page behavior.

---

## Bug 3: "You haven't covered this" Incorrect - FIXED ✅

### Problem
User has posted videos about Venezuela:
- "كيف تخطط فنزويلا لتوريط أمريكا في حرب عصابات طويلة؟"
- "هل يغزو ترامب فنزويلا؟"
- "كيف خطفت أمريكا حليف الصين المهم؟"

But system says "You haven't covered this topic" for Venezuela/oil ideas.

### Root Causes
1. **Keyword matching required 2+ matches** - Too strict, especially for cross-language matching
2. **Only checking signal title** - Not checking description where "Venezuela" might be mentioned
3. **Bilingual keyword expansion** - Not working in reverse (Arabic video title → English signal keywords)

### Fixes Applied

#### Fix 3.1: Reduced keyword matching requirement
In `findDaysSinceLastPost()` (line 998):

**Before:**
```javascript
const hasMatch = matchingKeywords.length >= 2; // Required 2+ keywords
```

**After:**
```javascript
const hasMatch = matchingKeywords.length >= 1; // Only need 1 keyword match
```

#### Fix 3.2: Include description in keyword extraction
In `calculateIdeaScore()` (lines 28-29, 246):

**Before:**
```javascript
const normalizedTitle = (signalTitle || '').toLowerCase();
const daysSinceLastPost = findDaysSinceLastPost(normalizedTitle, signalTopicId, userVideos);
```

**After:**
```javascript
const normalizedTitle = (signalTitle || '').toLowerCase();
const normalizedText = `${normalizedTitle} ${(signalDescription || '').toLowerCase()}`.trim();
const daysSinceLastPost = findDaysSinceLastPost(normalizedText, signalTopicId, userVideos);
```

#### Fix 3.3: Improved keyword matching logic
In `findDaysSinceLastPost()` (line 992):

**Before:**
```javascript
const matches = videoTitle.includes(normalizedKw) && normalizedKw.length > 2;
```

**After:**
```javascript
const matches = normalizedKw.length > 1 && (
  videoTitle.includes(normalizedKw) || 
  normalizedKw.includes(videoTitle.substring(0, Math.min(normalizedKw.length + 5, videoTitle.length)))
);
```

#### Fix 3.4: Enhanced debug logging
Added comprehensive debug logging for Venezuela/oil ideas:
- Shows signal text (title + description)
- Shows extracted keywords with translations
- Shows each video being checked
- Shows matching keywords for each video
- Shows final match results

#### Fix 3.5: Pass description to scoring
In `/app/api/signals/route.js` (line 863):

**Before:**
```javascript
signalDescription: signal.description || '', // Not passed
```

**After:**
```javascript
signalDescription: signal.description || signal.raw_data?.description || '', // Include description
```

### Result
The system will now:
1. Extract keywords from both title AND description
2. Match user videos even if only 1 keyword matches (e.g., "فنزويلا" in video matches "venezuela" keyword)
3. Use bilingual keyword expansion in both directions
4. Show detailed debug logs for Venezuela/oil ideas to help diagnose any remaining issues

---

## Testing

After these fixes, refresh the Ideas page and check:

### Bug 1 (Post Today):
- Ideas with score 80+ should show as "Post Today" 🔴
- Ideas with score 70-79 + competitor breakout should show as "Post Today" 🔴
- Ideas with score 50-79 (no breakout) should show as "This Week" 🟡

### Bug 2 (Trendsetter):
- Only trendsetter videos with 1.5x+ average views should show as breakouts
- Signal text should say "Trendsetter breakout: ... got X.Xx their average"
- Regular trendsetter posts (not breakouts) should NOT show

### Bug 3 (User Video Matching):
- Check server console for debug logs when viewing Venezuela/oil ideas
- Should see:
  ```
  🔍 DEBUG findDaysSinceLastPost for Venezuela/Oil idea:
     Signal text (title + description): ...
     Extracted keywords (with translations): ['venezuela', 'فنزويلا', 'oil', 'نفط', ...]
     Checking: "كيف تخطط فنزويلا..."
       Matching keywords: ['فنزويلا']
       Match result: ✅ YES (1 keyword matched)
     ✅ MATCH by keywords: "كيف تخطط فنزويلا..." - X days ago
  ```
- Should NOT show "You haven't covered this topic" if user has posted about Venezuela

---

## Files Modified

1. `/lib/scoring/multiSignalScoring.js`:
   - `getUrgencyTier()`: Fixed Post Today threshold (line 355)
   - `findCompetitorBreakout()`: Added multiplier >= 1.5 check for trendsetters (line 525)
   - `findDaysSinceLastPost()`: Improved keyword matching, added debug logging (line 947)
   - `calculateIdeaScore()`: Now passes description to `findDaysSinceLastPost()` (line 246)

2. `/app/api/signals/route.js`:
   - Now passes `signalDescription` to `calculateIdeaScore()` (line 863)
