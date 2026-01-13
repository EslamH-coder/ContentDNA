-- Migration: Update signals status check constraint to include new statuses
-- Run this in your Supabase SQL editor

-- Step 1: Drop the old constraint
ALTER TABLE signals DROP CONSTRAINT IF EXISTS signals_status_check;

-- Step 2: Add new constraint with all status values (including 'expired')
ALTER TABLE signals 
  ADD CONSTRAINT signals_status_check 
  CHECK (status IN ('new', 'liked', 'rejected', 'saved', 'produced', 'expired', 'reviewed', 'approved'));

-- Step 3: Verify the constraint
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'signals'::regclass
  AND conname = 'signals_status_check';

