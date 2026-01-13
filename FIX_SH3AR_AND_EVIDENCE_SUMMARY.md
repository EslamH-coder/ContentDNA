# Fix: "شعار" Filter & Evidence Addition - Summary

## ✅ Issue 1: Filter Out "شعار" Videos - FIXED

### Problem
Recent videos (Dec 27) have title "شعار" instead of real titles, causing matching to fail.

### Solution
Added filter in `findDaysSinceLastPost()` to skip videos with placeholder titles **BEFORE** processing:

```javascript
// Lines 1191-1201 in /lib/scoring/multiSignalScoring.js
const validUserVideos = (userVideos || []).filter(v => {
  // Skip placeholder/empty titles
  if (!v.title || v.title.trim() === '' || v.title === 'شعار' || v.title === 'logo' || v.title.length < 3) {
    return false;
  }
  // Must have published_at for date calculation
  if (!v.published_at) {
    return false;
  }
  return true;
});
```

### Impact
- Videos with title "شعار" are now **filtered out** before matching
- Only videos with real titles are checked for keyword/topic matching
- Console logs show: `Filtered out X videos with placeholder titles ("شعار" or empty)`

### Next Steps
1. **Run SQL to verify pattern:**
   ```sql
   SELECT title, youtube_video_id, published_at, 
          CASE WHEN title = 'شعار' THEN 'BAD' ELSE 'GOOD' END as status
   FROM channel_videos 
   WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'
   ORDER BY published_at DESC
   LIMIT 20;
   ```

2. **Check if "شعار" videos are:**
   - YouTube Shorts?
   - Community posts?
   - Premieres?
   - Missing data from sync job?

3. **Re-sync videos from YouTube** (fix root cause):
   ```bash
   curl -X POST http://localhost:3000/api/sync-new-videos \
     -H "Content-Type: application/json" \
     -d '{"showId": "a7982c70-2b0e-46af-a0ad-c78f4f69cd56"}'
   ```

---

## ✅ Issue 2: Add Evidence to All Signals - COMPLETE

### Signal Types with Evidence

#### 1. ✅ Competitor Breakout (Direct/Trendsetter/Indirect)
**Location:** Lines 42-111 in `multiSignalScoring.js`

```javascript
evidence: {
  matchedKeywords: ['oil', 'venezuela', 'نفط'],
  videoTitle: 'أميركا تعلن مصادرة ناقلة النفط...',
  videoUrl: 'https://youtube.com/watch?v=abc123',
  channelName: 'العربية',
  channelId: 'UC...',
  multiplier: 2.2,
  views: 150000,
  averageViews: 68000,
  hoursAgo: 18,
}
```

#### 2. ✅ Competitor Volume (Multiple/Direct/Mixed/Trendsetter/Indirect/Single)
**Location:** Lines 126-249 in `multiSignalScoring.js`

```javascript
evidence: {
  competitors: [
    {
      name: 'المخبر',
      type: 'direct',
      videoTitle: '...',
      videoUrl: 'https://youtube.com/watch?v=...',
      matchedKeywords: ['oil', 'venezuela']
    },
    // ... more competitors
  ],
  totalCount: 9,
  breakdown: { direct: 2, indirect: 4, trendsetter: 3 }
}
```

#### 3. ✅ DNA Match
**Location:** Lines 257-295 in `multiSignalScoring.js`

```javascript
evidence: {
  matchedTopics: ['energy_oil_gas_lng', 'geopolitics'],
  matchedTopicNames: ['طاقة / نفط / غاز', 'الجيوسياسة'],  // ✅ Added
  matchedKeywords: ['oil', 'نفط', 'petroleum', 'فنزويلا']
}
```

#### 4. ✅ RSS Recency (Trending/Recent)
**Location:** Lines 297-332 in `multiSignalScoring.js`

```javascript
evidence: {
  sourceUrl: 'https://rss.example.com/article/123',  // ✅ Added
  sourceTitle: 'Reuters',  // ✅ Added
  hoursAgo: 12,
  sourceCount: 5,
  daysAgo: 3  // For recent signals
}
```

#### 5. ✅ Last Covered (Freshness)
**Location:** Lines 334-362 in `multiSignalScoring.js`

```javascript
evidence: {
  matchedVideo: 'هل يغزو ترامب فنزويلا؟',
  matchedKeywords: ['فنزويلا', 'ترامب', 'oil'],
  videoUrl: 'https://youtube.com/watch?v=xyz789',
  daysAgo: 45,
  matchType: 'keywords'  // or 'topic_id'
}
```

#### 6. ✅ Saturation Penalty
**Location:** Lines 364-375 in `multiSignalScoring.js`

```javascript
evidence: {
  matchedVideo: '...',
  matchedKeywords: ['...'],
  videoUrl: '...',
  daysAgo: 7,
  matchType: 'keywords'
}
```

#### 7. ✅ Trendsetter Volume
**Location:** Lines 137-151 in `multiSignalScoring.js`

```javascript
evidence: {
  competitors: [...],  // ✅ Added
  totalCount: 3
}
```

#### 8. ✅ Competitor Single
**Location:** Lines 239-249 in `multiSignalScoring.js`

```javascript
evidence: {
  competitor: {
    name: 'العربية',
    type: 'trendsetter',
    videoTitle: '...',
    videoUrl: '...',
    matchedKeywords: ['...']
  },
  totalCount: 1
}  // ✅ Added
```

---

## 📊 Evidence Structure Summary

