# Competitor Videos Description - Analysis & Implementation Guide

## Answer to Question 1: Where is the competitor video fetching job?

### File Path
**`/app/api/competitors/sync/route.js`**

### Key Functions:

1. **`POST` handler** (line 14): Main entry point for syncing competitor videos
   - Called from `/intelligence` page when user clicks "Sync" button
   - Endpoint: `POST /api/competitors/sync`

2. **`fetchYouTubeVideos(channelId, maxResults)`** (line 368): Fetches videos from YouTube API
   - Step 1: Gets channel details to find uploads playlist (line 373-397)
   - Step 2: Gets video IDs from playlist (line 402-446)
   - Step 3: Gets video details (line 454-494) ← **DESCRIPTION IS FETCHED HERE**

3. **Database Save Logic** (line 138-211): Saves/updates videos to `competitor_videos` table
   - Line 161-172: Updates existing video
   - Line 182-198: Inserts new video

### Does it fetch description but not save it?

**YES! ✅**

Looking at the code:

**Line 464**: YouTube API request includes `snippet` part:
```javascript
const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${batch.join(',')}&key=${YOUTUBE_API_KEY}`;
```

**Line 483-492**: Video data is mapped, but `description` is NOT extracted:
```javascript
for (const video of videosData.items) {
  videos.push({
    id: video.id,
    title: video.snippet?.title || '',
    publishedAt: video.snippet?.publishedAt || null,
    views: parseInt(video.statistics?.viewCount || '0'),
    likes: parseInt(video.statistics?.likeCount || '0'),
    commentCount: parseInt(video.statistics?.commentCount || '0'),
    duration: video.contentDetails?.duration || 'PT0S',
    // ❌ MISSING: description: video.snippet?.description || ''
  });
}
```

**Line 151**: Comment confirms description is not used:
```javascript
const { topicId, confidence, matchedKeywords } = await detectTopic(
  video.title,
  '',  // YouTube videos don't have description in our data
  competitor.show_id
);
```

**Line 164 & 187**: Database save operations do NOT include description:
```javascript
// Update (line 164)
.update({
  title: video.title,
  published_at: video.publishedAt,
  views: video.views || 0,
  likes: video.likes || 0,
  comments: video.commentCount || 0,
  duration_seconds: parseDuration(video.duration),
  detected_topic: topicId,
  // ❌ MISSING: description: ...
})

// Insert (line 187)
.insert({
  competitor_id: competitorId,
  youtube_video_id: video.id,
  title: video.title,
  published_at: video.publishedAt,
  views: video.views || 0,
  likes: video.likes || 0,
  comments: video.commentCount || 0,
  duration_seconds: parseDuration(video.duration),
  detected_topic: topicId,
  // ❌ MISSING: description: ...
})
```

---

## Answer to Question 2: How hard is it to add description?

### Difficulty: **EASY** ✅ (Low effort, straightforward)

### Steps Required:

#### 1. Add `description` column to `competitor_videos` table

**File**: Create migration `/migrations/add_competitor_videos_description.sql`

```sql
-- Add description column to competitor_videos table
ALTER TABLE competitor_videos
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add index for full-text search (optional, but recommended)
CREATE INDEX IF NOT EXISTS idx_competitor_videos_description_search 
ON competitor_videos USING gin(to_tsvector('english', description));
```

**Complexity**: ⭐ (Very Easy)
- Just one `ALTER TABLE` command
- No data migration needed (existing rows will have `NULL`)

#### 2. Update `fetchYouTubeVideos` to extract description

**File**: `/app/api/competitors/sync/route.js` (line 483-492)

**Change**:
```javascript
// BEFORE (line 483-492)
for (const video of videosData.items) {
  videos.push({
    id: video.id,
    title: video.snippet?.title || '',
    publishedAt: video.snippet?.publishedAt || null,
    views: parseInt(video.statistics?.viewCount || '0'),
    likes: parseInt(video.statistics?.likeCount || '0'),
    commentCount: parseInt(video.statistics?.commentCount || '0'),
    duration: video.contentDetails?.duration || 'PT0S',
  });
}

