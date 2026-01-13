# Sync RSS Feeds from Config to Database

## Overview
This guide shows how to sync RSS feed URLs from your config file (`scripts/config/rss_feeds.json`) to the Supabase database (`signal_sources` table).

## Method 1: Using the API Endpoint (Recommended)

### Step 1: Sync RSS Feeds
Call the sync API endpoint with your show_id:

```bash
curl -X POST http://localhost:3000/api/sync-rss-feeds \
  -H "Content-Type: application/json" \
  -d '{"show_id": "00000000-0000-0000-0000-000000000004"}'
```

Or use a tool like Postman/Insomnia:
- **Method**: POST
- **URL**: `http://localhost:3000/api/sync-rss-feeds`
- **Body** (JSON):
  ```json
  {
    "show_id": "00000000-0000-0000-0000-000000000004"
  }
  ```

### Step 2: Process RSS Feeds
After syncing, process the feeds to get new signals:

```bash
curl "http://localhost:3000/api/rss-processor?show_id=00000000-0000-0000-0000-000000000004"
```

## Method 2: Check What Will Be Synced

Before syncing, you can check what feeds are in your config vs what's in the database:

```bash
curl "http://localhost:3000/api/sync-rss-feeds?show_id=00000000-0000-0000-0000-000000000004"
```

This will show:
- Number of feeds in config file
- Number of sources in database
- List of both for comparison

## What the Sync Does

1. **Reads** `scripts/config/rss_feeds.json`
2. **Filters** out placeholders and disabled feeds
3. **Deletes** existing sources for the show
4. **Inserts** new sources from config file
5. **Preserves** DNA topics (from existing sources or channel_dna.json)

## Example Response

```json
{
  "success": true,
  "synced": 27,
  "total_feeds": 27,
  "sources": [
    {
      "id": 1,
      "name": "Bloomberg Direct",
      "url": "https://feeds.bloomberg.com/markets/news.rss",
      "enabled": true
    },
    ...
  ]
}
```

## Troubleshooting

### Error: "Supabase not configured"
- Make sure `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local`
- Restart your dev server after adding the key

### Error: "No RSS feeds found in config file"
- Check that `scripts/config/rss_feeds.json` exists
- Verify the file has a `feeds` array

### Feeds not syncing
- Check browser/terminal console for errors
- Verify the show_id is correct (UUID format)
- Make sure RLS policies allow inserts (use service_role key)

## Quick Workflow

1. **Update** `scripts/config/rss_feeds.json` with new URLs
2. **Sync** to database: `POST /api/sync-rss-feeds`
3. **Process** feeds: `GET /api/rss-processor?show_id=...`
4. **View** signals: Go to `/signals` page

