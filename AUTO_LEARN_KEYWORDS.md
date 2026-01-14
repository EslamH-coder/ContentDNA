# Auto-Learn Keywords from User Feedback

## Overview

The system now automatically learns new keywords when users like signals. This improves DNA matching over time without manual keyword maintenance.

## How It Works

### When User Likes a Signal

**Example:** User likes "Why Iran's brutal ayatollah will hang on until the bloody end"

**System Process:**
1. ✅ AI extracts entities: `{ countries: ['Iran'], people: ['ayatollah'] }`
2. ✅ Finds matching DNA topic: `iran_oil_sanctions` (matches "Iran")
3. ✅ Extracts new keywords from title: `['brutal', 'ayatollah']`
4. ✅ Adds to `topic_definitions.keywords`: `['iran', 'oil', ..., 'brutal', 'ayatollah']`
5. ✅ Logs: `📚 Auto-learned: Added [brutal, ayatollah] to topic "iran_oil_sanctions"`

### Next Time

- Signal "Ayatollah threatens retaliation" → **Matches Iran topic** (even without "Iran" in title)
- No manual keyword addition needed!

---

## Implementation Details

### Function: `autoLearnKeywords()`

**Location:** `/lib/scoring/signalScoringService.js`

**What it does:**
1. Loads DNA topics from `topic_definitions`
2. Finds matching topic based on countries/entities
3. Extracts new keywords from signal title
4. Adds new keywords to topic's `keywords` array
5. Updates `topic_definitions` table

**Called from:** `learnFromFeedback()` when `feedbackType === 'like'`

### Function: `extractNewKeywords()`

**Safety Filters:**
- ✅ Min 4 characters per keyword (skips short words)
- ✅ Skips stop words (the, is, are, etc.)
- ✅ Skips existing keywords (no duplicates)
- ✅ Skips pure numbers
- ✅ Max 3 keywords per signal (prevents pollution)

**Stop Words Include:**
- English: the, a, an, is, are, was, were, will, would, could, etc.
- Arabic: في, من, إلى, على, عن, مع, هذا, هذه, etc.
- Common verbs: says, said, shows, makes, takes, etc.

### Function: `learnPersonToTopic()`

**What it does:**
- Learns person names associated with topics
- Example: "ayatollah" or "Khamenei" → Iran topic
- Only learns if person is associated with a country in the signal

### Function: `learnOrganizationToTopic()`

**What it does:**
- Learns organization names associated with topics
- Example: "IRGC" → Iran topic
- Only learns if organization is associated with a country in the signal

---

## Safety Limits

### 1. Only Learn from Likes
- ❌ Rejects don't trigger keyword learning
- ✅ Only positive feedback (likes) add keywords

### 2. Max Keywords Per Signal
- Maximum 3 keywords per signal
- Prevents keyword pollution from long titles

### 3. Minimum Keyword Length
- At least 4 characters
- Skips: "the", "is", "a", etc.

### 4. Duplicate Prevention
- Checks existing keywords before adding
- No duplicates added

### 5. Stop Word Filtering
- Comprehensive stop word list (200+ words)
- Filters out common words that don't add value

---

## Example Scenarios

### Scenario 1: Learning Person Names

**User likes:** "Iran's Supreme Leader Khamenei warns US"

**System:**
1. Extracts: `{ countries: ['Iran'], people: ['Khamenei'] }`
2. Finds topic: `iran_oil_sanctions`
3. Adds: `'Khamenei'` to keywords
4. Result: Future signals with "Khamenei" match Iran topic

### Scenario 2: Learning Descriptive Words

**User likes:** "Iran's brutal crackdown on protesters"

**System:**
1. Extracts: `{ countries: ['Iran'] }`
2. Finds topic: `iran_oil_sanctions`
3. Extracts keywords: `['brutal', 'crackdown', 'protesters']`
4. Adds: `['brutal', 'crackdown', 'protesters']` to keywords
5. Result: Future signals with these words match Iran topic

### Scenario 3: Learning Organizations

**User likes:** "IRGC launches missile attack"

