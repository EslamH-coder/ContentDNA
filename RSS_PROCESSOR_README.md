# RSS Processor API - Documentation

## Overview

The RSS Processor is a serverless API route that:
1. Fetches RSS feeds from the `signal_sources` table
2. Parses RSS items using `rss-parser`
3. Scores each item against show DNA using topic matching
4. Saves high-scoring items (score >= 5.0) to the `signals` table

## Files Created

### 1. Database Schema
- **`supabase_schema.sql`** - Updated with `signal_sources` table
  - Stores RSS feed URLs per show
  - Includes DNA topics configuration (JSONB)
  - Tracks enabled/disabled status

### 2. DNA Scoring Logic
- **`lib/dna-scoring.js`** - Scoring algorithm
  - Topic inference from RSS item text
  - DNA match scoring (0-10 scale)
  - Hook potential calculation
  - Recency weighting

### 3. API Route
- **`app/api/rss-processor/route.js`** - Serverless function
  - GET/POST endpoints
  - Processes single show or all shows
  - Deduplicates signals
  - Returns processing statistics

### 4. Dependencies
- **`package.json`** - Added `rss-parser` package

## API Endpoints

### GET `/api/rss-processor`

**Query Parameters:**
- `show_id` (number) - Process RSS feeds for specific show
- `all` (boolean) - Process all shows (set to `true`)

**Examples:**
```
GET /api/rss-processor?show_id=1
GET /api/rss-processor?all=true
```

### POST `/api/rss-processor`

**Request Body:**
```json
{
  "show_id": 1
}
```
or
```json
{
  "all": true
}
```

**Response:**
```json
{
  "success": true,
  "processed": 20,
  "saved": 5,
  "results": [
    {
      "title": "Fed raises interest rates...",
      "score": 7.5,
      "topicId": "us_debt_treasuries"
    }
  ]
}
```

## Scoring Algorithm

The scoring algorithm evaluates RSS items on:

1. **DNA Match (50% weight)**
   - Checks if inferred topic matches show's DNA topics
   - Perfect match = 1.0, partial = 0.3, no match = 0.0

2. **Recency (30% weight)**
   - Items < 1 day old = 1.0
   - Items 1-3 days = 0.8
   - Items 3-7 days = 0.6
   - Items 7-14 days = 0.4
   - Items 14-30 days = 0.2
   - Items > 30 days = 0.1

3. **Content Quality (20% weight)**
   - Title length (optimal ~100 chars)
   - Description presence (>50 chars)

**Final Score:** `(DNA × 0.5 + Recency × 0.3 + Quality × 0.2) × 10`

**Hook Potential:** `(Recency × 0.6 + DNA × 0.4) × 10`

## Setup Instructions

### 1. Install Dependencies
```bash
cd cursor
npm install
```

### 2. Update Database Schema
Run the updated `supabase_schema.sql` in your Supabase SQL Editor to create the `signal_sources` table.

### 3. Add RSS Feed Sources
```sql
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  1,
  'Financial Times',
  'https://www.ft.com/rss',
  true,
  20,
  '["us_china_geopolitics", "currency_devaluation", "inflation_prices"]'::jsonb
);
```

### 4. Test the API
```bash
# Start dev server
npm run dev

# Test in another terminal
curl http://localhost:3000/api/rss-processor?show_id=1
```

## Cron Setup

See `CRON_SETUP.md` for detailed cron configuration options:
- Vercel Cron (for Vercel deployments)
- External cron services
- Server cron jobs
- Node.js cron packages

## Configuration

### Scoring Threshold
Currently set to **5.0** (items with score >= 5.0 are saved). To change:
- Edit `app/api/rss-processor/route.js`
- Find: `if (scoring.score >= 5.0)`
- Adjust threshold as needed

### DNA Topics
DNA topics are stored in `signal_sources.dna_topics` as JSONB array:
```json
["us_china_geopolitics", "currency_devaluation", "inflation_prices"]
```

To update topics for a source:
```sql
UPDATE signal_sources
SET dna_topics = '["new_topic_id"]'::jsonb
WHERE id = 1;
```

## Monitoring

Check processed signals:
```sql
SELECT 
  s.id,
  s.title,
  s.score,
  s.hook_potential,
  s.source,
  s.created_at,
  ss.name as feed_name
FROM signals s
LEFT JOIN signal_sources ss ON s.source LIKE '%' || ss.name || '%'
WHERE s.created_at > NOW() - INTERVAL '24 hours'
ORDER BY s.score DESC;
```

## Troubleshooting

**No signals saved:**
- Check if RSS feeds are accessible
- Verify `dna_topics` are set correctly
- Lower the scoring threshold for testing
- Check browser console/API logs

**API returns error:**
- Verify Supabase connection
- Check `signal_sources` table exists
- Ensure at least one enabled source exists

**Low scores:**
- Review DNA topics configuration
- Check if RSS items match topic keywords
- Adjust scoring weights in `lib/dna-scoring.js`

