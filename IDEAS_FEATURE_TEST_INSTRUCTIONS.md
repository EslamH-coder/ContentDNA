# Ideas Feature Test Instructions

## Quick Test Script

I've created a test script to run the Ideas feature with real data. However, it requires environment variables to be set.

## Option 1: Run the Test Script

```bash
cd /Users/Hassanes_1/Documents/channelbrain/cursor

# Make sure your .env.local or .env file has:
# NEXT_PUBLIC_SUPABASE_URL=your_url
# SUPABASE_SERVICE_ROLE_KEY=your_key

# Then run:
node scripts/test-ideas-feature.mjs <show_id>

# Example:
node scripts/test-ideas-feature.mjs a7982c70-2b0e-46af-a0ad-c78f4f69cd56
```

## Option 2: Test via API (If Server is Running)

If your Next.js server is running on `http://localhost:3000`:

```bash
# Get your show_id first
curl http://localhost:3000/api/shows/current

# Then fetch signals
curl "http://localhost:3000/api/signals?show_id=YOUR_SHOW_ID" \
  -H "Cookie: your-auth-cookie"
```

## Option 3: Test in Browser

1. Start your Next.js server: `npm run dev`
2. Navigate to: `http://localhost:3000/studio`
3. The page will automatically fetch and display ideas

## What the Test Shows

The test script will display:

1. **Raw ideas from RSS:** Total count of signals in database
2. **Passing filter:** How many signals passed the multi-signal scoring filter
3. **Breakdown by tier:**
   - 🔴 Post Today
   - 🟡 This Week  
   - 🟢 Backlog
4. **Top 3 ideas** with:
   - Title
   - Source
   - Score
   - Tier
   - All signals detected

## Expected Output Format

```
🧪 TESTING IDEAS FEATURE WITH REAL DATA
============================================================
Show ID: a7982c70-2b0e-46af-a0ad-c78f4f69cd56
============================================================

📰 STEP 1: Fetching raw signals from database...
✅ Found 25 raw signals in database

📊 STEP 2: Fetching context data...
   📊 Competitor videos: 12
   📹 User videos: 45
   🧬 DNA topics: 8
   🧠 Learned adjustments: 0 feedback entries

🎯 STEP 3: Applying multi-signal scoring...

🔍 STEP 4: Filtering results...

============================================================
📊 RESULTS SUMMARY
============================================================

1. Raw ideas from RSS: 25
2. Passing filter: 18

   Breakdown by tier:
   🔴 Post Today: 2
   🟡 This Week: 8
   🟢 Backlog: 8

============================================================
🏆 TOP 3 IDEAS
============================================================

1. الصين تستورد كميات قياسية من النفط الروسي رغم العقوبات
   Source: Reuters
   Score: 100/100
   Tier: 🔴 Post Today
   Signals (5):
      🔥 Competitor breakout: Bloomberg got 3.1x their average
      📊 3 competitors posted about this
      ✅ Matches your DNA: energy_oil_gas_lng
      📰 Trending: 1 source in 48h
      ⏰ Last covered: 56 days ago
```

## Troubleshooting

### Error: "supabaseUrl is required"
- Make sure `.env.local` or `.env` file exists
- Check that `NEXT_PUBLIC_SUPABASE_URL` is set
- Check that `SUPABASE_SERVICE_ROLE_KEY` is set

### Error: "No signals found"
- Run RSS processor first: `GET /api/rss-processor?show_id=YOUR_SHOW_ID`
- Or visit: `http://localhost:3000/api/rss-processor?show_id=YOUR_SHOW_ID`

### Error: "Cannot find module"
- Make sure you're in the correct directory: `/Users/Hassanes_1/Documents/channelbrain/cursor`
- Run `npm install` if needed

## Next Steps

Once you have the test script working, you'll see actual data showing:
- How many raw RSS items were processed
- How many passed the multi-signal filter
- The top ideas with their complete scoring breakdown

This will give you real insights into how the Ideas feature is performing with your actual data!
