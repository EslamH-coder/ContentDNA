# Debug: "You haven't covered this topic" Bug

## Problem
All cards showing "You haven't covered this topic" even when user has covered it.

## User's Venezuela Videos
- "كيف تخطط فنزويلا لتوريط أمريكا في حرب عصابات طويلة؟"
- "هل يغزو ترامب فنزويلا؟"  
- "كيف خطفت أمريكا حليف الصين المهم في أقل من ثلاث ساعات؟"

## Debug Logging Added

### 1. User Videos Count Check
**Location**: `/lib/scoring/multiSignalScoring.js` line 968-970

```javascript
console.log('🔍 DEBUG findDaysSinceLastPost - START');
console.log('   User videos count:', userVideos?.length || 0);
console.log('   User videos is array?', Array.isArray(userVideos));
```

### 2. API Query Logging
**Location**: `/app/api/signals/route.js` line 753-774

```javascript
console.log(`📹 Fetching user videos for show_id: ${showId}`);
console.log(`📹 User videos query result: ${userVideos?.length || 0} videos`);
console.log(`📹 Sample user video structure:`, {
  hasTitle: !!userVideos[0].title,
  hasDescription: !!userVideos[0].description,
  hasPublishedAt: !!userVideos[0].published_at,
  hasTopicId: !!userVideos[0].topic_id,
  sampleTitle: userVideos[0].title?.substring(0, 60),
  sampleDescription: userVideos[0].description?.substring(0, 60),
});
```

### 3. Venezuela Idea Detailed Logging
**Location**: `/lib/scoring/multiSignalScoring.js` line 980-1034

For Venezuela/oil ideas, logs:
- Signal text (title + description, first 200 chars)
- Signal topic ID
- User videos available count
- Sample user video structure
- Extracted signal keywords (with translations, first 30)
- For each of the first 5 videos:
  - Title and description
  - Published date and topic ID
  - Title keywords extracted
  - Description keywords extracted
  - Total video keywords
  - Signal keywords sample
  - Matching keywords found
  - Match result (YES/NO)

### 4. Summary Logging
**Location**: `/lib/scoring/multiSignalScoring.js` line 1102-1140

For ALL calls (not just Venezuela):
- Total matches found (breakdown by topic_id vs keywords)
- Most recent match (days ago or "never posted")
- If no matches found:
  - Signal keywords (first 15)
  - Signal topic ID
  - User videos topic IDs (unique)
  - Sample user video keywords (first 3 videos)
  - Overlapping keywords between signal and each video

For Venezuela ideas specifically:
- Final result summary
- All matched videos with details
- Detailed analysis if no matches

## Expected Console Output

When you refresh the Ideas page, you should see:

```
🔍 DEBUG findDaysSinceLastPost - START
   User videos count: 100
   User videos is array? true
   Signal text (title + description): US seizes Russian-flagged tanker... (Venezuela oil crisis)
   Signal topic ID: abc123
   User videos available: 100
   Sample user video structure: {
     hasTitle: true,
     hasDescription: true,
     hasPublishedAt: true,
     hasTopicId: false,
     sampleTitle: "كيف تخطط فنزويلا لتوريط أمريكا...",
     sampleDescription: "..."
   }
   Extracted signal keywords (with translations): ['us', 'seizes', 'russian', 'tanker', 'venezuela', 'فنزويلا', 'oil', 'نفط', ...]
   Total signal keywords: 45

   📹 Checking 100 user videos for matches...

   📹 Video 1/100:
     Title: "كيف تخطط فنزويلا لتوريط أمريكا في حرب عصابات طويلة؟"
     Description: "..."
     Published at: 2024-01-15T10:00:00Z
     Topic ID: N/A
     Signal Topic ID: abc123
     Title keywords (15): ['كيف', 'تخطط', 'فنزويلا', 'توريط', 'أمريكا', ...]
     Description keywords (12): ['حرب', 'عصابات', 'طويلة', ...]
     Total video keywords (25): ['كيف', 'تخطط', 'فنزويلا', 'توريط', 'أمريكا', ...]
     Signal keywords (sample): ['us', 'seizes', 'russian', 'tanker', 'venezuela', 'فنزويلا', ...]
     Matching keywords found: ['فنزويلا', 'venezuela']
     Match result: ✅ YES (2 keywords matched, need >= 1)
     Days ago: 45
     ✅ MATCH by keywords: "كيف تخطط فنزويلا..." - 45 days ago (matched: فنزويلا, venezuela)

   📊 findDaysSinceLastPost summary:
     Signal text (first 100 chars): "US seizes Russian-flagged tanker... (Venezuela oil)"
     Total user videos checked: 100
     Total matches found: 3 (0 by topic_id, 3 by keywords)
     Most recent match: ✅ 15 days ago

   🔍 Venezuela/Oil Idea - Detailed Results:
     Final result: ✅ 15 days ago
     Matched videos: 3
     ✅ Matched videos:
       1. "كيف خطفت أمريكا حليف الصين المهم..."
          Days ago: 15, Match type: keywords, Keywords: فنزويلا, venezuela, ...
       2. "هل يغزو ترامب فنزويلا؟"
          Days ago: 30, Match type: keywords, Keywords: فنزويلا, venezuela, trump, ترامب
       3. "كيف تخطط فنزويلا..."
          Days ago: 45, Match type: keywords, Keywords: فنزويلا, venezuela
```

## What to Check in Console

1. **User videos count**: Should be > 0 (if 0, query is failing)
2. **Description field**: Should show `hasDescription: true` (if false, channel_videos doesn't have description)
3. **Signal keywords**: Should include "فنزويلا", "venezuela", "oil", "نفط" for Venezuela ideas
4. **Video keywords**: Should extract "فنزويلا" from user video titles
5. **Matching keywords**: Should show overlap between signal and video keywords
6. **Match result**: Should show "✅ YES" if keywords match

## Potential Issues to Look For

1. **No user videos returned**: Query filtering by wrong `show_id`
2. **No description field**: `channel_videos` table missing `description` column
3. **Keywords don't match**: Bilingual expansion not working (e.g., "venezuela" not expanding to "فنزويلا")
4. **Topic ID mismatch**: Signal has topic_id but videos don't (or different topic_ids)
5. **Normalization issue**: Arabic text normalization breaking matching
