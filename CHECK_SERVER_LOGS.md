# How to Check Server Logs for RSS Processor

## The Problem

Browser shows 0 signals, but we need to see **server-side logs** to understand why items aren't being saved.

## Where to Find Server Logs

### Option 1: Terminal/Console Where Next.js is Running

If you're running Next.js locally:
1. **Find the terminal** where you ran `npm run dev` or `next dev`
2. **Look for these logs** after clicking "Update RSS Feeds":
   ```
   🎯 Using recommendation engine for X items...
   ```
   OR
   ```
   ⚠️  Using old scoring method
   ```

### Option 2: Vercel/Production Logs

If deployed on Vercel:
1. Go to Vercel Dashboard
2. Click on your project
3. Go to "Logs" tab
4. Filter for "rss-processor" or look for recent logs

### Option 3: Check Browser Network Tab

1. Open browser DevTools (F12)
2. Go to "Network" tab
3. Click "Update RSS Feeds" button
4. Find the request to `/api/rss-processor`
5. Check the **Response** - it should include processing results

## What to Look For

### Key Log Messages:

1. **Which path is being used?**
   ```
   🎯 Using recommendation engine for X items...
   ```
   OR
   ```
   ⚠️  Using old scoring method
   ```

2. **Priority breakdown:**
   ```
   Priority breakdown: HIGH: X, MEDIUM: Y, LOW: Z
   ```

3. **Filter summary:**
   ```
   🔍 DEBUG Summary:
      Items checked: X
      Passed priority filter: Y
      Passed score threshold: Z
      Actually saved: W
   ```

4. **Any errors:**
   ```
   ❌ Error saving signal
   ❌ Error in recommendation engine
   ```

## Quick Test: Check API Response

1. Open browser DevTools (F12)
2. Go to "Network" tab
3. Click "Update RSS Feeds"
4. Find `/api/rss-processor` request
5. Click on it → "Response" tab
6. Look for:
   ```json
   {
     "success": true,
     "processed": 135,
     "saved": 0,
     "feeds_processed": 27,
     ...
   }
   ```

The response should tell you:
- How many items were processed
- How many were saved
- Which path was used

## If You Can't See Server Logs

I can add an API endpoint that returns the last processing results. Would you like me to create that?

Or, share the **Network tab response** from the `/api/rss-processor` request - that will show what the server returned.

