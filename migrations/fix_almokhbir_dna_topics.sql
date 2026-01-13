-- Fix AlMokhbir DNA topics with proper structure
-- Run this in Supabase SQL Editor after checking with check_almokhbir_dna_topics.sql

-- First, check if the record exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM show_dna 
    WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'
  ) THEN
    -- Insert new record if it doesn't exist
    INSERT INTO show_dna (show_id, topics)
    VALUES (
      'a7982c70-2b0e-46af-a0ad-c78f4f69cd56',
      jsonb_build_array(
        jsonb_build_object(
          'topic_id', 'energy_oil_gas',
          'name', 'Energy, Oil & Gas',
          'keywords', jsonb_build_array('oil', 'نفط', 'petroleum', 'غاز', 'gas', 'energy', 'طاقة', 'بترول', 'crude', 'lng')
        ),
        jsonb_build_object(
          'topic_id', 'geopolitics',
          'name', 'Geopolitics',
          'keywords', jsonb_build_array('trump', 'ترامب', 'china', 'الصين', 'war', 'حرب', 'iran', 'إيران', 'russia', 'روسيا')
        ),
        jsonb_build_object(
          'topic_id', 'economy',
          'name', 'Economy',
          'keywords', jsonb_build_array('economy', 'اقتصاد', 'inflation', 'تضخم', 'dollar', 'دولار', 'market', 'سوق')
        )
      )
    );
    RAISE NOTICE '✅ Created new show_dna record with topics';
  ELSE
    -- Update existing record
    UPDATE show_dna 
    SET topics = jsonb_build_array(
      jsonb_build_object(
        'topic_id', 'energy_oil_gas',
        'name', 'Energy, Oil & Gas',
        'keywords', jsonb_build_array('oil', 'نفط', 'petroleum', 'غاز', 'gas', 'energy', 'طاقة', 'بترول', 'crude', 'lng')
      ),
      jsonb_build_object(
        'topic_id', 'geopolitics',
        'name', 'Geopolitics',
        'keywords', jsonb_build_array('trump', 'ترامب', 'china', 'الصين', 'war', 'حرب', 'iran', 'إيران', 'russia', 'روسيا')
      ),
      jsonb_build_object(
        'topic_id', 'economy',
        'name', 'Economy',
        'keywords', jsonb_build_array('economy', 'اقتصاد', 'inflation', 'تضخم', 'dollar', 'دولار', 'market', 'سوق')
      )
    )
    WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';
    RAISE NOTICE '✅ Updated existing show_dna record with proper topics structure';
  END IF;
END $$;

-- Verify the update
SELECT 
  show_id,
  jsonb_array_length(topics) as topics_count,
  jsonb_pretty(topics) as topics_formatted
FROM show_dna 
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';

-- Show each topic separately for verification
SELECT 
  show_id,
  topic->>'topic_id' as topic_id,
  topic->>'name' as topic_name,
  jsonb_array_elements_text(topic->'keywords') as keyword
FROM show_dna,
  jsonb_array_elements(topics) as topic
WHERE show_id = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'
ORDER BY topic->>'topic_id', keyword;
