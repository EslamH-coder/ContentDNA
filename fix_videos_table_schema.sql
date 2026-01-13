-- Fix videos table schema - Add all missing columns
-- Run this in your Supabase SQL editor

-- First, check what columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'videos' 
ORDER BY column_name;

-- Add all required columns if they don't exist
DO $$ 
BEGIN
    -- url column (required)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'videos' AND column_name = 'url'
    ) THEN
        ALTER TABLE videos ADD COLUMN url TEXT NOT NULL DEFAULT '';
        RAISE NOTICE 'Added url column';
    END IF;
    
    -- view_count column (required)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'videos' AND column_name = 'view_count'
    ) THEN
        ALTER TABLE videos ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;
        RAISE NOTICE 'Added view_count column';
    END IF;
    
    -- like_count column (optional)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'videos' AND column_name = 'like_count'
    ) THEN
        ALTER TABLE videos ADD COLUMN like_count INTEGER DEFAULT 0;
        RAISE NOTICE 'Added like_count column';
    END IF;
    
    -- comment_count column (optional)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'videos' AND column_name = 'comment_count'
    ) THEN
        ALTER TABLE videos ADD COLUMN comment_count INTEGER DEFAULT 0;
        RAISE NOTICE 'Added comment_count column';
    END IF;
    
    -- duration_seconds column (optional)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'videos' AND column_name = 'duration_seconds'
    ) THEN
        ALTER TABLE videos ADD COLUMN duration_seconds INTEGER;
        RAISE NOTICE 'Added duration_seconds column';
    END IF;
    
    -- format column (required)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'videos' AND column_name = 'format'
    ) THEN
        ALTER TABLE videos ADD COLUMN format TEXT CHECK (format IN ('long_form', 'short_form')) DEFAULT 'long_form';
        RAISE NOTICE 'Added format column';
    END IF;
    
    -- published_at column (required)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'videos' AND column_name = 'published_at'
    ) THEN
        ALTER TABLE videos ADD COLUMN published_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();
        RAISE NOTICE 'Added published_at column';
    END IF;
    
    -- age_days column (optional)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'videos' AND column_name = 'age_days'
    ) THEN
        ALTER TABLE videos ADD COLUMN age_days INTEGER;
        RAISE NOTICE 'Added age_days column';
    END IF;
    
    -- performance_classification column (optional)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'videos' AND column_name = 'performance_classification'
    ) THEN
        ALTER TABLE videos ADD COLUMN performance_classification TEXT CHECK (performance_classification IN ('over_performing', 'average', 'under_performing', 'unknown')) DEFAULT 'unknown';
        RAISE NOTICE 'Added performance_classification column';
    END IF;
    
    -- ratio_vs_median column (optional)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'videos' AND column_name = 'ratio_vs_median'
    ) THEN
        ALTER TABLE videos ADD COLUMN ratio_vs_median DECIMAL(10, 2);
        RAISE NOTICE 'Added ratio_vs_median column';
    END IF;
    
    -- topic_id column (for DNA analysis)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'videos' AND column_name = 'topic_id'
    ) THEN
        ALTER TABLE videos ADD COLUMN topic_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_videos_topic_id ON videos(topic_id);
        RAISE NOTICE 'Added topic_id column';
    END IF;
    
    -- hook_text column (for DNA analysis)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'videos' AND column_name = 'hook_text'
    ) THEN
        ALTER TABLE videos ADD COLUMN hook_text TEXT;
        RAISE NOTICE 'Added hook_text column';
    END IF;
    
    -- performance_hint column (for DNA analysis)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'videos' AND column_name = 'performance_hint'
    ) THEN
        ALTER TABLE videos ADD COLUMN performance_hint TEXT;
        RAISE NOTICE 'Added performance_hint column';
    END IF;
    
END $$;

-- Show final schema
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'videos' 
ORDER BY ordinal_position;

