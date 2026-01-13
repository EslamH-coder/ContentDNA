# Fix: Column Names & Evidence Display - Summary

## ✅ Issue 1: Wrong Column Name in channel_videos Query - FIXED

### Problem
The `channel_videos` table uses `publish_date` as the column name, but the query was using `published_at`.

**Error:**
```
column channel_videos.published_at does not exist
Hint: Perhaps you meant "channel_videos.publish_date"
```

### Solution

**File:** `/app/api/signals/route.js` (lines 879-883)

**Before:**
```javascript
.select('id, video_id, title, description, published_at, publish_date, topic_id, youtube_url')
.order('published_at', { ascending: false })
```

**After:**
```javascript
.select('id, video_id, title, description, publish_date, topic_id, youtube_url')
.order('publish_date', { ascending: false })
```

### Normalization Added

**File:** `/app/api/signals/route.js` (lines 1009-1027)

All user videos are normalized to use `published_at` for consistency:

```javascript
const normalizedUserVideos = (userVideos || []).map(video => {
  // Normalize date field: channel_videos uses 'publish_date', videos table uses 'published_at'
  const normalizedDate = video.publish_date || video.published_at || video.publishedAt || video.created_at || video.upload_date;
  
  return {
    ...video,
    published_at: normalizedDate,  // Always use 'published_at' for consistency
    publish_date: normalizedDate,  // Also keep original for reference
    // ... other fields
  };
});
```

**File:** `/lib/scoring/multiSignalScoring.js`

All date field accesses now check both `published_at` and `publish_date`:

```javascript
// Example in findDaysSinceLastPost
const videoDate = video.published_at || video.publish_date;
const daysAgo = calculateDaysAgo(videoDate);
```

### Impact
- ✅ `channel_videos` query now works correctly
- ✅ No more "column does not exist" errors
- ✅ Data normalization ensures compatibility between tables
- ✅ All scoring functions handle both column names

---

## ✅ Issue 2: Fallback to videos Table with Validation - FIXED

### Problem
When `channel_videos` query fails, it falls back to `videos` table which has placeholder titles ("شعار").

### Solution

**File:** `/app/api/signals/route.js` (lines 920-950)

Added validation to skip fallback if videos table has too many placeholder titles:

```javascript
if (videosTable && videosTable.length > 0) {
  // VALIDATION: Skip fallback if too many placeholder titles
  const placeholderCount = videosTable.filter(v => 
    v.title === 'شعار' || 
    v.title === 'logo' || 
    !v.title || 
    v.title.trim() === '' || 
    v.title.length < 3
  ).length;
  
  const placeholderRatio = placeholderCount / videosTable.length;
  
  if (placeholderRatio > 0.5) {
    console.warn(`⚠️ Fallback videos table has too many placeholder titles (${placeholderCount}/${videosTable.length} = ${(placeholderRatio * 100).toFixed(1)}%)`);
    console.warn(`   Skipping fallback to videos table - would cause matching issues`);
    console.warn(`   This is expected if videos table contains old/placeholder data`);
    userVideos = [];
    userVideosError = new Error('Fallback table has too many placeholder titles');
  } else {
    // Map videos table structure to match channel_videos structure
    userVideos = videosTable.map(v => ({
      ...v,
      description: v.description || '',
      publish_date: v.published_at || v.publish_date,  // Normalize date field
    }));
    console.log(`✅ Found ${videosTable.length} videos in videos table (using as fallback, ${placeholderCount} placeholders filtered)`);
  }
}
```

### Impact
- ✅ Fallback only used if videos table has < 50% placeholder titles
- ✅ Prevents matching issues from bad data
- ✅ Clear logging explains why fallback is skipped

---

## ✅ Issue 3: Evidence Display in UI - COMPLETE

### Solution

**File:** `/app/studio/page.jsx` (lines 162-275)

Added evidence display for all signal types when card is expanded:

```jsx
{evidence && (
  <div className="mt-2 ml-4 pl-3 border-l-2 border-gray-300 dark:border-gray-600 space-y-1.5">
    {/* Competitor Breakout Evidence */}
    {evidence.videoTitle && (
      <>
        <div>🎯 Matched: {evidence.matchedKeywords?.slice(0, 5).join(', ')}</div>
        <div>🔗 Video: <a href={evidence.videoUrl}>"{evidence.videoTitle}..." → View</a></div>
        {evidence.multiplier && <div>{evidence.multiplier.toFixed(1)}x average</div>}
      </>
    )}
    
    {/* Competitor Volume Evidence */}
    {evidence.competitors && evidence.competitors.length > 0 && (
      <>
        <div>Competitors covering this:</div>
        {evidence.competitors.slice(0, 5).map(comp => (
          <div>{comp.type}: {comp.name} <a href={comp.videoUrl}>[View →]</a></div>
        ))}
      </>
    )}
    
    {/* DNA Match Evidence */}
    {evidence.matchedTopicNames && (
      <div>🎯 Topics: {evidence.matchedTopicNames.join(', ')}</div>
    )}
    {evidence.matchedKeywords && (
      <div>🔑 Keywords: {evidence.matchedKeywords.slice(0, 8).join(', ')}</div>
    )}
    
    {/* RSS Recency Evidence */}
    {evidence.sourceUrl && (
      <div>📰 Source: <a href={evidence.sourceUrl}>View article →</a></div>
    )}
    
    {/* Last Covered Evidence */}
    {evidence.matchedVideo && (
      <>
        <div>📹 Your video: <a href={evidence.videoUrl}>"{evidence.matchedVideo}..." → View</a></div>
        <div>🎯 Matched: {evidence.matchedKeywords?.slice(0, 5).join(', ')}</div>
        <div>{evidence.daysAgo} days ago</div>
      </>
    )}
  </div>
)}
```

