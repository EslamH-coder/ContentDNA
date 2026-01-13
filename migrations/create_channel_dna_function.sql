-- Function to get channel DNA insights
CREATE OR REPLACE FUNCTION get_channel_dna(p_show_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'top_topics', (
      SELECT json_agg(t) FROM (
        SELECT topic_id, video_count, overperforming, avg_views, viral_ratio
        FROM v_topic_performance
        WHERE show_id = p_show_id
        LIMIT 10
      ) t
    ),
    'top_thumbnail_elements', (
      SELECT json_agg(e) FROM (
        SELECT elem, total_videos, overperforming_count, avg_views
        FROM v_thumbnail_elements_performance
        WHERE show_id = p_show_id
        LIMIT 10
      ) e
    ),
    'format_performance', (
      SELECT json_agg(f) FROM (
        SELECT * FROM v_format_performance
        WHERE show_id = p_show_id
      ) f
    ),
    'hook_patterns', (
      SELECT json_agg(h) FROM (
        SELECT title, LEFT(hook_text, 200) as hook_preview, views, topic_id
        FROM v_successful_hooks
        WHERE show_id = p_show_id
        LIMIT 20
      ) h
    ),
    'stats', (
      SELECT json_build_object(
        'total_videos', COUNT(*),
        'overperforming_rate', ROUND(COUNT(*) FILTER (WHERE performance_hint = 'Overperforming')::numeric / NULLIF(COUNT(*), 0) * 100, 1),
        'avg_views', ROUND(AVG(views)),
        'avg_engagement', ROUND(AVG(engagement_rate_30d)::numeric, 2)
      )
      FROM channel_videos
      WHERE show_id = p_show_id
    )
  ) INTO result;
  
  RETURN COALESCE(result, '{}'::json);
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_channel_dna(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_channel_dna(UUID) TO anon;