// AFTER
for (const video of videosData.items) {
  // Extract description and truncate to 500 chars
  const fullDescription = video.snippet?.description || '';
  const description = fullDescription.substring(0, 500);
  
  videos.push({
    id: video.id,
    title: video.snippet?.title || '',
    description: description, // ✅ ADD THIS
    publishedAt: video.snippet?.publishedAt || null,
    views: parseInt(video.statistics?.viewCount || '0'),
    likes: parseInt(video.statistics?.likeCount || '0'),
    commentCount: parseInt(video.statistics?.commentCount || '0'),
    duration: video.contentDetails?.duration || 'PT0S',
  });
}
```

**Complexity**: ⭐ (Very Easy)
- Just extract from `video.snippet.description`
- Truncate to 500 chars with `.substring(0, 500)`

#### 3. Update database INSERT to include description

**File**: `/app/api/competitors/sync/route.js` (line 182-198)

**Change**:
```javascript
// BEFORE (line 182-198)
.insert({
  competitor_id: competitorId,
  youtube_video_id: video.id,
  title: video.title,
  published_at: video.publishedAt,
  views: video.views || 0,
  likes: video.likes || 0,
  comments: video.commentCount || 0,
  duration_seconds: parseDuration(video.duration),
  detected_topic: topicId,
  relevance_score: 0,
  performance_ratio: 0,
  is_success: false,
  is_failure: false
});

// AFTER
.insert({
  competitor_id: competitorId,
  youtube_video_id: video.id,
  title: video.title,
  description: video.description || null, // ✅ ADD THIS
  published_at: video.publishedAt,
  views: video.views || 0,
  likes: video.likes || 0,
  comments: video.commentCount || 0,
  duration_seconds: parseDuration(video.duration),
  detected_topic: topicId,
  relevance_score: 0,
  performance_ratio: 0,
  is_success: false,
  is_failure: false
});
```

**Complexity**: ⭐ (Very Easy)
- Just add one field to the insert object

#### 4. Update database UPDATE to include description

**File**: `/app/api/competitors/sync/route.js` (line 161-172)

**Change**:
```javascript
// BEFORE (line 161-172)
.update({
  title: video.title,
  published_at: video.publishedAt,
  views: video.views || 0,
  likes: video.likes || 0,
  comments: video.commentCount || 0,
  duration_seconds: parseDuration(video.duration),
  detected_topic: topicId,
});

// AFTER
.update({
  title: video.title,
  description: video.description || null, // ✅ ADD THIS
  published_at: video.publishedAt,
  views: video.views || 0,
  likes: video.likes || 0,
  comments: video.commentCount || 0,
  duration_seconds: parseDuration(video.duration),
  detected_topic: topicId,
});
```

**Complexity**: ⭐ (Very Easy)
- Just add one field to the update object

#### 5. Update `detectTopic` call to use description

**File**: `/app/api/competitors/sync/route.js` (line 149-153)

**Change**:
```javascript
// BEFORE (line 149-153)
const { topicId, confidence, matchedKeywords } = await detectTopic(
  video.title,
  '',  // YouTube videos don't have description in our data
  competitor.show_id
);

// AFTER
const { topicId, confidence, matchedKeywords } = await detectTopic(
  video.title,
  video.description || '', // ✅ USE ACTUAL DESCRIPTION
  competitor.show_id
);
```

**Complexity**: ⭐ (Very Easy)
- Just pass `video.description` instead of empty string

---

## Summary

### Total Effort: **~15 minutes** ⏱️

### Files to Modify:
1. ✅ Create migration: `/migrations/add_competitor_videos_description.sql` (1 SQL command)
2. ✅ Update `/app/api/competitors/sync/route.js` (4 small changes):
   - Extract description from API response (line 483-492)
   - Add to INSERT (line 187)
   - Add to UPDATE (line 164)
   - Pass to detectTopic (line 151)

### Benefits:
- ✅ Better topic detection (description has more keywords than title)
- ✅ Better keyword matching in Ideas feature (can match against description)
- ✅ More context for AI pitch generation
- ✅ Better search/filtering capabilities

### Risk: **LOW** 🟢
- All changes are additive (no breaking changes)
- Existing videos will have `NULL` description (handled gracefully)
- YouTube API already returns description (no extra API calls needed)

---

## Implementation Checklist

- [ ] Run migration to add `description` column
- [ ] Update `fetchYouTubeVideos` to extract description (truncate to 500 chars)
- [ ] Update INSERT query to include description
- [ ] Update UPDATE query to include description
- [ ] Update `detectTopic` call to use description
- [ ] Test by syncing a competitor and verifying description is saved
- [ ] Verify description appears in `/app/api/signals/route.js` when fetching competitor videos
