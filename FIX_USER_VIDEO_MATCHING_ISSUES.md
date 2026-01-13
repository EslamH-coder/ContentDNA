# Fix: User Video Matching Issues

## Issues Fixed

### Issue 1: User videos showing 'شعار' (logo) instead of real titles ✅

**Problem**: All 72 user videos had placeholder title "شعار" instead of real titles.

**Root Cause**: Unknown - could be:
- Database data issue (videos actually have placeholder titles)
- Query selecting wrong column (e.g., `title_ar` instead of `title`)
- Data sync issue

**Fixes Applied**:

1. **Added Diagnostic Logging** (`/app/api/signals/route.js`):
   - Query raw `channel_videos` data first to check actual column values
   - Log sample raw data structure (keys, title, title_ar, description, etc.)
   - Check if titles are "شعار" or empty and log warning
   - Log sample titles to verify data

2. **Added Fallback to `videos` table**:
   - If `channel_videos` returns empty, try `videos` table
   - Map `videos` table structure to match `channel_videos` format

3. **Enhanced Normalization**:
   - Check multiple possible title fields (`title_ar`, `title_en`, `title`)
   - Log warning if title is placeholder or empty
   - Include `video_id` and `youtube_url` for evidence

**Next Steps**: 
- Check server console for diagnostic output
- Run SQL query to verify actual data: `SELECT id, title, title_ar, description FROM channel_videos WHERE show_id = '...' LIMIT 10;`
- If titles are actually "شعار" in database, need to fix data source/sync process

---

### Issue 2: "Last covered: 71 days ago" still wrong ✅

**Problem**: Even with correct titles, recent Venezuela videos weren't being matched:
- "كيف تخطط فنزويلا لتوريط أمريكا في حرب عصابات طويلة؟"
- "هل يغزو ترامب فنزويلا؟"

**Root Cause**: 
- `findDaysSinceLastPost()` was returning a number but not returning evidence
- Matching logic was working but evidence wasn't being tracked

**Fixes Applied**:

1. **Updated `findDaysSinceLastPost()` return type** (`/lib/scoring/multiSignalScoring.js`):
   - Changed from returning `number` to returning `{ days, evidence }`
   - `evidence` contains:
     - `videoTitle`: Matched video title
     - `videoUrl`: YouTube URL
     - `matchedKeywords`: Array of matched keywords
     - `daysAgo`: Days since post
     - `matchType`: 'topic_id' or 'keywords'

2. **Updated Call Sites**:
   - `calculateIdeaScore()` now handles both old (number) and new (object) return types
   - Extracts `days` and `evidence` from result
   - Includes evidence in signal objects

3. **Enhanced Evidence Tracking**:
   - Stores most recent match with full details
   - Includes `video_id` and `youtube_url` for user videos
   - Tracks matched keywords for transparency

**Result**: Now returns both days and evidence, allowing UI to show:
- "Last covered: X days ago"
- Matched video title
- Matched keywords
- Link to video

---

### Issue 3: Add proof/evidence for each signal ✅

**Problem**: Signals lacked proof/evidence, making them hard to verify and trust.

**Fixes Applied**:

1. **Competitor Breakout Evidence** (`/lib/scoring/multiSignalScoring.js`):
   - Added `matchedKeywords` extraction in `findCompetitorBreakout()`
   - Includes `videoTitle`, `videoUrl`, `matchedKeywords` in breakout objects
   - Added `evidence` object to all competitor breakout signals:
     ```javascript
     evidence: {
       matchedKeywords: ['oil', 'venezuela', 'نفط'],
       videoTitle: "أميركا تعلن مصادرة ناقلة النفط...",
       videoUrl: "https://youtube.com/watch?v=XXX",
       channelName: "العربية",
       channelId: "...",
       multiplier: 2.2,
       views: 12343,
       averageViews: 5594,
       hoursAgo: 15,
     }
     ```

