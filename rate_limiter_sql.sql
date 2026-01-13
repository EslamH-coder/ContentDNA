-- ============================================
-- Rate Limiter SQL Setup
-- ============================================
-- Run this SQL in Supabase SQL Editor to set up rate limiting

-- Step 1: Create usage_quotas table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS usage_quotas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  pitch_count INTEGER DEFAULT 0,
  refresh_count INTEGER DEFAULT 0,
  sync_count INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Step 2: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_usage_quotas_user_date ON usage_quotas(user_id, date);

-- Step 3: Create function to atomically increment usage
CREATE OR REPLACE FUNCTION increment_usage(
  p_user_id UUID,
  p_date DATE,
  p_field TEXT,
  p_tokens INTEGER DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO usage_quotas (user_id, date, pitch_count, refresh_count, sync_count, tokens_used)
  VALUES (p_user_id, p_date, 
    CASE WHEN p_field = 'pitch_count' THEN 1 ELSE 0 END,
    CASE WHEN p_field = 'refresh_count' THEN 1 ELSE 0 END,
    CASE WHEN p_field = 'sync_count' THEN 1 ELSE 0 END,
    p_tokens
  )
  ON CONFLICT (user_id, date) DO UPDATE SET
    pitch_count = CASE WHEN p_field = 'pitch_count' THEN usage_quotas.pitch_count + 1 ELSE usage_quotas.pitch_count END,
    refresh_count = CASE WHEN p_field = 'refresh_count' THEN usage_quotas.refresh_count + 1 ELSE usage_quotas.refresh_count END,
    sync_count = CASE WHEN p_field = 'sync_count' THEN usage_quotas.sync_count + 1 ELSE usage_quotas.sync_count END,
    tokens_used = usage_quotas.tokens_used + p_tokens,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Step 4: Enable RLS (Row Level Security)
ALTER TABLE usage_quotas ENABLE ROW LEVEL SECURITY;

-- Step 5: Create policy to allow users to read their own usage
CREATE POLICY "Users can read their own usage" ON usage_quotas
  FOR SELECT
  USING (auth.uid() = user_id);

-- Step 6: Create policy to allow service role to insert/update (for API routes)
-- Note: Service role bypasses RLS, so this is mainly for documentation
-- The API routes use service role key, so they can write directly

-- Step 7: Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON usage_quotas TO authenticated;
GRANT SELECT, INSERT, UPDATE ON usage_quotas TO service_role;

-- ============================================
-- Verification Queries
-- ============================================

-- Check if table exists
-- SELECT * FROM usage_quotas LIMIT 1;

-- Check if function exists
-- SELECT proname FROM pg_proc WHERE proname = 'increment_usage';

-- View current usage for a user (replace USER_ID)
-- SELECT * FROM usage_quotas WHERE user_id = 'USER_ID' AND date = CURRENT_DATE;


