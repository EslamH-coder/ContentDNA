# 🔍 Debugging Behavior Insight Panel

## What to Check in Browser Console

When you open the `/signals` page, you should see these console logs:

### 1. When Signals Load
Look for:
```
✅ Fetched signals: X signals
📊 Signals with behavior data: X/X
```

**If you see `0/X` signals with behavior data:**
- The RSS processor hasn't generated behavior data yet
- You need to run RSS update to create new signals with behavior data

**If you see `X/X` signals with behavior data:**
- Data exists! Check the next logs

### 2. For Each Signal Card
Look for:
```
🔍 Signal behavior check: {
  signalId: 123,
  title: "...",
  'signal.behaviorUI': false,
  'raw_data?.behaviorUI': true,  ← This should be true
  'raw_data?.behavior': false,
  'raw_data?.recommendation?.behaviorUI': false,
  'FOUND behaviorData': true,  ← This should be true
  rawDataStructure: { ... }
}
```

**Key things to check:**
- `'FOUND behaviorData': true` → Panel should render
- `'FOUND behaviorData': false` → Panel won't render, check why

### 3. When Panel Component Receives Data
Look for:
```
🔍 BehaviorInsightPanel received: {
  hasBehavior: true,  ← Should be true
  behaviorType: "object",
  behaviorKeys: ["primaryInterest", "relevanceScore", ...],
  primaryInterest: { ... },
  relevanceScore: 85
}
```

**If you see `hasBehavior: false`:**
- Component received `null` or `undefined`
- Check the path where data is stored

### 4. Common Issues

#### Issue: No behavior data in signals
**Console shows:** `📊 Signals with behavior data: 0/X`
**Solution:**
1. Go to RSS processor page
2. Click "Update RSS Feeds"
3. Wait for processing to complete
4. Refresh signals page

#### Issue: Data exists but panel doesn't show
**Console shows:** `'FOUND behaviorData': true` but no panel
**Check:**
- Look for errors in console (red text)
- Check if `BehaviorInsightPanel` component is rendering
- Verify the data structure matches what component expects

#### Issue: Data in wrong location
**Console shows:** `'FOUND behaviorData': false` but data exists somewhere
**Check the `rawDataStructure` object:**
- What keys are in `raw_data`?
- Does `recommendation` exist?
- What keys are in `recommendation`?

### 5. Quick Test

Run this in browser console on `/signals` page:
```javascript
// Check first signal
const firstSignal = document.querySelector('[data-signal-id]');
console.log('First signal data:', firstSignal?.dataset);

// Or check React state (if accessible)
// Look at the console logs that show signal structure
```

### 6. Expected Data Structure

The behavior data should look like:
```javascript
{
  primaryInterest: {
    icon: "🌍",
    name: "صراع القوى الكبرى",
    question: "من سيسيطر على العالم؟",
    score: 85
  },
  relevanceScore: 85,
  evidence: {
    searchVolume: 35000,
    avgWatchTime: "9:30",
    topSearches: [...]
  },
  questions: [...],
  pitchSuggestions: [...]
}
```

If the data structure is different, the panel might not render correctly.

## Next Steps

1. **Open browser console** (F12 or Cmd+Option+I)
2. **Go to `/signals` page**
3. **Look for the logs above**
4. **Share what you see** - especially:
   - How many signals have behavior data?
   - What does `'FOUND behaviorData'` show?
   - Any errors in red?