**System:**
1. Extracts: `{ countries: ['Iran'], organizations: ['IRGC'] }`
2. Finds topic: `iran_oil_sanctions`
3. Adds: `'IRGC'` to keywords
4. Result: Future signals with "IRGC" match Iran topic

---

## Testing

### Test 1: Like an Iran Story

1. Like signal: "Why Iran's brutal ayatollah will hang on until the bloody end"
2. Check terminal logs:
   ```
   📚 Auto-learned: Added [brutal, ayatollah] to topic "iran_oil_sanctions"
   ```
3. Check database:
   ```sql
   SELECT keywords FROM topic_definitions 
   WHERE topic_id = 'iran_oil_sanctions';
   ```
4. Verify: `keywords` array includes `'brutal'` and `'ayatollah'`

### Test 2: Verify Matching Works

1. New signal: "Ayatollah threatens retaliation" (no "Iran" in title)
2. Check if it matches `iran_oil_sanctions` topic
3. Should match because "ayatollah" is now in keywords

### Test 3: Verify Safety Limits

1. Like signal with many words: "The new report says that Iran is..."
2. Check logs: Should only add max 3 keywords
3. Verify: Stop words ("the", "new", "report", "says", "that", "is") are filtered out

---

## Database Changes

### Table: `topic_definitions`

**Before:**
```json
{
  "topic_id": "iran_oil_sanctions",
  "keywords": ["iran", "oil", "sanctions", "إيران", "نفط"]
}
```

**After User Likes "Iran's brutal ayatollah":**
```json
{
  "topic_id": "iran_oil_sanctions",
  "keywords": ["iran", "oil", "sanctions", "إيران", "نفط", "brutal", "ayatollah"],
  "updated_at": "2025-01-XX..."
}
```

---

## Logging

### Success Logs
```
📚 Auto-learned: Added [brutal, ayatollah] to topic "iran_oil_sanctions" (Iran & Oil Sanctions)
📚 Auto-learned: Added person "Khamenei" to topic "iran_oil_sanctions" (Iran & Oil Sanctions)
📚 Auto-learned: Added organization "IRGC" to topic "iran_oil_sanctions" (Iran & Oil Sanctions)
```

### Warning Logs
```
⚠️ Could not load DNA topics for auto-learning: [error message]
```

### Error Logs
```
❌ Error updating topic keywords: [error message]
❌ Error in autoLearnKeywords: [error message]
```

---

## Configuration

### Adjust Max Keywords Per Signal

In `extractNewKeywords()` function:
```javascript
return unique.slice(0, 3); // Change 3 to desired max
```

### Adjust Minimum Keyword Length

In `extractNewKeywords()` function:
```javascript
word.length >= 4 && // Change 4 to desired min
```

### Add More Stop Words

In `extractNewKeywords()` function, add to `stopWords` Set:
```javascript
const stopWords = new Set([
  // ... existing words ...
  'your', 'new', 'stop', 'words', 'here'
]);
```

---

## Benefits

1. **Automatic Improvement** - System gets smarter over time
2. **No Manual Maintenance** - Keywords added automatically
3. **Better Matching** - More keywords = better DNA matching
4. **Context-Aware** - Only learns from liked signals
5. **Safe** - Multiple safety limits prevent pollution

---

## Limitations

1. **Only from Likes** - Rejects don't trigger learning
2. **Max 3 Keywords** - Prevents pollution but may miss some
3. **Requires Country Match** - Needs at least one country to match topic
4. **Min 4 Characters** - Short words are skipped
5. **Stop Word Filter** - Common words are filtered out

---

## Future Enhancements

1. **Learn from Rejects** - Remove keywords when user rejects
2. **Weighted Keywords** - Track which keywords are most important
3. **Keyword Expiration** - Remove unused keywords after time
4. **Multi-Topic Learning** - Learn keywords for multiple topics
5. **Keyword Confidence** - Track how often keyword appears in liked signals

---

## Summary

✅ **Auto-learning enabled** - Keywords added automatically from likes  
✅ **Safety limits** - Max 3 keywords, min 4 chars, stop word filtering  
✅ **Person/Org learning** - Learns names and organizations  
✅ **Database updates** - Writes directly to `topic_definitions`  
✅ **Better matching** - System improves over time automatically

The system now learns and improves without manual intervention!