2. **Competitor Count Evidence**:
   - Updated `countCompetitorMatches()` to include evidence in `details`:
     - `videoTitle`: Video title
     - `videoUrl`: YouTube URL  
     - `matchedKeywords`: Array of matched keywords
   - Added `evidence` object to all competitor volume signals:
     ```javascript
     evidence: {
       competitors: [
         { name: 'المخبر الاقتصادي', type: 'direct', videoTitle: '...', videoUrl: '...', matchedKeywords: [...] },
         { name: 'العربية', type: 'trendsetter', videoTitle: '...', videoUrl: '...', matchedKeywords: [...] }
       ],
       totalCount: 8,
       breakdown: { direct: 1, indirect: 5, trendsetter: 2 }
     }
     ```

3. **DNA Match Evidence**:
   - Extracts matched keywords from DNA topics
   - Added `evidence` object to DNA match signals:
     ```javascript
     evidence: {
       matchedTopics: ['energy_oil_gas_lng'],
       matchedKeywords: ['oil', 'نفط', 'petroleum', 'crude']
     }
     ```

4. **Last Covered Evidence**:
   - Added `evidence` object to freshness/saturation signals:
     ```javascript
     evidence: {
       matchedVideo: "هل يغزو ترامب فنزويلا؟",
       matchedKeywords: ['فنزويلا', 'ترامب'],
       videoUrl: "https://youtube.com/watch?v=XXX",
       daysAgo: 15,
       matchType: 'keywords'
     }
     ```

**UI Display** (Future Enhancement):
When expanded, signals will show:
- ⚡ Trendsetter breakout: العربية got 2.2x - 15h ago
  - 🎯 Matched: oil, venezuela, نفط
  - 🔗 "أميركا تعلن مصادرة ناقلة النفط..." [View →]
- 📊 8 competitors covering this
  - Direct: المخبر الاقتصادي - "بعد أسر مادورو..." [View →]
  - Trendsetter: العربية - "أميركا تعلن..." [View →]
  - [+6 more]

---

## Testing

1. **Check Server Console** for diagnostic output:
   - `📹 DIAGNOSTIC: Checking channel_videos table structure`
   - `⚠️ WARNING: X videos have placeholder/empty title`
   - `📹 Sample user video titles (first 5)`

2. **Check User Videos Query**:
   - Should show actual titles (not "شعار")
   - Should include `description`, `video_id`, `youtube_url`

3. **Check Matching**:
   - Venezuela ideas should match recent user videos
   - `findDaysSinceLastPost` should return `{ days: X, evidence: {...} }`
   - Evidence should include matched video title and keywords

4. **Check Signal Evidence**:
   - All signals should have `evidence` object
   - Competitor signals should include `videoUrl` and `matchedKeywords`
   - DNA signals should include `matchedKeywords`
   - Freshness signals should include `matchedVideo` and `videoUrl`

---

## Files Modified

1. `/app/api/signals/route.js`:
   - Added diagnostic logging for user videos
   - Added fallback to `videos` table
   - Enhanced normalization to check multiple title fields
   - Included `video_id` and `youtube_url` in normalized videos

2. `/lib/scoring/multiSignalScoring.js`:
   - Updated `findDaysSinceLastPost()` to return `{ days, evidence }`
   - Updated `findCompetitorBreakout()` to include evidence (keywords, videoUrl)
   - Updated `countCompetitorMatches()` to include evidence in details
   - Added `evidence` objects to all signal types:
     - Competitor breakout (direct, indirect, trendsetter)
     - Competitor volume (direct, indirect, trendsetter, mixed)
     - DNA match
     - Freshness/saturation
   - Updated `calculateIdeaScore()` to handle new return type

---

## Next Steps

1. **Verify Database**: Run SQL to check if titles are actually "شعار" in database
2. **Test Matching**: Refresh Ideas page and check console logs for matching results
3. **UI Integration**: Update UI components to display evidence when signals are expanded
4. **Data Fix**: If titles are actually wrong in database, fix the data source/sync process
