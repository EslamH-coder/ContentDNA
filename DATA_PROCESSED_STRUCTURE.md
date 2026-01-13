# Data/Processed JSON Files Structure

## Overview
All files in `data/processed/` directory (7 JSON files, ~29,618 total lines)

---

## 1. `search_terms.json` (153KB, 6,440 lines)

**Purpose:** Search terms that the audience uses on YouTube

**Structure:**
```json
{
  "terms": [
    {
      "term": "المخبر الاقتصادي",
      "views": 869020,
      "watchTimeHours": 165517.8748,
      "avgViewDuration": "0:11:26",
      "topic": "channel",
      "intent": "informational",
      "personas": [],
      "isBranded": true,
      "isOpportunity": false
    }
  ]
}
```

**Key Fields:**
- `term`: The search query text
- `views`: Total views for videos matching this search
- `watchTimeHours`: Total watch time
- `topic`: Category (channel, economy, politics, etc.)
- `personas`: Array of persona IDs that search for this
- `isBranded`: Whether it's a branded search (channel name)
- `isOpportunity`: Whether this is an opportunity to create content

**Used by:** Simple Intelligence Engine (reads from Supabase `search_terms` table instead)

---

## 2. `audience_videos.json` (308KB, 9,839 lines)

**Purpose:** Videos that the audience watches (competitor/related content)

**Structure:**
```json
{
  "videos": [
    {
      "id": "ytv_vZMIvR89A6U",
      "title": "فلاديمير بوتين | الدحيح",
      "url": "https://www.youtube.com/watch?v=vZMIvR89A6U",
      "platform": "youtube",
      "uploadDate": "2025-10-11T17:00:06+00:00",
      "duration": 3295,
      "creator": {
        "id": "bq2AF1osf303RqQJQ01",
        "name": "New Media Academy Life"
      },
      "views": 4952928,
      "engagements": 120192,
      "relevanceScore": 16.449177507312726,
      "audienceOverlap": 0.09585502849411669,
      "isShort": false,
      "category": "People & Blogs",
      "topic": "politics",
      "personas": ["geopolitics"],
      "isRelevant": true
    }
  ]
}
```

**Key Fields:**
- `title`: Video title (used for topic extraction)
- `views`: View count
- `relevanceScore`: How relevant to our audience
- `audienceOverlap`: Percentage of shared audience
- `topic`: Content category
- `personas`: Which personas watch this

**Used by:** Simple Intelligence Engine (reads from Supabase `videos` table instead)

---

## 3. `comments.json` (404KB, 9,951 lines)

**Purpose:** Raw comments from audience videos

**Structure:**
```json
{
  "comments": [
    {
      "id": "comment_532",
      "author": "Blurreth",
      "text": "المخبر الاقتصادي هو احد افضل البرامج...",
      "likes": 10,
      "replies": 0,
      "date": "12/22/2025",
      "videoId": "",
      "videoTitle": "",
      "type": "question",
      "sentiment": "positive",
      "topic": "economy",
      "question": "...",
      "request": null,
      "isActionable": true
    }
  ]
}
```

**Key Fields:**
- `text`: Comment text (used for topic extraction)
- `type`: question, request, other
- `sentiment`: positive, negative, neutral
- `topic`: Content category
- `isActionable`: Whether this is a request for content

**Used by:** Simple Intelligence Engine (reads from Supabase `comments` table instead)

---

## 4. `channels.json` (68KB, 2,553 lines)

**Purpose:** Competitor channels and their metrics

**Structure:**
```json
{
  "channels": [
    {
      "id": "xUzvEbq7fb",
      "name": "قناة العربية  Al Arabiya",
      "url": "http://youtube.com/channel/UCahpxixMCwoANAftn6IxkTg",
      "country": "AE",
      "relevanceScore": 274.5885171722246,
      "audienceOverlap": 0.5358024691358024,
      "affinity": 512.4808730633686,
      "industry": "Broadcast, Cable, Radio, Film",
      "contentGenre": "News & Politics",
      "themes": ["Entertainment", "Politics", "Television show", "Society"],
      "subscribers": 18700000,
      "totalViews": 15271357409,
      "monthlyViews": 699766724,
      "category": "news",
      "relevanceToUs": "direct_competitor",
      "personas": ["geopolitics", "gulf_oil"],
      "isDirectCompetitor": true
    }
  ]
}
```

