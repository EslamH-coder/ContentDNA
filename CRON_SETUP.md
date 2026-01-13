# RSS Processor Cron Setup

The RSS processor API can be triggered manually or via cron jobs. Here are setup options:

## Manual Trigger

### Via Browser/HTTP Client

**Process all shows:**
```
GET http://localhost:3000/api/rss-processor?all=true
```

**Process specific show:**
```
GET http://localhost:3000/api/rss-processor?show_id=1
```

**POST request (JSON):**
```bash
curl -X POST http://localhost:3000/api/rss-processor \
  -H "Content-Type: application/json" \
  -d '{"show_id": 1}'
```

## Cron Setup Options

### Option 1: Vercel Cron (Recommended for Vercel deployments)

Create `vercel.json` in your project root:

```json
{
  "crons": [
    {
      "path": "/api/rss-processor?all=true",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

This runs every 6 hours. Adjust schedule as needed:
- `0 */6 * * *` - Every 6 hours
- `0 0 * * *` - Daily at midnight
- `*/30 * * * *` - Every 30 minutes

### Option 2: External Cron Service

Use services like:
- **cron-job.org** - Free cron service
- **EasyCron** - Cron job scheduler
- **GitHub Actions** - If your code is on GitHub

Example cron-job.org setup:
1. Sign up at https://cron-job.org
2. Create new cron job
3. URL: `https://your-domain.com/api/rss-processor?all=true`
4. Schedule: Every 6 hours
5. Method: GET

### Option 3: Server Cron (Linux/Mac)

Add to crontab (`crontab -e`):

```bash
# Run every 6 hours
0 */6 * * * curl -X GET "https://your-domain.com/api/rss-processor?all=true"
```

### Option 4: Node.js Cron Package

Install `node-cron`:
```bash
npm install node-cron
```

Create `scripts/cron-rss.js`:
```javascript
const cron = require('node-cron')
const https = require('https')

cron.schedule('0 */6 * * *', () => {
  https.get('https://your-domain.com/api/rss-processor?all=true', (res) => {
    console.log(`RSS processor triggered: ${res.statusCode}`)
  })
})
```

Run with PM2 or similar:
```bash
pm2 start scripts/cron-rss.js
```

## Database Setup

Before using the RSS processor, set up your signal sources:

```sql
-- Add RSS feed source for a show
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  1, -- show_id
  'Financial Times',
  'https://www.ft.com/rss',
  true,
  20,
  '["us_china_geopolitics", "currency_devaluation", "inflation_prices"]'::jsonb
);
```

## Testing

Test the API locally:
```bash
# Start dev server
npm run dev

# In another terminal, trigger the processor
curl http://localhost:3000/api/rss-processor?show_id=1
```

Check the response:
```json
{
  "success": true,
  "processed": 20,
  "saved": 5,
  "results": [...]
}
```

## Monitoring

Check processed signals in Supabase:
```sql
SELECT 
  s.*,
  ss.name as source_name
FROM signals s
LEFT JOIN signal_sources ss ON s.source LIKE '%' || ss.name || '%'
WHERE s.created_at > NOW() - INTERVAL '1 day'
ORDER BY s.score DESC;
```

