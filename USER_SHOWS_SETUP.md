# User Shows Filtering - Setup Guide

## Overview
The app now filters shows to only display shows that belong to the logged-in user. This is done through a `user_shows` table that links users to shows with roles.

## Database Schema Required

You need a `user_shows` table with the following structure:

```sql
CREATE TABLE IF NOT EXISTS user_shows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner', -- 'owner', 'editor', 'viewer'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, show_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_shows_user_id ON user_shows(user_id);
CREATE INDEX IF NOT EXISTS idx_user_shows_show_id ON user_shows(show_id);

-- Enable RLS (Row Level Security)
ALTER TABLE user_shows ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own show associations
CREATE POLICY "Users can view their own show associations"
  ON user_shows FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own show associations (if needed)
CREATE POLICY "Users can insert their own show associations"
  ON user_shows FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

## Linking a User to a Show

To link a user to a show, insert a record into `user_shows`:

```sql
INSERT INTO user_shows (user_id, show_id, role)
VALUES (
  'user-uuid-here',  -- Get from auth.users table
  'show-uuid-here',  -- Get from shows table
  'owner'            -- or 'editor', 'viewer'
);
```

## Backward Compatibility

The code includes backward compatibility:
- If `user_shows` table doesn't exist, the app will fall back to showing all shows
- This allows gradual migration without breaking existing functionality

## Files Changed

### Client-Side Helpers
- `/lib/userShows.js` - Functions to get user's shows and check access

### Server-Side Helpers
- `/lib/apiShowAccess.js` - Function to verify show access in API routes

### Pages Updated
- `/app/dashboard/page.js` - Now uses `getUserShows()`
- `/app/videos/import/page.js` - Now uses `getUserShows()`
- `/app/ideas/page.jsx` - Verifies show access before loading data

### API Routes Updated
- `/app/api/signals/route.js` - Verifies show access
- `/app/api/clusters/route.js` - Verifies show access (GET and POST)

## Testing

1. **Create the `user_shows` table** (see SQL above)
2. **Link your user to a show**:
   ```sql
   -- Get your user ID
   SELECT id, email FROM auth.users;
   
   -- Get show IDs
   SELECT id, name FROM shows;
   
   -- Link user to show
   INSERT INTO user_shows (user_id, show_id, role)
   VALUES ('your-user-id', 'your-show-id', 'owner');
   ```
3. **Test the app**:
   - Log in
   - Should only see shows you're linked to
   - API routes should return 403 if you try to access a show you don't have access to

## Migration Path

If you have existing shows and want to migrate:

1. Create the `user_shows` table
2. For each existing show, decide which users should have access
3. Insert records into `user_shows` for each user-show pair
4. The app will automatically start filtering once the table exists

## Role-Based Access (Future)

The `role` field is stored but not yet used for permission checks. Future enhancements could:
- `owner`: Full access (create, edit, delete)
- `editor`: Can edit but not delete
- `viewer`: Read-only access


