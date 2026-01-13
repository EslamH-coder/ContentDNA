# How to Check if DNA is Loading

## Method 1: Health Check API (Easiest)

Open in browser or use curl:

```
http://localhost:3000/api/health
```

**Expected response:**
```json
{
  "status": "ok",
  "dna_loaded": true,
  "show_name": "المُخبر الاقتصادي+",
  "topics_count": 14,
  "hook_patterns_count": 3,
  "winning_topics_count": 14,
  "feeds_count": 27,
  "feeds_enabled": 25
}
```

**If DNA is NOT loading:**
```json
{
  "status": "ok",
  "dna_loaded": false,
  "show_name": "N/A",
  "topics_count": 0,
  ...
}
```

## Method 2: Check Console Logs During RSS Update

When you click "🔄 Update RSS Feeds", check the **server console** (terminal where you run `npm run dev`):

### ✅ DNA Loaded Successfully:
```
✅ DNA loaded: 14 topics, 3 hook patterns
🎯 Using recommendation engine for 5 items from Bloomberg Markets...
🎯 STRICT QUALITY GATES APPLIED:
   5 items → 2 strong ideas
```

### ❌ DNA NOT Loaded:
```
⚠️  Could not load DNA for show abc-123
   This means strict quality gates and recommendation engine won't work
   Falling back to old scoring method (will be very strict)
⚠️  DNA not loaded or empty for Bloomberg Markets
   showDna exists: false, topics: 0
   Falling back to old scoring (will be very strict)
```

## Method 3: Check DNA Config Files

Check if DNA config files exist:

```bash
# In your project root
ls -la scripts/config/

# Should see:
# - channel_dna.json OR show_dna_almokhbir.json
```

If files don't exist, DNA won't load.

## Method 4: Check Browser Console (Client-Side)

Open browser DevTools (F12) → Console tab, then go to `/signals` page:

Look for any errors related to DNA loading.

## Method 5: Direct API Test

Test DNA loading directly:

```bash
# Replace YOUR_SHOW_ID with your actual show UUID
curl "http://localhost:3000/api/rss-processor?show_id=YOUR_SHOW_ID" | head -20
```

Check the response for DNA-related logs.

## Method 6: Check DNA Loader Function

You can also test the DNA loader directly by creating a test endpoint or checking the code:

**File:** `cursor/lib/recommendation/dnaLoader.js`

It looks for:
1. `scripts/config/channel_dna.json` (first)
2. `scripts/config/show_dna_almokhbir.json` (fallback)
3. Video-based DNA from Supabase (if showId provided)

## Common Issues

### Issue 1: DNA Config File Missing
**Solution:** Make sure `scripts/config/channel_dna.json` or `show_dna_almokhbir.json` exists

### Issue 2: DNA File Format Wrong
**Solution:** Check JSON is valid:
```bash
cat scripts/config/channel_dna.json | python3 -m json.tool
```

### Issue 3: No Videos Imported
**Solution:** Import videos first to get video-based DNA:
1. Go to `/videos/import`
2. Upload CSV or add videos manually
3. Click "Recalculate DNA" on `/dna` page

### Issue 4: Wrong Show ID
**Solution:** Make sure you're using the correct show_id UUID

## Quick Diagnostic Script

Create a test file to check DNA loading:

```javascript
// test-dna.js (in project root)
import { loadShowDna } from './cursor/lib/recommendation/dnaLoader.js';

const showId = 'YOUR_SHOW_ID'; // Replace with your show ID
const dna = await loadShowDna(showId);

console.log('DNA Loaded:', !!dna);
console.log('Topics:', dna?.topics?.length || 0);
console.log('Hook Patterns:', dna?.hook_patterns?.length || 0);
console.log('Full DNA:', JSON.stringify(dna, null, 2));
```

Run with:
```bash
node test-dna.js
```

