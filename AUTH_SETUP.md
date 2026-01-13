# Supabase Authentication Setup

## Installation

First, install the required package:

```bash
npm install @supabase/auth-helpers-nextjs
```

## Files Created

1. **`/lib/auth.js`** - Client-side auth helpers
2. **`/lib/apiAuth.js`** - Server-side API route auth helpers
3. **`/app/login/page.jsx`** - Login/Signup page
4. **`/app/auth/callback/route.js`** - Auth callback handler
5. **`/middleware.js`** - Route protection middleware
6. **`/app/components/Navigation.js`** - Updated with user menu

## How It Works

### Route Protection

The middleware (`/middleware.js`) automatically:
- Redirects unauthenticated users to `/login`
- Redirects authenticated users away from `/login` to `/ideas`
- Allows public routes: `/login`, `/auth/callback`, `/api/health`

### Protecting API Routes

To protect an API route, import and use `requireAuth`:

```javascript
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';

export async function GET(request) {
  try {
    // Check authentication
    const user = await requireAuth();
    
    // Your protected code here
    // user.id, user.email, etc. are available
    
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### Client-Side Auth

In client components, use the auth helpers:

```javascript
'use client';

import { getUser, signOut } from '@/lib/auth';

// Get current user
const { user, error } = await getUser();

// Sign out
await signOut();
```

## Supabase Configuration

Make sure your Supabase project has:

1. **Email Auth enabled** in Authentication settings
2. **Email confirmation disabled** (for testing) or enabled (for production)
3. **Redirect URLs configured**:
   - `http://localhost:3000/auth/callback` (development)
   - `https://yourdomain.com/auth/callback` (production)

## Testing

1. Start your dev server: `npm run dev`
2. Navigate to any protected route (e.g., `/ideas`)
3. You should be redirected to `/login`
4. Sign up with an email and password
5. Check your email for confirmation (if enabled)
6. Sign in
7. You should see the app with your email in the navigation

## Notes

- The middleware protects all routes except public ones
- API routes need explicit protection using `requireAuth()`
- The Navigation component shows user email and sign out button when logged in
- Sessions are automatically persisted and refreshed


