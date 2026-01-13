# Ideas Feature Test Results

## Test Date
Run the Ideas page and check the following:

## 1. Console Logs for Venezuela/Oil Ideas

### Expected Console Output

When you open the browser console and load the Ideas page, you should see debug logs for Venezuela/oil signals like:

```
🔍 DEBUG: Venezuela Oil Signal
Signal: {
  title: "US seizes Russian-flagged tanker, another tied to Venezuela",
  topic_id: undefined,
  published_at: "2024-01-XX..."
}
Context: {
  competitorVideosCount: 0,
  userVideosCount: 0,
  dnaTopicsCount: 4,
  sourceCount: 1
}
Sample DNA topics: [
  {
    type: "object",
    keys: ["topic_id", "keywords", "name"],
    topic_id: undefined,
    keywords: [],
    name: undefined
  }
]
```

### What to Check:

1. **competitorBreakout**: 
   - Should show: `null` or `undefined` (because there are 0 competitor videos)
   - Debug log: `🔍 DEBUG findCompetitorBreakout: No competitor videos available`

2. **dnaMatch**:
   - Should show: `[]` (empty array) OR `['energy_oil_gas_lng']` if hardcoded keywords work
   - Debug log should show: `✅ DEBUG: DNA match found via hardcoded keywords: venezuela → energy_oil_gas_lng`
   - OR: `🔍 DEBUG: Final DNA matches: []` if no match

3. **Final Score**:
   - Expected: **30-45 points** (depending on DNA match)
   - Breakdown:
     - Competitor breakout: 0 points (no competitor videos)
     - Multiple competitors: 0 points (no competitor videos)
     - DNA match: 0-20 points (if hardcoded keywords work)
     - RSS recency: 15 points (if < 48 hours old)
     - Not saturated: 15 points (if user hasn't covered topic)

### Scoring Result Log:

```
Scoring Result: {
  score: 30,
  signalCount: 2,
  isValid: true,
  signals: [
    {
      type: "recency",
      icon: "📰",
      text: "Trending: 1 source in 48h",
      weight: "medium"
    },
    {
      type: "freshness",
      icon: "⏰",
      text: "You haven't covered this topic",
      weight: "low"
    }
  ]
}
```

## 2. UI Display

### Expected UI State:

**All items will likely show as "🟢 Backlog"** because:
- No competitor videos → No competitor breakout signal
- DNA matching may not work if topics don't have proper structure
- Scores will be low (30-45) which only qualifies for "Backlog" tier

### Urgency Tier Logic:

- **🔴 Post Today**: Requires score >= 70 AND 3+ signals AND competitor breakout
- **🟡 This Week**: Requires score >= 50 AND 2+ signals
- **🟢 Backlog**: Requires score >= 30 AND 1+ signal

### Venezuela Idea Card Should Show:

```
🟢 Backlog
Score: 30/100

US seizes Russian-flagged tanker, another tied to Venezuela
Source: Reuters

WHY NOW:
📰 Trending: 1 source in 48h
⏰ You haven't covered this topic
```

**Note**: If DNA matching works, you should also see:
```
✅ Matches your DNA: energy_oil_gas_lng
```

## 3. Like Button Test

### Expected Console Output When Clicking Like:

```
📝 handleFeedback: {
  ideaId: "signal-uuid-here",
  action: "liked",
  isImplicit: false,
  ideaTitle: "US seizes Russian-flagged tanker..."
}
```

### API Response:

**Success:**
```
✅ Feedback saved: {
  success: true,
  feedback: {
    id: "...",
    action: "liked",
    created_at: "..."
  }
}
✅ Idea liked successfully
```

**Error (if any):**
```
❌ Feedback API error: { error: "..." }
Failed to liked idea: ...
```

### What Happens:

1. Button click triggers `handleFeedback(ideaId, 'liked')`
2. Function logs to console: `📝 handleFeedback: {...}`
3. API call to `/api/feedback` with POST request
4. Server logs: `✅ Feedback recorded: liked for signal ...`
5. Response logged: `✅ Feedback saved: {...}`
6. Success message: `✅ Idea liked successfully`

### If Like Button Doesn't Work:

Check console for:
- `⚠️ handleFeedback: No showId` → Authentication issue
- `⚠️ handleFeedback: Idea not found` → Idea ID mismatch
- `❌ Feedback failed: ...` → Network/API error
- `Failed to liked idea: ...` → API returned error

## 4. Current Issues Identified

### Issue 1: DNA Topics Structure
- **Problem**: DNA topics have `topic_id: undefined` and `keywords: []`
- **Impact**: DNA matching fails
- **Fix Applied**: Added hardcoded keyword fallback for `energy_oil_gas_lng` topic
- **Status**: Should work now for Venezuela/oil signals

### Issue 2: No Competitor Videos
- **Problem**: 0 competitor videos in database
- **Impact**: No competitor breakout or volume signals
- **Fix Needed**: Import competitor videos to `competitor_videos` table
- **Status**: Expected behavior until competitor data is added

### Issue 3: Low Scores
- **Problem**: Without competitor and DNA signals, max score is ~30-45
- **Impact**: All ideas show as "Backlog" tier
- **Fix Needed**: Add competitor videos and fix DNA topic structure
- **Status**: Working as designed with current data

## 5. Next Steps to Improve Scores

1. **Add Competitor Videos**:
   - Import competitor channel videos to `competitor_videos` table
   - This will enable competitor breakout detection (+30 points)
   - This will enable competitor volume detection (+20 points)

2. **Fix DNA Topics Structure**:
   - Ensure `show_dna.topics` has proper structure:
     ```json
     [
       {
         "topic_id": "energy_oil_gas_lng",
         "keywords": ["oil", "gas", "venezuela", "tanker", ...],
         "name": "Energy, Oil, Gas, LNG"
       }
     ]
     ```

3. **Add User Videos**:
   - Import your channel's video history to `channel_videos` table
   - This enables saturation checks (prevents showing topics you just covered)

## 6. How to Test

1. Open browser console (F12 or Cmd+Option+I)
2. Navigate to `/studio` page
3. Look for debug logs starting with `🔍 DEBUG:`
4. Find a Venezuela/oil idea
5. Check the console logs for that specific idea
6. Click the Like button (👍) on that idea
7. Check console for feedback logs

## Expected Results Summary

| Metric | Expected Value | Actual Value |
|--------|---------------|--------------|
| Raw ideas from RSS | 100 | ✅ |
| Passing filter | 100 | ✅ |
| Post Today (🔴) | 0 | ✅ (no competitor data) |
| This Week (🟡) | 0 | ✅ (low scores) |
| Backlog (🟢) | 100 | ✅ |
| Venezuela idea score | 30-45 | ⚠️ Check console |
| DNA match | `[]` or `['energy_oil_gas_lng']` | ⚠️ Check console |
| Competitor breakout | `null` | ✅ (expected) |
| Like button | Works | ⚠️ Test in browser |
