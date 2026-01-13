# How to Set Up Supabase for the Dashboard

## Step 1: Create a Supabase Account and Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or sign in
3. Click "New Project"
4. Fill in:
   - **Project Name**: e.g., "Channel Brain"
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose closest to you
5. Click "Create new project" (takes 1-2 minutes)

## Step 2: Get Your Supabase Credentials

1. In your Supabase project dashboard, click **Settings** (gear icon) in the left sidebar
2. Click **API** under Configuration
3. You'll see two important values:

   - **Project URL**: Looks like `https://xxxxxxxxxxxxx.supabase.co`
   - **anon public key**: A long string starting with `eyJ...`

## Step 3: Create .env.local File

1. Navigate to the `cursor` folder in your terminal:
   ```bash
   cd /Users/Hassanes_1/Documents/channelbrain/cursor
   ```

2. Create the `.env.local` file:
   ```bash
   touch .env.local
   ```

3. Open `.env.local` in your text editor and add:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

4. Replace the placeholder values with your actual credentials:
   - Replace `https://your-project-id.supabase.co` with your **Project URL**
   - Replace `your-anon-key-here` with your **anon public key**

### Example .env.local file:
```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxOTMxODE1MDIyfQ.example_signature_here
```

## Step 4: Set Up Database Tables

1. In your Supabase dashboard, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open the file `supabase_schema.sql` from this folder
4. Copy all the SQL code from that file
5. Paste it into the Supabase SQL Editor
6. Click **Run** (or press Cmd/Ctrl + Enter)
7. You should see "Success. No rows returned"

## Step 5: Restart Your Development Server

1. Stop your current dev server (press `Ctrl + C` in the terminal)
2. Start it again:
   ```bash
   npm run dev
   ```

3. Refresh your browser at `http://localhost:3000/dashboard`

## Step 6: Add Sample Data (Optional)

You can add sample data to test the dashboard. In the Supabase SQL Editor, run:

```sql
-- Add sample shows
INSERT INTO shows (name, channel_id) VALUES 
  ('My YouTube Channel', 'UCxxxxxxxxxxxxx'),
  ('Another Channel', 'UCyyyyyyyyyyyyy')
ON CONFLICT (channel_id) DO NOTHING;

-- Add sample signals (replace 1 with an actual show_id from above)
INSERT INTO signals (show_id, name, score, type) VALUES
  (1, 'Audience Engagement', 8.5, 'audience'),
  (1, 'Performance Trend', 7.9, 'performance'),
  (1, 'Timing Momentum', 7.2, 'timing'),
  (1, 'Competition Gap', 6.8, 'competition'),
  (1, 'Content Quality', 6.5, 'quality');

-- Add sample performance data
INSERT INTO performance_history (show_id, date, views, videos_count) VALUES
  (1, CURRENT_DATE - INTERVAL '29 days', 12000, 3),
  (1, CURRENT_DATE - INTERVAL '28 days', 13500, 4),
  (1, CURRENT_DATE - INTERVAL '27 days', 15000, 5)
ON CONFLICT (show_id, date) DO NOTHING;
```

## Troubleshooting

- **"supabaseUrl is required" error**: Make sure `.env.local` exists and has the correct variable names (they must start with `NEXT_PUBLIC_`)
- **"Invalid API key" error**: Double-check you copied the **anon public** key, not the service_role key
- **Tables not found**: Make sure you ran the SQL schema in Step 4
- **No data showing**: Add sample data using Step 6, or check that your data matches the expected structure

## Security Note

⚠️ **Never commit `.env.local` to git!** It's already in `.gitignore`, but make sure it stays private.

