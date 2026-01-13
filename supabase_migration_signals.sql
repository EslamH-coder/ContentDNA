-- Migration: Add new fields to signals table
-- Run this if you already have a signals table and need to add the new fields

-- Add new columns if they don't exist
ALTER TABLE signals 
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS hook_potential DECIMAL(3,1) CHECK (hook_potential >= 0 AND hook_potential <= 10),
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'approved'));

-- Update existing rows to have default status if null
UPDATE signals SET status = 'new' WHERE status IS NULL;

-- Create index on status for faster filtering
CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status);

