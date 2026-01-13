# API Routes Auth Update Summary

## ✅ Updated Routes (Using getAuthUser from /lib/supabaseServer.js)

All these routes now:
1. Check authentication using `getAuthUser(request)` 
2. Return 401 if not authenticated
3. Use `supabaseAdmin` (service role) for database operations that need RLS bypass

### Core Routes:
1. ✅ `/app/api/signals/route.js` - GET handler updated
2. ✅ `/app/api/clusters/route.js` - GET and POST handlers updated
3. ✅ `/app/api/feedback/route.js` - POST handler updated
4. ✅ `/app/api/competitors/route.js` - GET and POST handlers updated
5. ✅ `/app/api/competitors/sync/route.js` - POST handler updated
6. ✅ `/app/api/saved-ideas/route.js` - GET, DELETE, PUT handlers updated
7. ✅ `/app/api/generate-pitch/route.js` - POST handler updated
8. ✅ `/app/api/smart-enrich/route.js` - POST handler updated
9. ✅ `/app/api/signals/refresh/route.js` - GET and POST handlers updated
10. ✅ `/app/api/shows/route.js` - Already updated previously

## Pattern Used

All routes follow this pattern:

```javascript
import { getAuthUser } from '@/lib/supabaseServer';

// Service role client for operations that need RLS bypass
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  try {
    // Verify user is authenticated
    const { user, error: authError } = await getAuthUser(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // ... rest of handler using supabaseAdmin for queries
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

## ⚠️ Remaining Routes (Not Yet Updated)

These routes still use the old pattern and may need updating:

- `/app/api/rss-processor/route.js` - Large file, may need special handling
- `/app/api/enrich-signal/route.js`
- `/app/api/generate-pitch/save/route.js`
- `/app/api/sync-new-videos/route.js`
- `/app/api/learning-stats/route.js`
- `/app/api/signals/status/route.js`
- `/app/api/enrich-signals/route.js`
- `/app/api/video-insights/route.js`
- `/app/api/sync-analytics/route.js`
- `/app/api/youtube/refresh-test/route.js`
- `/app/api/story-ideas/route.js`
- `/app/api/calendar-events/route.js`
- `/app/api/idea-bank/route.js`
- And many more...

## How getAuthUser Works

The `getAuthUser(request)` function in `/lib/supabaseServer.js`:
1. Checks Authorization header (Bearer token) - **Most reliable**
2. Checks cookies for Supabase session
3. Returns `{ user, error, supabase }` where `supabase` is the authenticated client

## Client-Side: Sending Auth Token

For API calls to work, client-side code should send the session token:

```javascript
import { supabase } from '@/lib/supabase';

// Get session
const { data: { session } } = await supabase.auth.getSession();

// Include in fetch
const res = await fetch('/api/your-route', {
  headers: {
    'Authorization': `Bearer ${session?.access_token}`,
    'Content-Type': 'application/json',
  },
});
```

## Testing

1. **Test authenticated routes:**
   - Log in
   - Make API calls
   - Should work with user's data

2. **Test unauthenticated:**
   - Log out or use incognito
   - Make API calls
   - Should return 401 "Not authenticated"

3. **Check browser console:**
   - Look for auth errors
   - Verify Authorization header is being sent

## Next Steps

1. Update remaining API routes as needed
2. Update client-side code to send Authorization header (Navigation.jsx already updated)
3. Test all API endpoints
4. Consider creating a reusable `authenticatedFetch` helper for client-side


