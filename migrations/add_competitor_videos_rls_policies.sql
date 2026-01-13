-- Add RLS policies for competitor_videos table
-- Allows authenticated users to perform CRUD operations on competitor_videos

-- Enable RLS if not already enabled
ALTER TABLE competitor_videos ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to allow re-running this migration)
DROP POLICY IF EXISTS "Allow authenticated users to insert competitor_videos" ON competitor_videos;
DROP POLICY IF EXISTS "Allow authenticated users to view competitor_videos" ON competitor_videos;
DROP POLICY IF EXISTS "Allow authenticated users to update competitor_videos" ON competitor_videos;
DROP POLICY IF EXISTS "Allow authenticated users to delete competitor_videos" ON competitor_videos;

-- Create policies
CREATE POLICY "Allow authenticated users to insert competitor_videos" 
ON competitor_videos FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to view competitor_videos" 
ON competitor_videos FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated users to update competitor_videos" 
ON competitor_videos FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated users to delete competitor_videos" 
ON competitor_videos FOR DELETE 
TO authenticated 
USING (true);