**Key Fields:**
- `name`: Channel name
- `relevanceScore`: How relevant to our audience
- `audienceOverlap`: Shared audience percentage
- `personas`: Which personas watch this channel
- `isDirectCompetitor`: Whether it's a direct competitor

**Used by:** Not directly used by Simple Intelligence Engine (but videos from these channels are)

---

## 5. `smart_comments.json` (16KB, 344 lines)

**Purpose:** AI-filtered comments (actionable requests/questions only)

**Structure:**
```json
{
  "all": [
    {
      "id": "comment_289",
      "author": "HArge-j3p",
      "text": "حلقه مميزه استاذ اشرف، ياريت تسلط الضوء على ارتفاع أسعار قطع الكمبيوتر...",
      "likes": 2,
      "replies": 0,
      "date": "12/28/2025",
      "videoId": "",
      "videoTitle": "",
      "type": "question",
      "sentiment": "neutral",
      "topic": "general",
      "question": "...",
      "request": null,
      "isActionable": false,
      "analysis": null
    }
  ]
}
```

**Key Fields:**
- Similar to `comments.json` but filtered
- Only contains actionable comments (requests, questions)
- May have `analysis` field with AI insights

**Used by:** Legacy systems (Simple Intelligence Engine uses raw `comments` table)

---

## 6. `persona_report.json` (3.6KB, 91 lines)

**Purpose:** Persona strength analysis and signals

**Structure:**
```json
{
  "generatedAt": "2025-12-29T08:28:14.722Z",
  "personas": [
    {
      "id": "gulf_oil",
      "name": "🛢️ متابع النفط الخليجي",
      "strength": 461,
      "signals": [
        "يشاهدون: قناة العربية  Al Arabiya",
        "يشاهدون: Al Mashhad المشهد",
        "يبحثون: ايران",
        "يبحثون: ايران واسرائيل"
      ]
    },
    {
      "id": "geopolitics",
      "name": "🌍 المحلل الجيوسياسي",
      "strength": 412,
      "signals": [
        "يشاهدون: قناة العربية  Al Arabiya",
        "يبحثون: الصين",
        "يبحثون: الصين وامريكا"
      ]
    }
  ]
}
```

**Key Fields:**
- `id`: Persona identifier
- `name`: Persona display name
- `strength`: Numeric strength score
- `signals`: Array of behavioral signals (what they watch/search)

**Used by:** Persona analysis systems

---

## 7. `unified_insights.json` (13KB, 400 lines)

**Purpose:** Unified audience profile and insights

**Structure:**
```json
{
  "generatedAt": "2025-12-29T08:28:14.720Z",
  "audienceProfile": {
    "topChannels": [
      {
        "name": "Blinxnews",
        "country": "AE",
        "overlap": "32.1%",
        "themes": ["Entertainment", "Pop music", "Society"]
      },
      {
        "name": "Al Jazeera Channel - قناة الجزيرة",
        "country": "QA",
        "overlap": "38.3%",
        "themes": ["Politics", "Society"]
      }
    ]
  }
}
```

**Key Fields:**
- `audienceProfile`: Overall audience characteristics
- `topChannels`: Most watched channels
- `overlap`: Audience overlap percentage
- `themes`: Content themes

**Used by:** Audience analysis and DNA building

---

## Important Note

**The Simple Intelligence Engine does NOT use these files!**

It reads directly from Supabase tables:
- `search_terms` table (not `search_terms.json`)
- `videos` table (not `audience_videos.json`)
- `comments` table (not `comments.json`)
- `signals` table (RSS signals)
- `manual_trends` table (manual trends)

These JSON files are from the **old file-based system** and are kept for reference/legacy support.

---

## File Sizes Summary

| File | Size | Lines | Purpose |
|------|------|-------|---------|
| `search_terms.json` | 153KB | 6,440 | Search queries |
| `audience_videos.json` | 308KB | 9,839 | Competitor videos |
| `comments.json` | 404KB | 9,951 | Raw comments |
| `channels.json` | 68KB | 2,553 | Competitor channels |
| `smart_comments.json` | 16KB | 344 | Filtered comments |
| `persona_report.json` | 3.6KB | 91 | Persona analysis |
| `unified_insights.json` | 13KB | 400 | Audience insights |
| **Total** | **~965KB** | **29,618** | |




