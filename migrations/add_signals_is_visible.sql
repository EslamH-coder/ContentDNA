-- Migration: Add is_visible column to signals table
-- Date: 2024
-- Description: Adds is_visible column to track which signals are visible after learning filters

-- Add is_visible column to signals table
ALTER TABLE signals 
ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT true;

-- Add comment to explain the column
COMMENT ON COLUMN signals.is_visible IS 'Whether signal is visible in UI (false = hidden by learning system)';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_signals_is_visible ON signals(show_id, is_visible) WHERE is_visible = true;



