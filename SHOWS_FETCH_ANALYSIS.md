# Shows Fetch Analysis - Remaining Updates Needed

## ✅ Already Updated (Using getUserShows)
- `/app/dashboard/page.js` - Uses `getUserShows()`
- `/app/videos/import/page.js` - Uses `getUserShows()`
- `/app/ideas/page.jsx` - Verifies show access

## ⚠️ Needs Update - Client-Side Pages

### 1. `/components/Navigation.jsx`
**Current:** Fetches from `/api/shows` endpoint
**Line 30-40:** `fetchShows()` calls `/api/shows`
**Fix:** Should use `getUserShows()` directly or update `/api/shows` to filter by user

### 2. `/app/content-tools/page.jsx`
**Current:** Fetches from `/api/shows` endpoint
**Line 63-80:** `fetchShows()` calls `/api/shows`
**Fix:** Should use `getUserShows()` directly or update `/api/shows` to filter by user

### 3. `/app/signals/page.js`
**Current:** Fetches directly from `shows` table
**Line 108-154:** Direct Supabase query `.from('shows')`
**Fix:** Replace with `getUserShows()` function

## ⚠️ Needs Update - API Routes

### 1. `/app/api/shows/route.js`
**Current:** GET endpoint returns ALL shows (line 52-55)
**Fix:** Should filter by user's shows using `verifyShowAccess` or join with `user_shows`

**Current Code:**
```javascript
// Otherwise return all shows
const { data: shows, error } = await supabase
  .from('shows')
  .select('*, youtube_accounts(*)')
  .order('created_at', { ascending: false });
```

**Should be:**
- Get current user
- Join with `user_shows` table
- Only return shows user has access to

## 📋 Other API Routes (May Need Show Access Verification)

These routes fetch shows but may be for internal/system use:
- `/app/api/rss-processor/route.js` (line 2039)
- `/app/api/feedback/route.js` (lines 42, 1103)
- `/app/api/smart-enrich/route.js` (line 162)
- `/app/api/enrich-signal/route.js` (line 109)
- `/app/api/sync-new-videos/route.js` (lines 20, 181)
- `/app/api/sync-analytics/route.js` (line 20)
- `/app/api/youtube/refresh-test/route.js` (line 17)
- `/app/api/shows/[showId]/route.js` (lines 14, 33, 61)
- `/app/api/onboarding/analyze/route.js` (lines 214, 258, 283)
- `/app/api/youtube/import/route.js` (lines 179, 220)
- `/app/api/youtube/callback/route.js` (line 92)
- `/app/api/onboarding/status/route.js` (line 20)

**Note:** These may be system/admin routes that need different handling.

## 🎯 Priority Updates

1. **HIGH PRIORITY:**
   - `/app/api/shows/route.js` - Main API endpoint used by Navigation and content-tools
   - `/app/signals/page.js` - Direct client-side fetch
   - `/components/Navigation.jsx` - Used across the app
   - `/app/content-tools/page.jsx` - User-facing page

2. **MEDIUM PRIORITY:**
   - Review other API routes to see if they need show access verification

## 🔧 Recommended Fix Strategy

### Option 1: Update API Route (Recommended)
Update `/app/api/shows/route.js` to filter by user, then all client-side code using it will automatically work.

### Option 2: Update Each Client Component
Update each component to use `getUserShows()` directly instead of calling the API.

**Recommendation:** Use Option 1 for consistency and to avoid duplicate code.


