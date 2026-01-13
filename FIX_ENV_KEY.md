# Fix: Secret API Key Error

## Problem
You're using a **secret** (service_role) API key in the browser, which Supabase blocks.

## Solution

1. **Go to Supabase Dashboard** → Your Project → Settings → API

2. **Find the "anon" public key** (NOT the service_role key)
   - It should look like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - It's labeled as "anon" or "public"

3. **Update your `.env.local` file** in `/Users/Hassanes_1/Documents/channelbrain/cursor/`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # Use the ANON key, NOT service_role
```

4. **Restart your Next.js dev server**:
   - Stop the current server (Ctrl+C)
   - Run `npm run dev` again

## Key Differences

- ✅ **Anon Key** (public): Safe for browser, respects RLS policies
- ❌ **Service Role Key** (secret): NEVER use in browser, bypasses RLS

## How to Identify

- **Anon key**: Usually starts with `eyJ...`, shorter, labeled "anon" or "public"
- **Service role key**: Usually longer, labeled "service_role" or "secret"

