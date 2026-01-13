# Fix RSS Date Bug

## Problem

The system was showing today's date instead of the actual article publication date:
- Article published: May 2025 (7 months ago)
- System displayed: December 28, 2025 (today)
- Generated hook: "في 28 ديسمبر 2025..." (WRONG!)

## Solution

### 1. Created Date Parser Utility (`lib/utils/dateParser.js`)

- **`parseRssItemDate()`**: Extracts and validates publication dates from RSS items
- **`formatDateForHook()`**: Formats dates for Arabic hooks (e.g., "في 27 ديسمبر 2025")
- **`filterByFreshness()`**: Filters out old articles (>7 days by default)
- Handles multiple date fields: `pubDate`, `published`, `isoDate`, `dc:date`
- Validates dates (rejects future dates, invalid dates)
- Calculates freshness: BREAKING, FRESH, RECENT, STALE, OLD
- Marks Google News dates as LOW reliability (they show indexing date, not publication date)

### 2. Updated RSS Processor (`app/api/rss-processor/route.js`)

- **RSS Feed Parsing**: Now parses dates and adds `dateInfo` to each item
- **Sitemap Parsing**: Also parses dates from sitemap XML
- **Freshness Filtering**: Automatically filters out articles older than 7 days
- **Date Logging**: Logs date info for debugging

### 3. Updated Story Parser (`lib/recommendation/storyParser.js`)

- **Timeline Extraction**: Now uses actual publication date if available and fresh
- Falls back to pattern matching if date is unavailable or too old
- Uses formatted Arabic date: "في [day] [month] [year]"

## Key Features

### Date Reliability Levels

- **HIGH**: Direct RSS publication date
- **MEDIUM**: Parsed date from alternative fields
- **LOW**: Google News dates (indexing date, not publication date)

### Freshness Categories

- **BREAKING**: < 24 hours
- **FRESH**: 1-3 days
- **RECENT**: 3-7 days
- **STALE**: 7-30 days
- **OLD**: > 30 days

### Hook Generation Rules

Dates are only used in hooks if:
1. Publication date is available
2. Date reliability is HIGH or MEDIUM (not LOW)
3. Article is fresh (< 7 days old)

Otherwise, hooks use non-date patterns (questions, product+number, etc.)

## Example Output

### Before Fix:
```
Title: "الرئيس ترامب عائد لأمريكا... ومعه خطة 2025"
Date: Dec 28, 2025 ← WRONG (today)
Hook: "في 28 ديسمبر 2025..." ← WRONG
```

### After Fix:
```
Title: "الرئيس ترامب عائد لأمريكا... ومعه خطة 2025"
Date: May 3, 2025 ← CORRECT (actual)
Freshness: OLD (240 days)
Status: FILTERED OUT (article too old)
```

Or for fresh articles:
```
Title: "لماذا ترامب يرفع الرسوم الجمركية على الصين 60%؟"
Date: Dec 27, 2025 ← CORRECT (actual)
Freshness: FRESH (1 day)
Hook: "في 27 ديسمبر 2025 الرئيس الأمريكي دونالد ترامب أعلن رسمياً..." ← CORRECT
```

## Testing

To test the fix:

```javascript
// Test with old article
const testItem = {
  title: "Trump overturned decades of US trade policy in 2025",
  pubDate: "Sat, 03 May 2025 12:00:00 GMT",
  link: "https://news.google.com/..."
};

const dateInfo = parseRssItemDate(testItem);
console.log('Parsed date:', dateInfo.pubDate);     // Should be May 3, 2025
console.log('Age in days:', dateInfo.ageInDays);   // Should be ~240 days
console.log('Freshness:', dateInfo.freshness);     // Should be 'OLD'
console.log('Use in hook:', dateInfo.useInHook);   // Should be false (too old)
```

## Files Changed

1. **`lib/utils/dateParser.js`** (NEW) - Date parsing and validation utilities
2. **`app/api/rss-processor/route.js`** - Updated to parse dates and filter by freshness
3. **`lib/recommendation/storyParser.js`** - Updated to use actual publication dates

## Configuration

Default settings:
- **Max age**: 7 days (articles older than this are filtered out)
- **Allow stale**: false (old articles are completely removed, not just flagged)

To change these settings, modify the `filterByFreshness()` call in `route.js`:

```javascript
rssItems = filterByFreshness(rssItems, { 
  maxAgeDays: 14,      // Allow articles up to 14 days old
  allowStale: true     // Keep old articles but flag them
});
```

## Next Steps

1. Monitor logs to see how many articles are filtered by freshness
2. Adjust `maxAgeDays` if needed based on content strategy
3. Consider adding date display in UI to show actual publication dates
4. Add date warnings in signals page for old articles (if `allowStale: true`)

