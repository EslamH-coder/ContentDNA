# Client-Side Auth Fix Summary

## Issue
API routes return "Not authenticated" even when user is logged in because client-side fetch calls don't include the Authorization header.

## Solution
Updated client-side code to include the session token in all API requests.

## Files Updated

### ✅ `/app/ideas/page.jsx`
- Added `getAuthHeaders()` helper function
- Updated all fetch calls to include auth headers:
  - `/api/signals` - GET
  - `/api/clusters` - GET, POST
  - `/api/saved-ideas` - GET, DELETE, PUT
  - `/api/generate-pitch` - POST
  - `/api/signals/refresh` - POST
  - `/api/smart-enrich` - POST
  - `/api/feedback` - POST (multiple instances)
  - `/api/enrich-signals` - POST
  - `/api/idea-bank` - POST, PUT
  - `/api/signals/status` - PUT
  - `/api/clusters/create` - POST
  - `/api/clusters/update-items` - POST

### ✅ `/components/Navigation.jsx`
- Already updated to send auth headers for `/api/shows`

## Pattern Used

```javascript
// Helper function
const getAuthHeaders = async (additionalHeaders = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = {
    'Content-Type': 'application/json',
    ...additionalHeaders,
  };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
};

// Usage in fetch calls
const headers = await getAuthHeaders();
const res = await fetch('/api/your-route', {
  method: 'POST',
  headers,
  body: JSON.stringify(data)
});
```

## Remaining Files That May Need Updates

- `/app/signals/page.js` - Has fetch calls that may need auth headers
- Other pages that make API calls

## Testing

1. **Log in** to the app
2. **Open browser console** (F12)
3. **Check Network tab** - All API requests should have `Authorization: Bearer <token>` header
4. **Verify API responses** - Should return data, not "Not authenticated"

## How It Works

1. Client gets session from Supabase (stored in localStorage)
2. Client extracts `access_token` from session
3. Client includes token in `Authorization: Bearer <token>` header
4. Server reads token from header using `getAuthUser(request)`
5. Server validates token and processes request

## If Still Getting "Not authenticated"

1. Check browser console for errors
2. Verify session exists: `localStorage.getItem('sb-')` in console
3. Check Network tab - is Authorization header being sent?
4. Check server logs - is token being received?


