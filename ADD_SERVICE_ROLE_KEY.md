# Add Service Role Key for API Routes

## Problem
The API route is being blocked by Row Level Security (RLS) policies when trying to insert signals.

## Solution
Add the **service_role** key to your `.env.local` file for server-side API routes.

## Steps

1. **Go to Supabase Dashboard** → Your Project → Settings → API

2. **Copy the "service_role" key** (the secret key)
   - It's labeled as "service_role" or "secret"
   - ⚠️ **NEVER use this in browser/client code!**

3. **Add it to your `.env.local` file** in `/Users/Hassanes_1/Documents/channelbrain/cursor/`:

```bash
# Public keys (safe for browser)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # anon key

# Secret key (server-side only, NEVER expose to browser)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # service_role key
```

4. **Restart your Next.js dev server**:
   - Stop the current server (Ctrl+C)
   - Run `npm run dev` again

## Important Notes

- ✅ **Anon Key**: Use in browser/client code (respects RLS)
- ✅ **Service Role Key**: Use ONLY in server-side API routes (bypasses RLS)
- ❌ **Never**: Use service_role key in browser/client code

## Why This Works

- API routes run on the server, so they can safely use the service_role key
- The service_role key bypasses RLS policies, allowing inserts
- Browser code still uses the anon key, which respects RLS for security