### All Signals Now Include:

| Signal Type | Evidence Fields | Status |
|------------|----------------|--------|
| Competitor Breakout | `matchedKeywords`, `videoTitle`, `videoUrl`, `channelName`, `multiplier`, `views`, `hoursAgo` | ✅ Complete |
| Competitor Volume | `competitors[]`, `totalCount`, `breakdown` | ✅ Complete |
| DNA Match | `matchedTopics`, `matchedTopicNames`, `matchedKeywords` | ✅ Complete (added topic names) |
| RSS Recency | `sourceUrl`, `sourceTitle`, `hoursAgo`, `sourceCount` | ✅ Complete (added URL/title) |
| Last Covered | `matchedVideo`, `matchedKeywords`, `videoUrl`, `daysAgo`, `matchType` | ✅ Complete |
| Saturation | `matchedVideo`, `matchedKeywords`, `videoUrl`, `daysAgo` | ✅ Complete |
| Trendsetter Volume | `competitors[]`, `totalCount` | ✅ Complete |
| Competitor Single | `competitor`, `totalCount` | ✅ Complete |

---

## 🔧 Code Changes Made

### 1. Filter "شعار" Videos
**File:** `/lib/scoring/multiSignalScoring.js`
- Added filter at line 1191 to skip videos with placeholder titles
- Filter applied **before** matching loop
- Logs filtered count for debugging

### 2. Add Source URL/Title to Context
**File:** `/app/api/signals/route.js` (line 1057-1058)
```javascript
const sourceUrl = signal.url || signal.raw_data?.url || signal.raw_data?.link || null;
const sourceTitle = signal.raw_data?.sourceName || signal.source || signal.raw_data?.source_name || null;
```

**File:** `/lib/scoring/multiSignalScoring.js` (line 25-27)
```javascript
sourceUrl = idea.url || idea.source_url || null,
sourceTitle = idea.source || idea.source_name || null,
sourceCount = idea.source_count || 1,
```

### 3. Add Evidence to RSS Recency Signal
**File:** `/lib/scoring/multiSignalScoring.js` (lines 297-332)
- Added `sourceUrl` and `sourceTitle` to evidence object

### 4. Add Topic Names to DNA Match Evidence
**File:** `/lib/scoring/multiSignalScoring.js` (lines 257-295)
- Extracts `topic_name_ar` or `topic_name_en` from matched topics
- Includes in evidence as `matchedTopicNames`

### 5. Add Evidence to Single Competitor Signal
**File:** `/lib/scoring/multiSignalScoring.js` (lines 239-249)
- Finds single competitor details
- Includes in evidence object

### 6. Add Evidence to Trendsetter Volume Signal
**File:** `/lib/scoring/multiSignalScoring.js` (lines 137-151)
- Includes competitor list in evidence

---

## 📋 UI Display (Future Implementation)

Each signal's evidence can now be displayed in the UI when expanded:

```jsx
{expanded && signal.evidence && (
  <div className="mt-3 p-3 bg-white/50 rounded-lg border">
    {/* Competitor Breakout */}
    {signal.type === 'competitor_breakout_trendsetter' && (
      <div>
        <p className="text-sm font-medium mb-2">Evidence:</p>
        <p>🎯 Matched: {signal.evidence.matchedKeywords.join(', ')}</p>
        <p>🔗 "{signal.evidence.videoTitle}"</p>
        <a href={signal.evidence.videoUrl} target="_blank">View →</a>
      </div>
    )}
    
    {/* Competitor Volume */}
    {signal.type === 'competitor_volume_mixed' && (
      <div>
        <p className="text-sm font-medium mb-2">Competitors:</p>
        {signal.evidence.competitors.slice(0, 5).map((c, i) => (
          <div key={i}>
            {c.type}: {c.name} <a href={c.videoUrl}>[View →]</a>
          </div>
        ))}
      </div>
    )}
    
    {/* DNA Match */}
    {signal.type === 'dna_match' && (
      <div>
        <p>🎯 Topics: {signal.evidence.matchedTopicNames.join(', ')}</p>
        <p>🔑 Keywords: {signal.evidence.matchedKeywords.join(', ')}</p>
      </div>
    )}
    
    {/* Last Covered */}
    {signal.type === 'freshness' && signal.evidence && (
      <div>
        <p>📹 "{signal.evidence.matchedVideo}"</p>
        <p>🎯 {signal.evidence.matchedKeywords.join(', ')}</p>
        <a href={signal.evidence.videoUrl}>View →</a>
      </div>
    )}
  </div>
)}
```

---

## ✅ Verification Checklist

- [x] Filter "شعار" videos BEFORE matching loop
- [x] All competitor breakout signals have evidence
- [x] All competitor volume signals have evidence
- [x] DNA match signal has topic names in evidence
- [x] RSS recency signal has sourceUrl/sourceTitle
- [x] Last covered signal has full evidence
- [x] Single competitor signal has evidence
- [x] Trendsetter volume signal has evidence
- [x] Source URL/Title passed to calculateIdeaScore context
- [x] No linter errors

---

## 🚀 Next Steps

1. **Test the filter:** Refresh Ideas page and check console for "Filtered out X videos with placeholder titles"
2. **Verify evidence:** Check signal objects in API response - all should have `evidence` field
3. **Update UI:** Display evidence in expanded cards (see UI Display section above)
4. **Fix root cause:** Re-sync videos from YouTube to fix "شعار" titles in database