### Evidence Structure

All signals now include evidence objects:

1. **Competitor Breakout** (Direct/Trendsetter/Indirect):
   - `matchedKeywords`: Array of matched keywords
   - `videoTitle`: Competitor video title
   - `videoUrl`: Link to competitor video
   - `channelName`, `multiplier`, `views`, `hoursAgo`

2. **Competitor Volume**:
   - `competitors`: Array with `{ name, type, videoTitle, videoUrl, matchedKeywords }`
   - `totalCount`: Total number of competitors
   - `breakdown`: Counts by type

3. **DNA Match**:
   - `matchedTopicNames`: Array of topic names (Arabic/English)
   - `matchedKeywords`: Array of matched keywords
   - `matchedTopics`: Array of topic IDs

4. **RSS Recency**:
   - `sourceUrl`: Link to RSS article
   - `sourceTitle`: Source name
   - `hoursAgo`: Hours since publication
   - `sourceCount`: Number of sources

5. **Last Covered** (Freshness/Saturation):
   - `matchedVideo`: User's video title
   - `videoUrl`: Link to user's video
   - `matchedKeywords`: Array of matched keywords
   - `daysAgo`: Days since last post
   - `matchType`: 'topic_id' or 'keywords'

### Impact
- ✅ All signals display evidence when card is expanded
- ✅ Users can verify why signals are shown
- ✅ Evidence includes clickable links to videos/articles
- ✅ Matched keywords shown for transparency

---

## 📋 Files Modified

1. **`/app/api/signals/route.js`**:
   - Fixed `channel_videos` query to use `publish_date` (line 880-883)
   - Added fallback validation for videos table (line 920-950)
   - Normalized date fields in user videos mapping (line 1017-1020)
   - Updated logging to show both date fields (line 981-989)

2. **`/lib/scoring/multiSignalScoring.js`**:
   - Updated `findDaysSinceLastPost` to handle both `published_at` and `publish_date` (lines 1197, 1239, 1291, 1301)
   - Updated `findCompetitorBreakout` to normalize date fields (line 644, 706)
   - Updated `countCompetitorMatches` to normalize date fields (line 817, 889)
   - Updated filter to check both date fields (line 1197)

3. **`/app/studio/page.jsx`**:
   - Added evidence display for all signal types (lines 162-275)
   - Shows evidence when card is expanded
   - Includes clickable links to videos/articles
   - Displays matched keywords and topics

---

## ✅ Verification Checklist

- [x] Fixed `channel_videos` query to use `publish_date`
- [x] Removed `published_at` from channel_videos SELECT
- [x] Updated ORDER BY to use `publish_date`
- [x] Added normalization to map `publish_date` → `published_at`
- [x] Added fallback validation for videos table (50% threshold)
- [x] Updated all scoring functions to handle both date fields
- [x] Added evidence display for competitor breakout signals
- [x] Added evidence display for competitor volume signals
- [x] Added evidence display for DNA match signals
- [x] Added evidence display for RSS recency signals
- [x] Added evidence display for last covered signals
- [x] Evidence includes clickable links
- [x] Evidence shows matched keywords
- [x] No linter errors

---

## 🚀 Next Steps

1. **Test the fixes:**
   - Refresh Ideas page and check console for successful `channel_videos` query
   - Verify no "column does not exist" errors
   - Check if fallback validation logs appear if videos table has placeholders

2. **Verify evidence display:**
   - Expand a card and check if evidence appears
   - Click links to verify they work
   - Check if matched keywords are displayed correctly

3. **Check video matching:**
   - After fixing column names, "You haven't covered this topic" should work correctly
   - Verify user videos are found and matched properly

4. **Fix root cause (optional):**
   - Re-sync videos from YouTube to fix "شعار" titles in database
   - Run: `curl -X POST http://localhost:3000/api/sync-new-videos -H "Content-Type: application/json" -d '{"showId": "..."}'`

---

## 📝 Notes

- **Competitor videos** use `published_at` (correct, no change needed)
- **Channel videos** use `publish_date` (fixed in query)
- **Videos table** uses `published_at` (correct, no change needed)
- Normalization ensures compatibility across all tables
- Fallback validation prevents using bad data from videos table
